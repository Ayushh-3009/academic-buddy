/**
 * Chat API Routes
 * Streaming SSE endpoint, conversation history management, and response reporting.
 */

const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { optionalAuth, requireAuth } = require('../middleware/authMiddleware');
const { rateLimiterMiddleware } = require('../middleware/rateLimiter');
const { validateChatInput } = require('../middleware/validateChat');
const { moderateInput, sanitizeOutput } = require('../services/moderation');
const { buildSystemPrompt } = require('../prompts');
const { streamGeminiChat } = require('../services/gemini');

// Helper to generate a clean study title from initial prompt
function generateTitle(text) {
  if (!text) return 'New Study Session';
  const clean = text.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const words = clean.split(/\s+/).slice(0, 5);
  return words.join(' ') || 'Study Session';
}

// ------------------------------------------------------------------------------
// 1. GET /api/chat/conversations - List conversations for user
// ------------------------------------------------------------------------------
router.get('/conversations', optionalAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const conversations = await db.query(
      `SELECT c.id, c.title, c.study_mode, c.explain_level, c.created_at, c.updated_at,
              (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
       FROM conversations c
       WHERE c.user_id = ?
       ORDER BY c.updated_at DESC`,
      [userId]
    );
    res.json({ conversations });
  } catch (err) {
    console.error('Fetch conversations error:', err);
    res.status(500).json({ error: 'Server error', message: 'Could not load conversations.' });
  }
});

// ------------------------------------------------------------------------------
// 2. GET /api/chat/conversations/:id - Get messages for a specific conversation
// ------------------------------------------------------------------------------
router.get('/conversations/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const conversation = await db.queryOne(
      'SELECT id, title, study_mode, explain_level, created_at, updated_at FROM conversations WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!conversation) {
      return res.status(404).json({ error: 'Not found', message: 'Study session not found.' });
    }

    const messages = await db.query(
      'SELECT id, role, content, study_mode, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [id]
    );

    res.json({ conversation, messages });
  } catch (err) {
    console.error('Fetch messages error:', err);
    res.status(500).json({ error: 'Server error', message: 'Could not load messages.' });
  }
});

