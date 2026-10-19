# Academic Buddy — Design System & Style Guide
**The Cozy, Modern AI Study Companion for High School & College Students**

---

## 1. Brand Identity & Core Philosophy

### Brand Essence
**Academic Buddy** (accompanied by its friendly mascot **Studi**) is an AI-powered study companion designed for students (ages 14–24) who are tired of superficial homework-cheating tools and late-night panic. Academic Buddy bridges the gap between high-tech AI reasoning and the warm, grounding comfort of a cozy study desk.

### Brand Archetype & Tone of Voice
- **Tone:** Encouraging, casual, smart, and empathetic. Never corporate, dry, or condescending.
- **Vibe:** A warm cup of matcha latte, rain tapping against the library window, soft lo-fi beats, clean notebook pages, paired with razor-sharp Socratic AI explanations.
- **The Golden Rule:** *We build your brain, not bypass it.* Studi coaches and hints; it never writes canned essays or encourages academic dishonesty.

---

## 2. Color Palette & Theming

Academic Buddy features two fully calibrated color modes:
1. **Daybreak Study Mode (Light Theme):** Warm cream/oatmeal background, warm charcoal typography, gentle stone borders, balanced by electric indigo and cyan for AI details.
2. **Late-Night Study Mode (Dark Theme):** Deep midnight slate, soft moonlight typography, glowing indigo and amber accents calibrated to prevent late-night eye strain and melatonin disruption.

### Color Tokens

| Token Name | Light Theme ("Daybreak") | Dark Theme ("Late-Night") | Usage |
| :--- | :--- | :--- | :--- |
| `--bg-primary` | `#FAF7F2` (Oatmeal Cream) | `#0A0E17` (Midnight Slate) | Main page canvas |
| `--bg-secondary` | `#F3EFE8` (Warm Sand) | `#121826` (Dark Navy Slate) | Section alternates, navbars |
| `--bg-card` | `#FFFFFF` (Pure White) | `#192132` (Desk Slate Card) | Elevated cards & modals |
| `--bg-card-subtle` | `#F6F2EC` (Inset Beige) | `#141C2B` (Inset Navy) | Inputs, inner code blocks |
| `--text-primary` | `#1C1917` (Warm Stone) | `#F1F5F9` (Moonlight White) | Headlines, primary text (WCAG AAA) |
| `--text-secondary` | `#57534E` (Warm Charcoal) | `#A0ABBA` (Cool Slate) | Subheads, body copy (WCAG AA) |
| `--text-muted` | `#8A8175` (Muted Sand) | `#64748B` (Muted Navy) | Timestamps, footers, hints |
| `--accent-primary` | `#4F46E5` (Electric Indigo) | `#6366F1` (Bright Indigo) | Primary CTAs, active tabs, AI aura |
| `--accent-cyan` | `#0EA5E9` (Electric Sky) | `#38BDF8` (Glowing Cyan) | Tech accents, spark glows |
| `--accent-peach` | `#F97316` (Warm Peach/Amber) | `#FB923C` (Warm Sunset) | Streaks 🔥, study mugs ☕, energy |
| `--accent-sage` | `#10B981` (Calming Sage) | `#34D399` (Mint Glow) | Mastery %, success badges, checkmarks |
| `--border-subtle` | `#E7E0D6` (Warm Stone Border) | `#242F45` (Slate Border) | Card dividers, outlines |
| `--border-strong` | `#D6CCC0` (Defined Border) | `#334155` (Emphasized Slate) | Interactive element borders |

---

## 3. Typography System

### Typefaces
- **Primary Body & Display:** `Plus Jakarta Sans`
  - *Weights:* 400 (Regular), 500 (Medium), 600 (Semi-Bold), 700 (Bold), 800 (Extra Bold).
  - *Characteristics:* Friendly geometric humanist sans-serif with open apertures and high legibility on mobile screens.
