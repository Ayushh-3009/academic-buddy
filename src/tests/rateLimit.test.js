/**
 * Unit Test: In-Memory Sliding Window Rate Limiter
 */

const assert = require('assert');
const { RateLimiter } = require('../middleware/rateLimiter');

function runRateLimiterTests() {
  console.log('--- Testing RateLimiter ---');

  // Test 1: Window allows requests up to max limit
  const limiter = new RateLimiter(1000, 3); // 3 requests per 1000ms
  const testKey = 'user:test_scholar_1';

  let res1 = limiter.isRateLimited(testKey);
  assert.strictEqual(res1.limited, false, '1st request should be allowed');
  assert.strictEqual(res1.remaining, 2, 'Remaining should be 2');

  let res2 = limiter.isRateLimited(testKey);
  assert.strictEqual(res2.limited, false, '2nd request should be allowed');
  assert.strictEqual(res2.remaining, 1, 'Remaining should be 1');

  let res3 = limiter.isRateLimited(testKey);
  assert.strictEqual(res3.limited, false, '3rd request should be allowed');
  assert.strictEqual(res3.remaining, 0, 'Remaining should be 0');

  // Test 2: 4th request must be rate limited
  let res4 = limiter.isRateLimited(testKey);
  assert.strictEqual(res4.limited, true, '4th request should be rate limited');
  assert.ok(res4.retryAfterSeconds > 0, 'Retry-after must be positive');

  // Test 3: Separate keys have independent quotas
  const otherKey = 'ip:192.168.1.1';
  let resOther = limiter.isRateLimited(otherKey);
  assert.strictEqual(resOther.limited, false, 'Independent key should not be limited by another user');

  clearInterval(limiter.cleanupInterval);
  console.log('✓ All RateLimiter tests passed successfully!\n');
}

if (require.main === module) {
  runRateLimiterTests();
}

module.exports = { runRateLimiterTests };
