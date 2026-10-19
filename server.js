/**
 * Academic Buddy - Main Express Application Server
 * Serves static landing page, Auth API, and SSE Chat API.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./src/config/config');
const db = require('./src/db/database');
const authRoutes = require('./src/routes/auth');
const chatRoutes = require('./src/routes/chat');
const userRoutes = require('./src/routes/user');

const app = express();

// Security: Disallow sensitive header inspection
app.disable('x-powered-by');

// CORS configuration
app.use(cors({
  origin: config.nodeEnv === 'production' ? config.clientUrl : true,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Guest-Id', 'X-Grade-Level'],
}));

// Body parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Initialize SQLite database
db.getDb()
  .then(() => console.log('✓ SQLite database connected and migrations verified.'))
  .catch((err) => console.error('Database connection warning:', err.message));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/user', userRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Academic Buddy Backend',
    timestamp: new Date().toISOString(),
    geminiConfigured: Boolean(config.gemini.apiKey),
    model: config.gemini.model,
  });
});

// Serve frontend static files
app.use(express.static(path.resolve(__dirname), {
  extensions: ['html', 'htm'],
  maxAge: config.nodeEnv === 'production' ? '1d' : '0',
}));

// 404 Handler for API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found', message: 'API route does not exist.' });
});

// Fallback to 404.html for unmatched page requests
app.use((req, res) => {
  res.status(404).sendFile(path.resolve(__dirname, '404.html'));
});

// Centralized error handler (Never leak stack traces in responses)
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.message);
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: config.nodeEnv === 'production' ? 'An unexpected error occurred. Please try again.' : err.message,
  });
});

// Start listening only when executed directly (not when imported as a serverless module in Vercel)
if (require.main === module) {
  const server = app.listen(config.port, () => {
    console.log(`\n============================================================`);
    console.log(`🚀 Academic Buddy Server running at: http://localhost:${config.port}`);
    console.log(`📡 Gemini Model: ${config.gemini.model} (API Key: ${config.gemini.apiKey ? 'Configured ✓' : 'Simulation Mode ⚠️'})`);
    console.log(`🔒 Security: Rate limiting & Input Sanitization active`);
    console.log(`============================================================\n`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received. Closing HTTP server and persisting DB...');
    db.persistToDisk();
    server.close(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    console.log('SIGINT signal received. Closing HTTP server and persisting DB...');
    db.persistToDisk();
    server.close(() => process.exit(0));
  });
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception caught:', err);
});

module.exports = app;
