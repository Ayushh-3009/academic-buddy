/**
 * Authentication Middleware
 * Validates JWT tokens and provides transparent guest session fallbacks.
 */

const jwt = require('jsonwebtoken');
const config = require('../config/config');
const db = require('../db/database');

/**
 * Optional authentication: Attaches user if token is present, otherwise sets guest user
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    // Generate or use provided guest ID
    const guestId = req.headers['x-guest-id'] || 'guest_' + (req.ip || 'local').replace(/[^a-zA-Z0-9]/g, '_');
    req.user = {
      id: guestId,
      email: 'guest@academicbuddy.local',
      full_name: 'Guest Scholar',
      grade_level: req.headers['x-grade-level'] || 'High School',
      isGuest: true,
      tier: 'free',
    };
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await db.queryOne('SELECT id, email, full_name, grade_level, target_subjects, study_goals, is_under_16, tier FROM users WHERE id = ?', [decoded.id]);
    
    if (user) {
      req.user = { ...user, isGuest: false };
    } else {
      req.user = { id: decoded.id, isGuest: true, grade_level: 'High School', tier: 'free' };
    }
    next();
  } catch (err) {
    // Expired or invalid token: degrade gracefully to guest session
    req.user = {
      id: 'guest_fallback',
      email: 'guest@academicbuddy.local',
      isGuest: true,
      grade_level: 'High School',
      tier: 'free',
    };
    next();
  }
}

/**
 * Required authentication: Returns 401 if missing or invalid token
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Please log in to access this feature.' });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await db.queryOne('SELECT id, email, full_name, grade_level, target_subjects, study_goals, is_under_16, tier FROM users WHERE id = ?', [decoded.id]);
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User account not found.' });
    }

    req.user = { ...user, isGuest: false };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired session token.' });
  }
}

module.exports = {
  optionalAuth,
  requireAuth,
};
