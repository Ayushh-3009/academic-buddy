/**
 * In-Memory Sliding Window Rate Limiter
 * Tracks requests per IP address and per authenticated user ID.
 */

const config = require('../config/config');

class RateLimiter {
  constructor(windowMs = 60000, maxRequests = 20) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.hits = new Map(); // key -> [timestamps]

    // Periodically clean up expired entries every 2 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 120000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  getKey(req) {
    // Priority: authenticated user ID, otherwise client IP address
    const userId = req.user?.id;
    if (userId) {
      return `user:${userId}`;
    }
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    return `ip:${ip}`;
  }

  isRateLimited(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let timestamps = this.hits.get(key) || [];
    // Filter timestamps within current window
    timestamps = timestamps.filter(ts => ts > windowStart);

    if (timestamps.length >= this.maxRequests) {
      const oldestInWindow = timestamps[0];
      const retryAfterMs = oldestInWindow + this.windowMs - now;
      return {
        limited: true,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
        remaining: 0,
      };
    }

    timestamps.push(now);
    this.hits.set(key, timestamps);

    return {
      limited: false,
      retryAfterSeconds: 0,
      remaining: this.maxRequests - timestamps.length,
    };
  }

  cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    for (const [key, timestamps] of this.hits.entries()) {
      const valid = timestamps.filter(ts => ts > windowStart);
      if (valid.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, valid);
      }
    }
  }

  reset() {
    this.hits.clear();
  }

  middleware() {
    return (req, res, next) => {
      const key = this.getKey(req);
      const { limited, retryAfterSeconds, remaining } = this.isRateLimited(key);

      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining);

      if (limited) {
        res.setHeader('Retry-After', retryAfterSeconds);
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: `Too many study requests. Please take a quick breath and try again in ${retryAfterSeconds} seconds.`,
          retryAfterSeconds,
        });
      }

      next();
    };
  }
}

// Default instance using environment config
const defaultLimiter = new RateLimiter(config.rateLimit.windowMs, config.rateLimit.maxPerWindow);

module.exports = {
  RateLimiter,
  rateLimiterMiddleware: defaultLimiter.middleware(),
  defaultLimiter,
};
