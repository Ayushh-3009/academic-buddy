/**
 * Gemini AI Client Wrapper
 * Handles streaming generation, token limits, conversation format conversion,
 * and graceful fallback when API key is missing.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/config');

let genAIClient = null;

function getClient() {
  if (!config.gemini.apiKey) {
    return null;
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenerativeAI(config.gemini.apiKey);
  }
  return genAIClient;
}

/**
 * Stream response from Gemini using SSE (Server-Sent Events)
 * @param {Object} params
 * @param {string} params.systemPrompt - Combined system instructions
 * @param {Array} params.history - Previous messages in { role: 'user'|'assistant', content: string }
 * @param {string} params.newMessage - Current user message
 * @param {Function} params.onChunk - Callback invoked for each streamed text delta
 * @param {Function} params.onComplete - Callback invoked when streaming finishes
 * @param {Function} params.onError - Callback invoked if streaming fails
 */
async function streamGeminiChat({
  systemPrompt,
  history = [],
  newMessage,
  onChunk,
  onComplete,
  onError,
}) {
  const client = getClient();

  // If no API key is provided, simulate a helpful response informing the user
  if (!client) {
    const fallbackText = `👋 **Hello! I'm Studi, your AI study buddy.**

It looks like the server is running, but the \`GEMINI_API_KEY\` hasn't been set in the \`.env\` file yet!

### Quick 2-Minute Setup:
1. Grab a free API key from [Google AI Studio](https://aistudio.google.com/).
2. Open \`.env\` in this project.
3. Set \`GEMINI_API_KEY=your_actual_key_here\`.
4. Restart the server with \`npm start\`.

*Once connected, I can guide you through tough concepts, quiz you with active recall, and break down lecture slides!*`;

    // Simulate streaming words
    const tokens = fallbackText.split(' ');
    for (const token of tokens) {
      await new Promise(r => setTimeout(r, 25));
      onChunk(token + ' ');
    }
    if (onComplete) onComplete(fallbackText);
    return;
  }

  // Candidate models to try in case of transient 503 or model deprecation
  const candidateModels = [
    config.gemini.model,
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-flash-lite-latest',
    'gemini-3-flash-preview',
    'gemini-3.6-flash',
  ].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

  // Format conversation history for Gemini SDK
  const formattedContents = [];
  const recentHistory = history.slice(-10);
  for (const msg of recentHistory) {
    if (!msg.content) continue;
    formattedContents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }
  formattedContents.push({
    role: 'user',
    parts: [{ text: newMessage }],
  });

  let lastError = null;

  for (const modelName of candidateModels) {
    try {
      const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          maxOutputTokens: config.gemini.maxOutputTokens,
          temperature: config.gemini.temperature,
        },
        systemInstruction: systemPrompt,
      });

      const result = await model.generateContentStream({
        contents: formattedContents,
      });

      let fullAccumulatedText = '';

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          fullAccumulatedText += chunkText;
          onChunk(chunkText);
        }
      }

      if (onComplete) {
        onComplete(fullAccumulatedText);
      }
      return; // Stream succeeded
    } catch (err) {
      console.warn(`Model ${modelName} stream failed: ${err.message}. Trying next candidate if available...`);
      lastError = err;
      if (fullAccumulatedText) {
        // If text was already streamed to the student, do not replay another model on top
        break;
      }
    }
  }

  console.error('All Gemini candidate models failed:', lastError);
  if (onError) {
    onError(lastError);
  }
}

module.exports = {
  streamGeminiChat,
  getClient,
};
