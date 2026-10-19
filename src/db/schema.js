/**
 * Database Schema Definition
 * Embedded JavaScript string to ensure 100% bundling across serverless environments.
 */

const SCHEMA_SQL = `
-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  full_name TEXT,
  auth_provider TEXT DEFAULT 'email',
  grade_level TEXT DEFAULT 'High School',
  target_subjects TEXT DEFAULT '[]',
  study_goals TEXT DEFAULT '[]',
  is_under_16 INTEGER DEFAULT 0,
  parental_consent_given INTEGER DEFAULT 0,
  tier TEXT DEFAULT 'free',
  daily_messages_count INTEGER DEFAULT 0,
  last_active_date TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT DEFAULT 'New Study Session',
  study_mode TEXT DEFAULT 'learn',
  explain_level TEXT DEFAULT 'off',
  subject TEXT DEFAULT 'General',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  study_mode TEXT DEFAULT 'learn',
  tokens_used INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Response Safety Reports Table
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  conversation_id TEXT,
  message_id TEXT,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. User Progress & Gamification Stats Table
CREATE TABLE IF NOT EXISTS user_stats (
  user_id TEXT PRIMARY KEY,
  streak_days INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 150,
  study_minutes INTEGER DEFAULT 45,
  weekly_goal_hours REAL DEFAULT 10.0,
  retention_score INTEGER DEFAULT 88,
  badges_json TEXT DEFAULT '["first_spark","syllabus_master"]',
  subject_mastery_json TEXT DEFAULT '[]',
  last_activity_date TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indices for rapid lookup
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_user_stats_user ON user_stats(user_id);
`;

module.exports = { SCHEMA_SQL };
