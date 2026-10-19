/**
 * Chat Input Validation and Sanitization Middleware
 */

const config = require('../config/config');

const VALID_MODES = new Set(['learn', 'quiz-me', 'teach-it-back', 'exam-crunch', 'chill-review']);
const VALID_EXPLAIN_LEVELS = new Set(['off', 'middle_school', 'high_school', 'college']);

function validateChatInput(req, res, next) {
  const { message, mode, explainLevel } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({
      error: 'Invalid input',
      message: 'Please provide a valid text question or concept.',
    });
  }

  const trimmedMessage = message.trim();

  if (trimmedMessage.length === 0) {
    return res.status(400).json({
      error: 'Empty message',
      message: 'Your study message cannot be empty.',
    });
  }

  if (trimmedMessage.length > config.maxMessageLength) {
    return res.status(400).json({
      error: 'Message too long',
      message: `Your question exceeds the maximum limit of ${config.maxMessageLength} characters. Please break it into smaller parts.`,
      currentLength: trimmedMessage.length,
      maxLength: config.maxMessageLength,
    });
  }

  // Validate or default mode
  if (mode && !VALID_MODES.has(mode)) {
    req.body.mode = 'learn';
  } else if (!mode) {
    req.body.mode = 'learn';
  }

  // Validate or default explain-it-simply level
  if (explainLevel && !VALID_EXPLAIN_LEVELS.has(explainLevel)) {
    req.body.explainLevel = 'off';
  } else if (!explainLevel) {
    req.body.explainLevel = 'off';
  }

  // Basic sanitization: strip null bytes and normalize whitespace
  req.body.message = trimmedMessage.replace(/\0/g, '');

  next();
}

module.exports = {
  validateChatInput,
  VALID_MODES,
  VALID_EXPLAIN_LEVELS,
};