// ------------------------------------------------------------------------------
// 3. POST /api/chat/stream - Server-Sent Events (SSE) AI Streaming Endpoint
// ------------------------------------------------------------------------------
router.post('/stream', optionalAuth, rateLimiterMiddleware, validateChatInput, async (req, res) => {
  const { message, conversationId, mode = 'learn', explainLevel = 'off' } = req.body;
  const user = req.user;

  // 1. Content Moderation & Crisis Intervention Check
  const moderation = moderateInput(message);
  if (moderation.isCrisis) {
    // Crisis response: Return immediately and don't forward to general LLM
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const crisisChunk = moderation.crisisResponse;
    res.write(`data: ${JSON.stringify({ token: crisisChunk, isCrisis: true })}\n\n`);
    res.write(`data: [DONE]\n\n`);
    return res.end();
  }

  // 2. Ensure or Create Conversation
  let activeConvId = conversationId;
  try {
    if (activeConvId) {
      const conv = await db.queryOne('SELECT id FROM conversations WHERE id = ? AND user_id = ?', [activeConvId, user.id]);
      if (!conv) {
        activeConvId = null;
      }
    }

    if (!activeConvId) {
      activeConvId = 'conv_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      const title = generateTitle(message);
      await db.run(
        `INSERT INTO conversations (id, user_id, title, study_mode, explain_level)
         VALUES (?, ?, ?, ?, ?)`,
        [activeConvId, user.id, title, mode, explainLevel]
      );
    } else {
      // Update mode & timestamp
      await db.run(
        `UPDATE conversations SET study_mode = ?, explain_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [mode, explainLevel, activeConvId]
      );
    }

    // 3. Save User Message
    const userMsgId = 'msg_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    await db.run(
      `INSERT INTO messages (id, conversation_id, role, content, study_mode) VALUES (?, ?, 'user', ?, ?)`,
      [userMsgId, activeConvId, message, mode]
    );

    // 4. Load Conversation History
    const historyRows = await db.query(
      'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [activeConvId]
    );

    // 5. Build System Prompt
    let systemPrompt = buildSystemPrompt({ mode, explainLevel, user });
    if (moderation.cheatFlag) {
      systemPrompt += `\n\n### CRITICAL NOTICE FOR CURRENT TURN:
The student appears to be asking for direct completion of an assignment. DO NOT write their essay or provide final answers. Provide Socratic steps, ask guiding questions, and explain the core principle instead!`;
    }

    // 6. Set up SSE Headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Send metadata header (conversationId, userMsgId)
    res.write(`data: ${JSON.stringify({ meta: { conversationId: activeConvId, userMsgId } })}\n\n`);

    let accumulatedText = '';
    const assistantMsgId = 'msg_' + (Date.now() + 1).toString(36) + Math.random().toString(36).substring(2, 6);

    // 7. Stream Gemini Tokens
    await streamGeminiChat({
      systemPrompt,
      history: historyRows.slice(0, -1), // previous history excluding current prompt
      newMessage: message,
      onChunk: (deltaText) => {
        accumulatedText += deltaText;
        const sanitizedChunk = sanitizeOutput(deltaText);
        res.write(`data: ${JSON.stringify({ token: sanitizedChunk })}\n\n`);
      },
      onComplete: async (fullText) => {
        // Persist assistant reply to DB
        try {
          await db.run(
            `INSERT INTO messages (id, conversation_id, role, content, study_mode) VALUES (?, ?, 'assistant', ?, ?)`,
            [assistantMsgId, activeConvId, fullText, mode]
          );
        } catch (dbErr) {
          console.error('Error saving assistant message:', dbErr);
        }

        res.write(`data: ${JSON.stringify({ complete: true, messageId: assistantMsgId })}\n\n`);
        res.write(`data: [DONE]\n\n`);
        res.end();
      },
      onError: (err) => {
        console.error('Streaming failure:', err);
        const errMessage = `⚠️ Studi encountered a temporary hiccup communicating with the AI service. Please retry in a few moments.`;
        res.write(`data: ${JSON.stringify({ error: true, token: errMessage })}\n\n`);
        res.write(`data: [DONE]\n\n`);
        res.end();
      },
    });

  } catch (err) {
    console.error('SSE Stream Route Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Server error', message: 'Could not process chat stream.' });
    } else {
      res.write(`data: ${JSON.stringify({ error: true, token: 'Server error occurred during streaming.' })}\n\n`);
      res.write(`data: [DONE]\n\n`);
      res.end();
    }
  }
});

// ------------------------------------------------------------------------------
// 4. PATCH /api/chat/conversations/:id - Rename conversation title
// ------------------------------------------------------------------------------
router.patch('/conversations/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    const userId = req.user.id;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Validation error', message: 'Title cannot be blank.' });
    }

    const cleanTitle = title.trim().slice(0, 60);
    await db.run(
      'UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [cleanTitle, id, userId]
    );

    res.json({ success: true, title: cleanTitle });
  } catch (err) {
    console.error('Rename conversation error:', err);
    res.status(500).json({ error: 'Server error', message: 'Failed to rename conversation.' });
  }
});

// ------------------------------------------------------------------------------
// 5. DELETE /api/chat/conversations/:id - Delete a conversation and its messages
// ------------------------------------------------------------------------------
router.delete('/conversations/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await db.run('DELETE FROM messages WHERE conversation_id = ?', [id]);
    await db.run('DELETE FROM conversations WHERE id = ? AND user_id = ?', [id, userId]);

    res.json({ success: true, message: 'Study session deleted.' });
  } catch (err) {
    console.error('Delete conversation error:', err);
    res.status(500).json({ error: 'Server error', message: 'Failed to delete conversation.' });
  }
});

// ------------------------------------------------------------------------------
// 6. POST /api/chat/report - Submit safety / inappropriate response report
// ------------------------------------------------------------------------------
router.post('/report', optionalAuth, async (req, res) => {
  try {
    const { messageId, conversationId, reason, details } = req.body;
    const userId = req.user.id;

    if (!reason) {
      return res.status(400).json({ error: 'Validation error', message: 'Please select a reason for reporting.' });
    }

    const reportId = 'rep_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    await db.run(
      `INSERT INTO reports (id, user_id, conversation_id, message_id, reason, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [reportId, userId, conversationId || null, messageId || null, reason, details || '']
    );

    res.status(201).json({
      success: true,
      reportId,
      message: 'Thank you for keeping Academic Buddy safe. Our safety team will review this response.',
    });
  } catch (err) {
    console.error('Report submission error:', err);
    res.status(500).json({ error: 'Server error', message: 'Failed to submit report.' });
  }
});

module.exports = router;
