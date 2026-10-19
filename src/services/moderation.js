/**
 * Moderation & Safety Guardrails Service
 * Detects self-harm, violence, harassment, and cheating exploits.
 */

// Self-harm & crisis patterns requiring immediate compassionate intervention
const CRISIS_PATTERNS = [
  /\b(kill|end)\s+(my\s*self|my\s*life)\b/i,
  /\b(suicide|suicidal)\b/i,
  /\bwant\s+to\s+die\b/i,
  /\bself[\s-]*harm\b/i,
  /\bcutting\s+my\s*(wrists|skin)\b/i,
  /\bdon'?t\s+want\s+to\s+(live|exist)\s+(any\s*more|anymore)\b/i,
  /\bbad\s+thoughts\s+about\s+hurting\s+myself\b/i,
];

// Explicit essay/homework ghostwriting patterns
const ACADEMIC_CHEAT_PATTERNS = [
  /\bwrite\s+(my|an?)\s+(entire|full|whole)?\s*(essay|paper|term\s*paper|assignment)\s+for\s+me\b/i,
  /\bjust\s+give\s+me\s+the\s+answers?\s+to\s+(test|quiz|exam|homework)\b/i,
  /\bdo\s+my\s+homework\s+for\s+me\b/i,
  /\bwrite\s+this\s+so\s+turnitin\s+won'?t\s+detect\s+it\b/i,
];

const CRISIS_INTERVENTION_RESPONSE = `
It sounds like you're going through a really painful and overwhelming moment right now, and I want you to know that you are not alone and your life matters.

Because I'm an AI study assistant, I cannot provide the real human care and support you deserve, but there are compassionate, trained people ready to listen and help right now—for free, 24/7, and completely confidential:

💙 **In the US & Canada:** Call or text **988** (The Suicide & Crisis Lifeline)
💬 **Crisis Text Line:** Text **HOME** to **741741**
🌈 **The Trevor Project (LGBTQ youth):** Call **1-866-488-7386** or text **START** to **678-678**
🌍 **International:** Find local support in your country at [https://findahelpline.com](https://findahelpline.com)

Please consider stepping away from your studies and talking to a family member, school counselor, or trusted adult. You don't have to carry this alone.
`.trim();

/**
 * Checks incoming user message for safety and integrity concerns
 * @param {string} text - User input string
 * @returns {Object} result - { isSafe, isCrisis, crisisResponse, cheatFlag }
 */
function moderateInput(text) {
  if (!text || typeof text !== 'string') {
    return { isSafe: true, isCrisis: false, cheatFlag: false };
  }

  // 1. Check for crisis / self-harm triggers
  for (const pattern of CRISIS_PATTERNS) {
    if (pattern.test(text)) {
      return {
        isSafe: false,
        isCrisis: true,
        crisisResponse: CRISIS_INTERVENTION_RESPONSE,
        cheatFlag: false,
      };
    }
  }

  // 2. Check for explicit homework dump/ghostwrite requests
  let cheatFlag = false;
  for (const pattern of ACADEMIC_CHEAT_PATTERNS) {
    if (pattern.test(text)) {
      cheatFlag = true;
      break;
    }
  }

  return {
    isSafe: true,
    isCrisis: false,
    cheatFlag,
  };
}

/**
 * Sanitizes output to remove any sensitive leaked environment or prompt keys
 * @param {string} text
 * @returns {string} sanitized
 */
function sanitizeOutput(text) {
  if (!text || typeof text !== 'string') return '';
  // Mask any possible API key or JWT accidental leaks
  return text
    .replace(/AIza[0-9A-Za-z_\-]{30,45}/g, '[REDACTED_API_KEY]')
    .replace(/eyJ[a-zA-Z0-9_\-]+\.eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/g, '[REDACTED_TOKEN]');
}

module.exports = {
  moderateInput,
  sanitizeOutput,
  CRISIS_INTERVENTION_RESPONSE,
};