- **Technical & Accents:** `JetBrains Mono` / `Space Mono`
  - *Weights:* 500 (Medium), 700 (Bold).
  - *Characteristics:* Crisp monospace used for LaTeX equations, code snippets, keyboard shortcuts, XP numbers, and study metric tags.

### Type Hierarchy

```css
/* Typography Scale */
h1           { font-size: clamp(2.4rem, 5vw + 1rem, 4.0rem); line-height: 1.15; font-weight: 800; letter-spacing: -0.035em; }
h2           { font-size: clamp(1.85rem, 3.5vw + 0.5rem, 2.75rem); line-height: 1.20; font-weight: 700; letter-spacing: -0.03em; }
h3           { font-size: clamp(1.25rem, 2vw + 0.2rem, 1.6rem); line-height: 1.30; font-weight: 700; }
h4           { font-size: 1.15rem; line-height: 1.35; font-weight: 700; }
p (lead)     { font-size: 1.15rem; line-height: 1.65; font-weight: 400; }
p (body)     { font-size: 1.00rem; line-height: 1.68; font-weight: 400; }
small / tag  { font-size: 0.82rem; line-height: 1.40; font-weight: 600; text-transform: uppercase; }
```

---

## 4. Spacing, Radii & Shadows

### Spacing System
- Micro: `4px`, `8px`, `12px`
- Component: `16px`, `24px`, `32px`
- Section: `56px` (Mobile) to `88px` (Desktop)
- Container max-width: `1200px` with `1.5rem` horizontal padding.

### Border Radii
- Pill Buttons / Badges: `9999px` (`--radius-pill`)
- Feature Cards & Modals: `20px` to `28px` (`--radius-lg`, `--radius-xl`)
- Inputs & Compact Buttons: `14px` (`--radius-md`)
- Topic Chips & Sub-cards: `8px` (`--radius-sm`)

### Elevation & Shadows
- `--shadow-sm`: `0 2px 6px rgba(28, 25, 23, 0.04)` (subtle buttons)
- `--shadow-md`: `0 8px 24px rgba(28, 25, 23, 0.06)` (cards & hover states)
- `--shadow-xl`: `0 24px 60px rgba(28, 25, 23, 0.12)` (hero mockup, modals, dashboard)
- `--shadow-glow`: `0 0 35px rgba(79, 70, 229, 0.2)` (AI elements & active orb)

---

## 5. Component Design Specifications

### 1. Primary Buttons (`.btn-primary`)
- **Background:** `linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)`
- **Text:** Crisp White, `font-weight: 600`, `letter-spacing: -0.01em`
- **Shadow:** `0 4px 14px rgba(79, 70, 229, 0.35)`
- **Hover:** `transform: translateY(-2px)`, expanded shadow.
- **Focus:** `3px solid var(--accent-primary)`, `3px offset`.

### 2. Secondary & Warm Peach Buttons (`.btn-secondary`, `.btn-peach`)
- Secondary: Clean card background with defined stone border and subtle hover tint.
- Peach: Vibrant orange-to-amber gradient for streak actions, Pomodoro starts, and celebratory rewards.

### 3. Study Desk Cards (`.feature-card`, `.subject-card`)
- Clean surface with soft 1px border.
- Hover reveals a sleek gradient indicator line across the top edge (`indigo` to `cyan`).
- Smooth 4px vertical lift.

### 4. Interactive 3D Flashcard (`.flashcard-card-3d`)
- 3D CSS perspective (`1000px`) with double-sided rotation (`rotateY(180deg)`).
- Front features subject badge, question text, and click-to-flip hint.
- Back features solution breakdown, conceptual intuition, and XP mastery triggers.

---

## 6. Section-by-Section Written Copy Deck

### Section 1: Navigation Bar
- **Brand:** `Academic Buddy` (Badge: "Meet Studi ☕")
- **Links:** Features, How It Works, Live Demo, Subjects, Modes, FAQ.
- **Actions:** Light/Late-Night Mode Toggle, "Log In", "Start Studying Free" (Primary CTA).

