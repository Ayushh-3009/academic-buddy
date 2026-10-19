/**
 * Authentication API Routes
 * Register, login, mock/federated OAuth, and profile management.
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const uuidv4 = () => (crypto.randomUUID ? crypto.randomUUID() : 'u_' + Math.random().toString(36).substring(2, 12));
const db = require('../db/database');
const config = require('../config/config');
const { requireAuth, optionalAuth } = require('../middleware/authMiddleware');

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name, grade_level, is_under_16, parental_consent_given } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Validation error', message: 'Email and password are required.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Validation error', message: 'Password must be at least 8 characters long.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await db.queryOne('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing) {
      return res.status(409).json({ error: 'Conflict', message: 'An account with this email already exists. Please log in.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

    await db.run(
      `INSERT INTO users (id, email, password_hash, full_name, grade_level, is_under_16, parental_consent_given)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        normalizedEmail,
        passwordHash,
        full_name || normalizedEmail.split('@')[0],
        grade_level || 'High School',
        is_under_16 ? 1 : 0,
        parental_consent_given ? 1 : 0,
      ]
    );

    const user = {
      id: userId,
      email: normalizedEmail,
      full_name: full_name || normalizedEmail.split('@')[0],
      grade_level: grade_level || 'High School',
      is_under_16: Boolean(is_under_16),
      tier: 'free',
    };

    const token = generateToken(user);
    res.status(201).json({ user, token, message: 'Account created successfully! Welcome to Academic Buddy.' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error', message: 'Failed to create account.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Validation error', message: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.queryOne(
      'SELECT id, email, password_hash, full_name, grade_level, target_subjects, study_goals, is_under_16, tier FROM users WHERE email = ?',
      [normalizedEmail]
    );

    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Authentication failed', message: 'Invalid email or password.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Authentication failed', message: 'Invalid email or password.' });
    }

    delete user.password_hash;
    const token = generateToken(user);
    res.json({ user, token, message: 'Welcome back!' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error', message: 'Failed to log in.' });
  }
});

// POST /api/auth/oauth-mock (Seamless integration for Google & Apple buttons in existing modal)
router.post('/oauth-mock', async (req, res) => {
  try {
    const { provider, email, name } = req.body;
    const oauthProvider = provider === 'apple' ? 'apple' : 'google';
    const userEmail = (email || `${oauthProvider}.student_${Date.now().toString(36)}@academicbuddy.test`).toLowerCase();

    let user = await db.queryOne('SELECT id, email, full_name, grade_level, tier FROM users WHERE email = ?', [userEmail]);

    if (!user) {
      const userId = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      const fullName = name || (oauthProvider === 'apple' ? 'Apple Scholar' : 'Google Scholar');
      await db.run(
        `INSERT INTO users (id, email, full_name, auth_provider, grade_level) VALUES (?, ?, ?, ?, ?)`,
        [userId, userEmail, fullName, oauthProvider, 'High School']
      );
      user = { id: userId, email: userEmail, full_name: fullName, grade_level: 'High School', tier: 'free' };
    }

    const token = generateToken(user);
    res.json({ user, token, message: `Connected with ${oauthProvider.toUpperCase()}!` });
  } catch (err) {
    console.error('OAuth error:', err);
    res.status(500).json({ error: 'Server error', message: 'OAuth authentication failed.' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/onboarding (Save grade level, difficult subjects, and study goals)
router.post('/onboarding', optionalAuth, async (req, res) => {
  try {
    const { gradeLevel, targetSubjects, studyGoals, isUnder16, parentalConsentGiven } = req.body;
    const userId = req.user.id;

    if (!req.user.isGuest) {
      await db.run(
        `UPDATE users
         SET grade_level = COALESCE(?, grade_level),
             target_subjects = ?,
             study_goals = ?,
             is_under_16 = COALESCE(?, is_under_16),
             parental_consent_given = COALESCE(?, parental_consent_given)
         WHERE id = ?`,
        [
          gradeLevel || null,
          JSON.stringify(targetSubjects || []),
          JSON.stringify(studyGoals || []),
          isUnder16 ? 1 : 0,
          parentalConsentGiven ? 1 : 0,
          userId,
        ]
      );
    }

    res.json({
      success: true,
      profile: {
        gradeLevel: gradeLevel || 'High School',
        targetSubjects: targetSubjects || [],
        studyGoals: studyGoals || [],
        isUnder16: Boolean(isUnder16),
      },
      message: 'Study profile saved successfully! Studi has personalized your workspace.',
    });
  } catch (err) {
    console.error('Onboarding update error:', err);
    res.status(500).json({ error: 'Server error', message: 'Failed to save onboarding preferences.' });
  }
});

module.exports = router;
