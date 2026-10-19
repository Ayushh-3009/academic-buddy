/**
 * Prompt Orchestrator
 * Assembles dynamic system instructions combining base safety, study modes,
 * user personalization (grade level & goals), and explain-it-simply modifiers.
 */

const baseSafetyPrompt = require('./base-safety');
const learnPrompt = require('./learn');
const quizMePrompt = require('./quiz-me');
const teachItBackPrompt = require('./teach-it-back');
const examCrunchPrompt = require('./exam-crunch');
const chillReviewPrompt = require('./chill-review');

const MODE_PROMPTS = {
  'learn': learnPrompt,
  'quiz-me': quizMePrompt,
  'teach-it-back': teachItBackPrompt,
  'exam-crunch': examCrunchPrompt,
  'chill-review': chillReviewPrompt,
};

const EXPLAIN_LEVEL_MODIFIERS = {
  'middle_school': `
### ACTIVE EXPLAIN-IT-SIMPLY LEVEL: MIDDLE SCHOOL (APPROX. AGES 11-14)
- Explain everything in extraordinarily simple, intuitive language.
- Use fun, relatable everyday metaphors (video games, pizza, sports, animals).
- Avoid unnecessary academic jargon; define any essential technical terms simply.
`.trim(),

  'high_school': `
### ACTIVE EXPLAIN-IT-SIMPLY LEVEL: HIGH SCHOOL / AP (APPROX. AGES 15-18)
- Strike a balance between clear conceptual intuition and rigorous academic terminology.
- Frame explanations in the context of typical high school / AP / IB exam expectations and standard grading rubrics.
`.trim(),

  'college': `
### ACTIVE EXPLAIN-IT-SIMPLY LEVEL: UNDERGRAD / RIGOROUS (APPROX. AGES 18+)
- Provide mathematically rigorous, mechanistic, and formal explanations.
- Include derivation logic, boundary conditions, edge cases, and canonical proofs where appropriate.
`.trim(),
};

/**
 * Builds the complete system prompt for a study session
 * @param {Object} options
 * @param {string} options.mode - Study mode ('learn', 'quiz-me', etc.)
 * @param {string} options.explainLevel - 'off', 'middle_school', 'high_school', 'college'
 * @param {Object} options.user - User profile with gradeLevel, targetSubjects, studyGoals
 */
function buildSystemPrompt({ mode = 'learn', explainLevel = 'off', user = null } = {}) {
  const parts = [baseSafetyPrompt];

  // 1. User Personalization Layer
  if (user) {
    const grade = user.grade_level || user.gradeLevel || 'High School';
    let subjects = user.target_subjects || user.targetSubjects || [];
    let goals = user.study_goals || user.studyGoals || [];

    if (typeof subjects === 'string') {
      try { subjects = JSON.parse(subjects); } catch { subjects = [subjects]; }
    }
    if (typeof goals === 'string') {
      try { goals = JSON.parse(goals); } catch { goals = [goals]; }
    }

    parts.push(`
### STUDENT PROFILE PERSONALIZATION
- Student Grade Level: ${grade}
- Priority Focus Subjects: ${Array.isArray(subjects) && subjects.length > 0 ? subjects.join(', ') : 'All general coursework'}
- Primary Goals: ${Array.isArray(goals) && goals.length > 0 ? goals.join(', ') : 'Comprehension & exam preparation'}
- Tailor your vocabulary, pacing, and example difficulty to suit this student's grade level.
`.trim());
  }

  // 2. Study Mode System Prompt
  const modePrompt = MODE_PROMPTS[mode] || MODE_PROMPTS['learn'];
  parts.push(modePrompt);

  // 3. Explain-It-Simply Modifier
  if (explainLevel && EXPLAIN_LEVEL_MODIFIERS[explainLevel]) {
    parts.push(EXPLAIN_LEVEL_MODIFIERS[explainLevel]);
  }

  return parts.join('\n\n');
}

module.exports = {
  buildSystemPrompt,
  MODE_PROMPTS,
  EXPLAIN_LEVEL_MODIFIERS,
};