### Section 2: Hero Section
- **Pill Badge:** `🟢 Say hello to Studi — your 24/7 AI pair-learner`
- **Headline:** `The AI study buddy who actually helps you understand, not just cheat.`
- **Subheadline:** `Tired of robotic answers and late-night panic? Academic Buddy breaks down impossible concepts step-by-step, turns messy lecture slides into active flashcards, and coaches you to conquer exams with real confidence.`
- **Primary CTA:** `Try it free — no card needed →`
- **Secondary CTA:** `Watch 90s demo ▶`
- **Trust Strip:** `✓ Free to start` • `✓ No credit card` • `✓ COPPA & FERPA Safe`
- **Live Mockup Content:**
  - *Student:* "Hey Studi, my teacher said enzyme inhibition will be 40% of tomorrow's exam and my brain is totally fried. Can you explain competitive vs non-competitive without the textbook jargon? 😭"
  - *Studi:* "Take a breath, Alex! You've got this. Let's imagine an arcade claw machine... [Intuitive analogy + Socratic prompt question]."

### Section 3: Social Proof Strip
- **Student Count:** `150,000+ Students Learning Across 850+ Schools`
- **Rating:** `★ 4.9 / 5 across 12,400+ Verified Reviews`
- **School Badges:** Stanford, UC Berkeley, MIT, NYU, Austin High, Oakridge Prep.

### Section 4: Features Grid (8 Core Features)
1. **24/7 Socratic AI Tutor:** Never get stuck at 2 AM again. Studi talks you through thorny math problems, coding bugs, and lab reports without giving away lazy answers.
2. **Instant Spaced Flashcards:** Turn 60 textbook pages into an intelligent Leitner flashcard deck in 5 seconds. Smarter spaced repetition ensures you remember come finals.
3. **Auto-Generated Quizzes:** Simulate actual test conditions with multiple-choice, free-response, and AP-style prompts that predict where you'll lose points before your teacher does.
4. **Multimodal Note Summarizer:** Upload messy PDF syllabi, 90-slide PowerPoint presentations, or messy whiteboard snapshots. Get organized bullet summaries and key formula cheat sheets.
5. **Smart Study Schedule:** Upload your syllabus and let Studi build a gentle, non-stressful day-by-day roadmap that adapts automatically whenever life or social plans get in the way.
6. **Cozy Pomodoro & Lofi Audio:** Stay in flow with customizable 25/5 focus intervals, soft ambient rain, fireplace crackles, and gentle notifications to stretch and drink water.
7. **5-Level "Explain-It-Simply":** Toggle the complexity of any tough concept between 5 intuitive tiers: ELI5, Middle School, High School, AP/Honors, and Rigorous Undergrad proof.
8. **Hands-Free Voice Study Mode:** Review your flashcards and test vocab while walking your dog, riding the bus, or folding laundry with natural conversational voice audio.

### Section 5: How It Works
- **Step 1: Upload your material** — Drop your lecture slides, textbook chapter PDF, or snap a quick photo of your handwritten notebook.
- **Step 2: Ask or choose a mode** — Pick what you need today: a deep Socratic walkthrough, rapid active-recall flashcards, or a high-yield formula summary.
- **Step 3: Practice and quiz** — Studi quizzes you on weak spots, gives real-time guidance when you miss a question, and never lets you rely on passive re-reading.
- **Step 4: Track your progress** — Watch your topic mastery score climb toward 100%, keep your study streak burning bright, and walk into class relaxed.

### Section 6: Interactive Demo Section
- **Tabs:** 1. Live AI Tutor Chat | 2. 3D Flashcard Deck | 3. Smart Practice Quiz.
- **Live Chat Prompts:** Biology (Mitochondria), Calculus (Chain Rule), History (Thesis Doctor), Python (Recursion Base Cases).
- **Interactive Flashcard:** Calculus $\ln(x)$ derivative with flip physics and +15 XP rewards.
- **Interactive Quizzer:** Neurotransmitter active recall question with instant feedback and pedagogical explanation.

