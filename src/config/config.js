/**
 * Academic Buddy Configuration Manager
 * Loads and validates environment variables.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  
  // Gemini AI
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    maxOutputTokens: parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS, 10) || 1500,
    temperature: parseFloat(process.env.GEMINI_TEMPERATURE) || 0.7,
  },

  // Auth & Security
  jwt: {
    secret: process.env.JWT_SECRET || 'academic_buddy_default_secret_key_change_me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // Rate Limiting & Guardrails
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000, // 1 minute
    maxPerWindow: parseInt(process.env.RATE_LIMIT_MAX_PER_WINDOW, 10) || 20, // 20 requests/min
  },
  
  maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH, 10) || 3000,

  // Database
  databasePath: process.env.VERCEL
    ? '/tmp/academic_buddy.sqlite'
    : path.resolve(__dirname, '../../', process.env.DATABASE_PATH || './data/academic_buddy.sqlite'),
};

module.exports = Object.freeze(config);
