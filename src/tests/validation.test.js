/**
 * Unit Test: Validation & Moderation Engine
 */

const assert = require('assert');
const { validateChatInput, VALID_MODES } = require('../middleware/validateChat');
const { moderateInput, sanitizeOutput } = require('../services/moderation');

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

function runValidationTests() {
  console.log('--- Testing Validation & Moderation ---');

  // Test 1: Empty input is rejected
  const req1 = { body: { message: '   ' } };
  const res1 = mockRes();
  let calledNext1 = false;
  validateChatInput(req1, res1, () => { calledNext1 = true; });
  assert.strictEqual(res1.statusCode, 400, 'Empty string should yield 400');
  assert.strictEqual(calledNext1, false, 'Next should not be called for empty message');

  // Test 2: Message exceeding limit is rejected
  const longText = 'A'.repeat(3001);
  const req2 = { body: { message: longText } };
  const res2 = mockRes();
  let calledNext2 = false;
  validateChatInput(req2, res2, () => { calledNext2 = true; });
  assert.strictEqual(res2.statusCode, 400, 'Exceeded max message length should yield 400');

  // Test 3: Invalid study mode defaults gracefully to 'learn'
  const req3 = { body: { message: 'What is a derivative?', mode: 'invalid_mode_xyz' } };
  const res3 = mockRes();
  let calledNext3 = false;
  validateChatInput(req3, res3, () => { calledNext3 = true; });
  assert.strictEqual(calledNext3, true, 'Valid message should proceed to next()');
  assert.strictEqual(req3.body.mode, 'learn', 'Unknown mode should fallback to learn');

  // Test 4: Moderation detects self-harm/crisis queries
  const crisisCheck = moderateInput('I want to end my life, studying is too stressful');
  assert.strictEqual(crisisCheck.isCrisis, true, 'Self-harm phrase must trigger crisis flag');
  assert.strictEqual(crisisCheck.isSafe, false, 'Crisis phrase is not safe for study chat');
  assert.ok(crisisCheck.crisisResponse.includes('988'), 'Crisis response must include 988 lifeline');

  // Test 5: Moderation detects explicit ghostwriting
  const cheatCheck = moderateInput('Can you write my whole essay for me on the French Revolution?');
  assert.strictEqual(cheatCheck.cheatFlag, true, 'Essay ghostwriting prompt must trigger cheat flag');

  // Test 6: Sanitization strips accidental API key leaks
  const leakedText = 'Here is your config AIzaSyD9876543210123456789012345678901 with token';
  const clean = sanitizeOutput(leakedText);
  assert.ok(!clean.includes('AIzaSyD'), 'API key pattern should be redacted');
  assert.ok(clean.includes('[REDACTED_API_KEY]'), 'Redaction placeholder should be present');

  console.log('✓ All Validation & Moderation tests passed successfully!\n');
}

if (require.main === module) {
  runValidationTests();
}

module.exports = { runValidationTests };