### Section 7: Subjects & Levels
- **Filter Tags:** All Subjects, Math, Science, History & Writing, Coding, Languages, Test Prep.
- **Curriculum Breadth:** High School Algebra through College Multivariable; AP Biology to Organic Chemistry mechanisms; AP CSA to College Data Structures; SAT, ACT, AP, IB prep.

### Section 8: Study Modes
- **1. Learn:** Deep conversational comprehension with step-by-step visual analogies.
- **2. Quiz Me:** Rapid adaptive active-recall testing.
- **3. Teach It Back:** Feynman Technique roleplay where you teach Studi.
- **4. Exam Crunch:** High-yield rapid formula review when time is limited.
- **5. Chill Review:** Low-pressure audio flashcards and cozy lofi chords.

### Section 9: Progress & Motivation (Dashboard Preview)
- **Top Row:** 14-Day Streak 🔥, 3,420 XP ⭐, 8.5 / 10h Weekly Goal.
- **Mastery Meters:** Calculus BC (94%), AP Biology (88%), AP US History (78%).
- **Studi Daily Note:** "You crushed 32 flashcards before 10 PM tonight. Get some good REM sleep so your hippocampus can lock those concepts into long-term memory!"
- **Badges:** Night Owl, Bio Slayer, 100 Flashcards, Perfect Quiz, Syllabus Master, 14-Day Streak.

### Section 10: Responsible AI & Academic Integrity
- **Comparison Table:**
  - *Generic Cheat Bots:* Spits out plagiarized paragraphs, solves equations with zero explanation, sells student data to open models.
  - *Academic Buddy:* Uses Socratic guidance, trains neural recall for closed-book exams, 100% COPPA/FERPA compliant.

### Section 13: FAQ Accordion
1. *Is Academic Buddy really free to start?* (Yes, 100% free starter plan with no credit card).
2. *Will Studi just do my homework for me?* (No, it uses Socratic coaching to help you understand).
3. *Is my data private, safe, and FERPA/COPPA compliant?* (Yes, strict privacy with zero data sales).
4. *Can I use Academic Buddy on my phone or tablet?* (Yes, fully mobile-first with camera OCR).
5. *What file formats can I upload for summaries?* (PDFs, PPTX slides, DOCX, images, TXT).
6. *How does "Late-Night Study" mode protect my eyes?* (Low blue-light calibrated palette).
7. *Can I export flashcards to Anki or Quizlet?* (Yes, one-click export).

### Section 14: Final CTA Banner
- **Heading:** `Ready to stop cramming and start understanding?`
- **Body:** `Join over 150,000 students who study faster, retain more, and walk into exam rooms relaxed and confident. Your first study session starts in 45 seconds.`
- **Email Form:** Quick email input + "Start Free Trial →" button.
- **Guarantee:** `✨ Free forever starter plan • No credit card required • Cancel anytime`

### Section 15: Footer
- **Product:** AI Tutor Chat, Flashcards & Quizzes, Slide & PDF Parser, Feynman Teach-Back, Streak & XP Tracker.
- **Resources:** Study Tips Blog, Calculus Quick Sheets, AP Exam Countdown 2026, Help Center, Educator Partnerships.
- **Legal:** Honor Code & AI Ethics, Privacy Policy, Terms of Service, FERPA / COPPA Info, Parent & School Guide.
- **The Sunday Study Cram:** 3-minute weekly study newsletter signup.
- **Socials & Language:** Discord, X, YouTube, Language Selector (English, Spanish, French, German, Japanese).

### Extra Modals & Pages
- **Auth Modal:** Seamless tab toggle for Sign Up and Log In with Google, Apple, and Email.
- **Onboarding Modal:** 3-step interactive onboarding asking grade level, difficult subjects, and study goals.
- **Video Demo Modal:** Simulated study session player with instant launch CTA.
- **Cookie Consent Banner:** Accessible privacy notification with "Essential Only" and "Got It" triggers.
- **404 Page (`404.html`):** Playful "Lost notes at the bottom of your backpack" study break page with search and quick return links.
