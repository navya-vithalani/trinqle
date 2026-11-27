# Trinqle: v2 Plan

This is the plan for v2. It replaces ideas.md. The MVP docs (PRD.md, TRD.md, plan.md, design.md) describe v1. Where this file disagrees with them, this file wins, and the PRD "Decisions log" still holds for everything this file does not mention. Update PRD, TRD and design.md at the end of each step, not edit by edit.

## Product direction (applies to every decision below)

- The core of Trinqle is a few minutes each night: spend time with yourself and know yourself better. Features that add tracking pressure or turn the app into a planner do not belong in the journal core.
- Two goals at once: (1) the best possible app for the owner's own use; (2) something sensible for other people and good enough to show as a project. So nothing may be hyper-personal. Optional modules (like cycle tracking) are switchable.
- Offline-first and local-first stays. Data lives on the device and must be safe (Step 1).
- A chapter is a story. The Storybook is where a chapter ends, and everything the app does should help build it.
- Dashboard is for graphs and visualizations you look at or build. Insights are things the rule-based engine notices that you might not have noticed. We improve the generic engine rather than adding one-off insight types.
- There are no real users yet. Local data is test data, so schema changes may reset the database, and conversion code is only written when it is trivial. Do not over-protect old data, and do not delete data casually either: backups (Step 1B) and snapshots before user-initiated destructive actions still apply.
- Accessibility: keep text readable and the app usable. Respect reduced motion and do not rely on color alone for meaning. Do not spend more effort than that.

## How a chapter works

- A chapter lasts 20 to 45 days. A day ends at the **day boundary**: the end hour of the form window set in Profile (default 03:00). This one setting is used everywhere, including the logical date and the QOTD change time.
- On day 1 of a new chapter the app starts fresh. The Dashboard and Insights are empty because they only use the current chapter's data. The form carries over exactly as it was at the end of the previous chapter.
- Closing a chapter turns it into one Storybook in the Archive. Closed chapters are read-only, and their forms cannot be edited.
- The thin chapter banner on Home is the entry point for the chapter and its Storybook.
- When a chapter is created, the app stores a snapshot of the form on the chapter record (`formSnapshotStart`). At close, the existing frozen form snapshot is the end snapshot. The Storybook's then-vs-now spread compares the two by part id (added, removed, renamed, moved). No version history of the form is kept.
- Profile > Browse forms shows only the current chapter's form. Days from closed chapters can only be opened, read-only, from the calendar.

## How v2 is organised

1. **Step 1: Bugs, security and backup.** Make what exists correct and safe.
2. **Step 2: Simplify, then redesign.** First remove machinery (2.0), then change how existing things look and flow.
3. **Step 3: New features.**
4. **Later (v3/v4):** new character system, Planner module, sync and login, onboarding.

Rule: do not start a step until the previous step's exit checks pass. New bugs found later go to the Step 1 intake log. Removals and redesign ideas go to Step 2, new features to Step 3.

---

## Step 1: Bugs, security and backup

### 1A. Security & 1B. Backup & 1C. Bug Fixes (Completed in code)
- Pending phone/live deployment checks: configure fresh VAPID keys, `VAPID_SUBJECT`, `CRON_SECRET`, and Upstash KV in Vercel + GitHub Secrets (`CRON_SECRET`, `VERCEL_PROJECT_URL`), test push & backup restore drill on phone.


### 1D. Test data generator (form-driven)

**Problem:** `src/tools/demoData.ts` writes answers only for about 16 hardcoded starter-pack part IDs, and only seeds the form if the questions table is empty. On any custom form the IDs do not match, so dashboards are empty. Even on the starter form, the insights engine mostly sees the overall day rating, so it is untestable.

**Requirements:**
- **Form-driven.** It reads the active form and generates plausible values for every part by kind (scale, number, yes/no, text, library, time range, repeating sessions, gates and schedules respected).
- **Deterministic in structure, not in data.** The generator takes a spec, for example: N planted correlations, N lagged effects, N weekday patterns, N cycle-phase effects, N baseline shifts, N trends, N repeated-phrase patterns in text parts (for the text insights, 3C), N session-level item effects (for the session analysis, 3C). Each run picks different parts and different values, but always plants the same number of findings of each kind. A seed (shown in the UI) reproduces a run when wanted, and the default seed is random.
- **Realistic.** Shared hidden variables (for example energy, stress, sleep debt) make parts correlate naturally. Add weekday effects, drift, noise, missing days, partial days, backfilled days, library items and links, sleep ranges that cross midnight, short text from a phrase bank, sparse parts that are only answered now and then, question-of-the-day answers, closed chapters with reflection blocks, and cycles when cycle tracking is on.
- **Validation.** Run the insights engine on generated data and assert it recovers most planted effects, and that a "null" run with no planted effects produces few or no findings. This is the plan.md Phase 7 validation harness, finally tested against rich data.
- **Demo form pack.** Add a second sample form with many numeric parts (sleep, steps, water, screen time, mood, energy, stress and so on), so a fresh install can show what the analytics look like. This also becomes the base for a demo mode (Later).
- Keep it as a dev tool, gated behind a flag (see 1E).

### 1E. Hygiene
- Write the README (what it is, setup, scripts, env vars, deploy).
- Delete the stale `src/test/run_*.cjs/js` scripts. Keep one vitest config.
- Add ESLint, and drop the duplicate `tsc` from CI.
- Gate demo data and dev tools behind a dev flag so they are not in the production UI.
- Opportunistic: remove `any` where files are touched. Splitting the 1,300+ line files (`FormEditorScreen`, `NightlyFormModal`, `generator`) happens during the Step 2 rewrites, not as a separate refactor.

### 1F. End-to-end tests
- Add Playwright with a phone-sized viewport (for example 390 x 844), run in CI against the production preview build. Seed the test database with the generator (1D).
- Start with the flows that have already broken or matter most: fill and submit the nightly form (including answering No on a gate and still submitting), the session carousel staying inside its box and snapping, creating a chapter and editing its end date within the allowed bounds, a full backup and restore, and delete all data.
- Add layout assertions that catch horizontal overflow on the main screens at the phone width.
- Each later step adds the flows it introduces (listed in its exit checks). Keep unit tests for the engine and the data layer. End-to-end tests are for flows.

### Bug intake log
Add new bugs found during use here.

| # | What happens | What should happen | Where / how to reproduce | Status |
|---|--------------|--------------------|--------------------------|--------|
| | | | | |

### Step 1 exit checks
- [ ] Old VAPID keys removed from repo (verified). Live phone subscribe, test notification and unsubscribe pending Vercel/KV deployment.
- [x] Unauthenticated calls to `/api/send`, `/api/prefs` and `/api/unsubscribe` are rejected (verified in tests). Missing `CRON_SECRET` returns 500.
- [x] A subscribe request with a non-allowlisted endpoint, bad timezone or oversized body is rejected (verified in tests).
- [x] A failed KV write throws and non-test runs without KV fail with 503 instead of in-memory fallback (verified in tests).
- [x] Cron workflow fails red on non-2xx; late scheduler runs tested (21:12 -> due once). External phone push delivery pending Vercel deployment.
- [x] Hostile-SVG corpus & ZIP sticker re-sanitization & search XSS tests pass; CSP (`vercel.json`) added (live phone PWA check pending deployment).
- [x] Full backup, delete all, restore round-trip verified in Vitest (data logically equal, photos intact); live phone drill pending deployment.
- [x] Import runs inside one Dexie transaction after pre-validating schema/MIME/signatures.
- [x] F1: answering No on a gate lets the form submit. Tests cover gate, sub-question and `showWhen` cases.
- [x] F2 and F3 are fixed with tests (end-date edges; carousel layout in E2E in Phase 4).
- [ ] The generator produces a rich dataset on the starter form **and** on a custom form, and the engine recovers the planted findings.
- [x] Data health check runs read-only, reports problems on a deliberately broken test database, and takes a safety snapshot before fixes.
- [ ] End-to-end tests (1F) run in CI on a phone-sized viewport and pass.
- [ ] CI is green (tests, typecheck, lint, build).

---

## Step 2: Simplify, then redesign

Goal: same core purpose, far less machinery and a much better feel. Do 2.0 first, because it deletes code that the redesign would otherwise rewrite twice. Several screens get rewritten, so split the big files while doing it.

### 2.0 Simplify first (removals and data-model cleanup)

This is the first Dexie schema bump. Local data is test data, so the upgrade may reset the database. Write conversion code only if it is trivial.

- **R1. Remove question scheduling.** Delete `Question.schedule` (weekdays, chapter-end) and `Section.scope` (weekly, chapter-end). Every reachable question is asked every day. Everything that is not core is optional, and "missing is not zero" already handles sparse answers. This also deletes branches from `isQuestionVisible` and `checkCompleteness`. Weekly and monthly questions are gone. Update the starter pack, the PRD and the generator.
- **R2. Remove Quick/Full mode.** There is one form. Remove `mode` from the form flow, `expandedMore`, the quick-mode badges and the PRD success criteria that mention it.
- **R3. Chapter reflections leave the questions database.** There is no chapter-end section and no `ChapterAnswer` rows any more. Each chapter keeps its own freestyle reflection blocks (prompt plus answer) in a JSON field on the chapter record, with a short list of preset suggestions (long-term goal, philosophy, what I learned and so on) and custom blocks. The draft is saved in the same record while the chapter is open, and it is frozen with the chapter at close. The blocks become pages of the Storybook (3B).
- **R4. Heatmap becomes intensity based.** Day color depends on the share of reachable parts that were answered, in 5 steps using quantile buckets of the user's own data (like GitHub). The denominator excludes parts that were not reachable that day. All parts count equally.
- **R5. "Core" exists only in the form UI.** The part keeps its `level` flag (core or extra) only to drive the form UI: blocking submit and the required marking (2.1), and the editor. The database, calculator, engine, heatmap and Dashboard treat every part alike.
  - No answer always means empty (null), never 0. Delete the calculator rules that turn an unanswered core part into 0.
  - A core part must be answered to submit: yes/no chosen (the existing three-state control: blank, then yes, then no), scale chosen, number entered, time range set, text not empty, at least one library item. Someone who does not want to answer a part every day does not make it core. There is no "nothing to add" option.
  - Parts that are not reachable (gate, parent question, `showWhen`) have no row and are empty.
- **R6. Scales are always stored as 0 to 10.** `ScaleConfig` loses `min`, `max` and `step`, and gains `display` (slider, stars or blocks) and `divisions` (for example 3, 5, 7, 10 or 11). Tapping level i of n stores `(i - 1) / (n - 1) * 10`. All scales are comparable, and charts can overlay them. Changing the display or the number of divisions is cosmetic and applies to every day.
- **R7. Day header model.** `Day.oneliner` becomes `Day.highlights` (long text). `Day.overallRating` and `Day.memorability` are removed and replaced by `Day.feeling`, 1 to 5, which the engine reads as 0, 2.5, 5, 7.5 and 10. `stickerId` stays. The word and color fields arrive with 3D.
- **R8. Remove the cycle question from the form** (`special: 'cycle'`) and the update-cycle button and popup from the calendar. Cycle tracking gets its own page (2.7).
- **R9. Remove the character import UI.** Delete `CharacterImportDialog` and its import path. Characters are added in source code only. Custom stickers (SVG or raster uploads, auto-resized to 256 px) stay.

### 2.1 Nightly form

- **Day header (the first step).** Replaces the old setup page.
  - Row one: a **sticker tile** on the left (1/4 of the width). Tapping it expands a picker grid that shows only the sticker images, no names. The **title** of the day is on the right (3/4).
  - **Highlights:** a thicker text box styled like a journal entry, for venting about the day, up to 5,000 characters.
  - **Day feeling:** five blocks in a row with a neutral one in the middle: Miserable, Low, Neutral, Notable, Outstanding. One tap. This replaces both the 0 to 10 rating and the memorability choice.
  - One button: **Continue to form**. Remove the duplicate "Continue to questions" button and the Summary/Questions section header.
- **Bento grid.** Replace the one-part-below-the-other stack with a free-form bento layout. It is not a fixed number of columns or rows. Tiles fit wherever they fit (CSS grid with dense auto-placement). Example: a tall time-range tile on the left, two dropdowns side by side on the right, then a full-width text tile below. Each part kind has a default tile size (time range tall, yes/no and number small, scale and dropdown medium, text and library wide). A manual size override in the editor can come later.
- **Compact.** Sections and questions get tighter padding and headers. The form should feel much shorter.
- **Time-range tile.** A tall vertical 24-hour bar in about 1/4 to 1/3 of the width. The axis starts at 03:00 by default. If a session starts earlier (for example 21:00 the previous evening), the axis starts at that hour (rounded down) and still spans 24 hours. Selected sessions are highlighted segments, with small start and end labels on the bar if there is room. Tapping opens the clock editor. The form no longer shows the big time block. The other parts of that question sit to the right.
- **Core marking.** The label of a core part is in the accent color, semibold (optional labels stay regular weight), with a slow pulsing glow: a `text-shadow` in the accent color that animates between none and about 8px blur at about 40% opacity, on a 3 second ease-in-out infinite loop. Keep it subtle, like a twinkling star. With reduced motion, the glow is static. No italics. Remove the red borders, "required" text and "tap to check" text, and add no other boxes or cues. Weight and glow stay visible without color. When Save is pressed with something missing, scroll to the first missing part and pulse its label.
- **Reading view for a day.** Viewing a saved day is a separate page, not a disabled form. It reads like continuous text, with no input boxes. Only answered items are shown, and unanswered ones are collapsed into one line. An Edit button switches to the form look. It is opened from the day strips under the heatmap and calendar (2.6), including read-only days of closed chapters. It is not used in the Storybook.
- **Question of the day is not in the form.** After the form is saved, show a small soft prompt ("Want to answer today's question?") that opens the QOTD block (3A).

### 2.2 Form editor

- **Drag and drop.** Remove the up and down arrows. Long-press a question to lift it, drag it up or down, or drop it on a section tab to move it to another section. Parts inside a question reorder the same way. Use a library such as dnd-kit rather than hand-rolling touch dragging, and keep a "Move to..." menu for accessibility.
- **Draft and a single save.** Edits stay in a working copy. Nothing is applied until **Save**. Save shows a short summary ("2 added, 1 removed, 3 reordered") and applies everything in one transaction. Remove the existing "this chapter or next chapter" scope prompt (see below). Add Discard and an unsaved-changes guard on back.

**How edits apply.** Every section, question and part has `validFrom` and `validTo` dates, and a day always shows the form as it was on that date. All edits apply **from today**.
- **Remove** a question: it stops being asked. Earlier days keep it and their answers. No data is lost and no zeros are added.
- **Add** a question: it starts today. Earlier days do not have it and are not counted as missing.
- **Rename (typo), reorder, move between sections, color or icon, scale display or divisions:** apply to everything. No versioning.
- **Change kind or library:** treated as "remove the old part, add a new one" (new part id), because the values are not comparable. The editor says so before saving.
- **Targets (3D)** change from today the same way.
- **Same-day rule:** the effective date is the current logical day, or the next day if today's day is already saved as complete, so a saved day never becomes incomplete or loses visible answers.
- A chapter can therefore contain two versions of the form. The Storybook shows a "form then vs now" spread, computed from the chapter's start and end snapshots (see "How a chapter works").

### 2.3 Chapter screen
- The thin banner at the top of Home (chapter name and day count) is the single entry point for everything about the chapter and its Storybook. Remove the separate chapter-reflections block from Home.
- Tapping the banner opens the chapter screen: name, planned end date, reflection blocks and the Storybook builder and preview (3B).
- One **Done** button replaces the separate save, update end date and done buttons. Text fields (name, reflections) autosave as drafts so nothing is lost. The end date is applied and validated (F3) when Done is pressed.
- Everything on this screen stays editable until the chapter is closed. In the last 2 days only the end date is locked.

### 2.4 Dashboard
- **Toggle:** Premade | Explore. This replaces Questions | Libraries.
- **Explore moves from Insights to Dashboard.** Dashboard is for graphs and visualizations. The Insights tab is for observations the rule-based engine notices on its own. In this step Explore stays as it is (one factor against one outcome, in memory). The full chart builder is in 3D.
- **Filters:** merge the separate tags filter and the Libraries view into one library filter in the normal filter row, beside time range, scale and journal.
- **Remove the Chapter highlights box** from the dashboard. Highlights live in the Storybook (3B), not on a daily screen.

### 2.5 Appearance and themes
- **Remove light/dark mode.** Each theme is one look. Dark-native themes are separate themes, for example Baked Clay Light and Baked Clay Dark, built from a shared base plus overrides so there is no duplicated work. Newspaper and Retro are light only, Cyberpunk is dark only. Because the form is filled between 9 pm and 3 am, keep at least a few dark-native themes.
- Themes change colors, fonts, shapes and motion. They may also set card style, border style, textures, icon style, heading style and spacing through tokens and a few class switches. The layout is identical across themes. There are no per-theme layouts.
- Delete the dark-mode toggle and the dark token sets. Ignore the old stored dark setting. Each theme keeps its archive variant. Update the theme tests.
- **Theme freeze:** no new themes until the new system is done. The Storybook (3B) will later add cover art and paper style per theme.
- **One Appearance card in Profile** with a Theme row and a Character row. Each shows the current choice as a small preview and opens a bottom-sheet picker with previews. This replaces the long lists of buttons.

### 2.6 Day strips (heatmap and calendar)
- **Tapping a day on the heatmap** selects it and shows a strip **below the heatmap** about the process of that day: the day number and date, its title, "7 of 9 answered", a chip for every unanswered reachable part, and a **Fill in** button on the right. Tapping a chip, or **Fill in**, opens the form focused on that part (or the first unanswered part). This also works for a completely empty day. Today shows **Continue**. No overlay.
- Any day in the open chapter can be filled in or edited later. The backfill banner stays.
- **Tapping a day on the calendar** shows a strip **below the calendar** about the content of that day: the sticker, title, a short part of the highlights and the feeling (plus word and color when enabled, 3D), and an **Open** button that goes to the reading view. For a day in a closed chapter, the strip shows the same summary from the frozen chapter data, and Open goes to a read-only view.
- Legend: when the cycle phase layer is selected in the calendar (3D), show a legend for the phase colors (Menstrual, Follicular, Ovulatory, Luteal), each with one line of meaning, and make clear they are estimates.

### 2.7 Cycle page
Cycle tracking is a significant enough part of life tracking to deserve its own page.
- **Cycle tracking toggle** in Profile. Off by default for new installs. When off, the Cycle card, the page and the calendar phase layer are hidden, and insights that depend on cycles are not generated.
- **Home Cycle card** (only when on) opens a dedicated **Cycle page**.
- **Page content:** current status (day of the cycle, current phase name, predicted next start), **Start period** and **End period** buttons, a log for today or any past day, and the list of past cycles.
  - **Flow** (none, spotting, light, medium, heavy) is only offered on days inside a period.
  - **Symptoms** are chips available on any day: cramps, headache, bloating, tender breasts, fatigue, cravings, mood swings, back pain, nausea, acne. Plus an optional note.
  - **Past cycles:** each shows start, end, length and bleed days. Opening one shows its per-day flow and symptoms and lets you edit the start and end.
- **Data:** the existing `cycles` records (start and end) stay. A new `cycleLogs` record per date (id, date, flow, symptoms, note, timestamps).
- **Engine:** flow and symptom count are numeric metrics, and each symptom is a yes/no driver, available to Insights, Explore and calendar layers. The cycle phase is still derived from the cycles.
- The phase calendar is not on this page. Phases are only a calendar layer option (3D).

### Step 2 exit checks
- [ ] The schema upgrade runs (or resets) cleanly. The quick/full, schedule, scope, memorability and character-import code is gone, and CI is green.
- [ ] No code outside the form UI reads the core flag. An unanswered part is empty everywhere. Scales are stored 0 to 10.
- [ ] The day header has the sticker tile, title, highlights and five-block feeling selector, and one Continue button.
- [ ] The nightly form is a bento grid on a real phone: no overflow, much shorter, and the time-range tile follows the axis rule.
- [ ] Core parts use the pulsing glow and semibold label only. No red boxes.
- [ ] Reading view and edit view are separate and look different.
- [ ] The form editor supports long-press drag between sections and for parts, one Save, and all edits apply from today.
- [ ] The chapter banner on Home opens the chapter screen, which has one Done and loses no text. The separate reflections block is gone from Home. Reflection blocks work and are frozen at close.
- [ ] Dashboard has Premade | Explore, a merged library filter, and no highlights box.
- [ ] No light/dark toggle exists. Theme tests pass. Appearance is a single card.
- [ ] Tapping a heatmap day shows the fill-in strip, and tapping a calendar day shows the content strip with Open.
- [ ] The Cycle page works end to end, and no cycle UI remains in the form or calendar popup.
- [ ] The big files are split and no behaviour changed. The end-to-end tests (1F) are extended for the new flows.

---

## Step 3: New features

Build in the order given at the end of this step.

### 3A. Question of the day (QOTD)

A random prompt reveals more about you than a structured template does. Months later, reading your answer to a random question connects you to your past self. QOTD replaces the weekly and monthly questions.

- **Profile settings:** a QOTD toggle, a reminder toggle with a time, and a multi-select of prompt themes. Themes: Introspective, The outside world, Whimsical, Thought-provoking, Philosophical, Memories, Relationships, "What if" hypotheticals. Select all or any.
- **Prompt bank:** `src/content/qotd.json` with `{ id, text, themes[] }`. At least 400 prompts, so a year passes without repeats. They are drafted in batches and curated by the owner.
- **Picking:** the prompt for a day is chosen deterministically from the selected themes by a seeded shuffle without repeats. Prompts already answered are skipped, and the pool recycles the oldest first when it runs out. The prompt changes at the day boundary (see "How a chapter works"), not at a separate QOTD time.
- **Re-roll:** unlimited. Some days you want to push yourself with whatever you get, other days you want a particular kind of question, and both are fine. Each re-roll is counted per day (`rerolls`). Skipped prompts are not shown again soon.
- **Home block:** shows only the prompt, a small re-roll button, a text box, and after you write something, an **Add to storybook** button. Nothing else. No count, streak, character count or re-roll count on Home. It can be answered any time of day.
- **Not in the nightly form.** After the form is saved, a small soft prompt offers to open the block (2.1).
- **Reminder notification:** a fourth notification type. Notification prefs get `qotd` (boolean) and `qotdTime`. The text is generic (for example "Your question of the day is ready"), because the server does not know the prompt. It depends on the Step 1 push fixes (S1 to S5).
- **Tracking lives on the Dashboard.** The Dashboard streaks section gets QOTD stats: answered count, streak, a characters-per-day heatmap and a re-rolls-per-day heatmap. Characters per day is also a derived metric for Explore, pinned graphs and the calendar color layer. All of it follows the "Streaks and counts" setting (3D).
- **Data:** a new `qotd` table (id, date, promptId, **promptText snapshot**, themes, answer, inStorybook, rerolls, createdAt, updatedAt, deletedAt), one row per day. It is included in backups and frozen into the chapter at close. Answer limit 5,000 characters.
- Text-pattern insights (3C) and the Storybook read from it.

### 3B. Storybook

A chapter is a story, and the Storybook is how it ends: a structured keepsake you can read, not animated slides. Closing a chapter produces one Storybook in the Archive.

**How it works**
- The book can be built **across the whole chapter**. Everything about it is edited from the chapter screen, opened by the banner (2.3). "Add to storybook" buttons appear on QOTD answers, in the day reading view, on chart cards, on insight cards and on photos.
- The book is stored as a JSON structure on the chapter record: theme, cover settings and an ordered list of pages. It autosaves as a draft and is frozen at close. Charts and insights are saved as snapshots, so a book never changes when the engine does.
- **The book stays fully editable until the chapter is closed, including the last 2 days.** Nothing is locked into a "confirm only" step. If you did not build it during the chapter, you can do all of it in the closing ceremony. Building early just makes that lighter. The only thing that locks 2 days before the end is the end date (F3).
- **Closing ceremony:** review and edit the pages, **choose the book's theme** and cover, then confirm. Choosing the theme at closing means the app never has to track how long each theme was used. The default is the current theme. Confirming freezes the book.
- **Photos:** up to 10 per chapter, compressed to 1200 px when added (`photoCompression.ts`). The cover image counts toward the 10.

**Look**
- **Cover:** the chapter name, art based on the chosen theme, one image slot with a shape mask (square, circle, heart, diamond) and stickers from the existing sticker library.
- **Inside pages:** borders, paper style and overall vibe come from the theme (for example rusty paper for one theme).
- **Procedural first.** Cover art and paper come from CSS and SVG (gradients, patterns, borders, `feTurbulence` textures, `clip-path` masks) rather than illustrations. That keeps it offline and small, and avoids an art bottleneck. Illustrated covers per theme can be added later.

**Pages**
- Cover and back cover.
- **Highlights and numbers:** chapter name, your highlight text, and the split of days by feeling (how many Outstanding, Notable, Neutral, Low and Miserable days). Derived numbers such as nights journaled, most-used library item, total words written and QOTD answered. Streak numbers appear only if "Streaks and counts" is on (3D). There is no "time spent in the app" number.
- **Chosen days:** sticker, title, highlights, feeling and word of the day, optionally a photo. The reading view is not used here, and whole forms are not included, because details like coding times are not what a story needs.
- **Chosen QOTD answers.**
- **Chosen charts, insights and photos.** Charts built in Explore can be added with all their settings.
- **Reflection blocks:** freestyle prompt and answer pages (R3).
- **Form then vs now:** a two-page spread comparing the form at the start and at the end of the chapter, with a summary line ("3 added, 1 removed, 2 renamed"). Each side is a read-only outline in the style of the form editor, without action buttons, with badges for new, removed, renamed and moved parts. It compares the two snapshots by part id.
- **Time-use pages:** the polar clock and the day lines (3D) as snapshots.
- **Words page:** the chapter's words of the day as a word cloud (3D).
- **Color quilt:** one tile per day in its color of the day with its sticker (3D).

**Export:** a print stylesheet and PDF, plus sharing the cover as an image. The book is included in the chapter zip and the full backup.

**Slices** (scope is large, so details can be refined while building)
1. Data model, builder, cover, highlights and numbers, chosen days, QOTD, reflection blocks, two theme looks, PDF export.
2. Charts, insights, photos, the form then-vs-now spread, time-use, words and quilt pages.
3. The remaining theme looks, more cover shapes and sticker options, page-turn animation.

### 3C. Insights

#### Session-level analysis (high priority)
Today the calculator collapses a repeating question into one number per day (a mean, a sum or a count). That hides what matters: which person you enjoyed talking to, which subject you enjoyed studying, how long you spent on which problem. The link data already exists (each answer has a session number, and `AnswerLink` ties answers to library items).
- **Session table:** besides the daily table, the calculator produces one record per session (date, question, session number) holding that session's value for every part (scale, number, minutes, words) and its library items.
- **Analyses:**
  1. A per-item breakdown for each repeating question: for each item (person, subject, project, problem) the number of sessions, total and average minutes, the average of each scale or number part, and the best and worst items.
  2. Item against the rest, tested at session level (Mann-Whitney), with a minimum number of sessions per item and false-discovery correction.
  3. Correlations inside a question across sessions (for example session length against enjoyment).
  4. Each item's share of time.
- **Per-day series:** for each repeating question, and for each item within it, the number of sessions per day and the total minutes per day (when the question has a time-range part). They are daily metrics like any other: trend charts on the Dashboard, series in Explore, and inputs to the engine (for example more coding sessions on days you felt better). Per-item series show the top items or a chosen item.
- **Surfaces:** findings in Insights ("Sessions with Anna averaged 8.6 enjoyment, 3.1 above your other conversations"), per-item bars on the Dashboard (time per item, average per item), and "per item" as a grouping option in Explore.
- Daily-level analysis stays as it is.
- The generator (1D) plants session-level effects, so this can be tested.

#### Patterns in your writing
- A new category in Insights, separate from the numeric findings. It compares each text part with that part's own history, and works on QOTD answers and day highlights too.
- **What it finds:** phrases that repeat (2 to 4 word groups after removing common words), recurring names and topics, and entries that closely resemble an earlier one (for example a dream similar to one from two months ago).
- Every finding shows its evidence (the dates and the matching phrases) and is worded as a "possible pattern".
- Runs in the worker on the device, with no AI and no network. English stop-word list first. Needs a minimum number of entries per part (for example 5).
- The generator (1D) plants repeated phrases in text parts so thresholds can be tuned.

#### Derived time metrics and principle
- Check that the engine derives duration, start, end and midpoint from time-range parts, and add whatever is missing. Patterns such as sleep midpoint shifting between weekdays and weekends, or sleep duration drifting below baseline, must be found by the generic weekday and baseline rules. We do not build dedicated features for them.
- **Principle:** Dashboard is graphs and visualizations. Insights are things the rule-based engine notices that you might not have noticed. Improve the generic engine instead of adding specific insight types.

### 3D. Dashboard, Home, calendar and settings

#### Streaks and counts setting
A Profile setting. When off, streaks, completion percentages and counts are hidden everywhere (Home, Dashboard cards, heatmaps, Storybook numbers), and any individual graph can be switched on manually. It covers the existing yes/no heatmap cards (streak, completion percentage) and the QOTD stats. Default is on, as today.

#### Heatmap: on time vs added later
- Each heatmap cell is split by area into two colors: answers created **on time** (before the day boundary that ends that day) and answers **added later**. Example: 7 answered on the day and 3 added a week later gives a cell that is 70% one color and 30% the other. A fully backfilled day is entirely the "later" color.
- The intensity still comes from the total share answered (R4).
- A small corner dot marks a day whose answers were edited later (`editedAt`).
- Needs answer `createdAt` to be preserved when an answer is edited. Add a legend.

#### Time-use views (on the Dashboard)
- **Polar clock:** concentric rings, one per time-range part (Sleep, Coding, College and so on), covering 24 hours with the start of the day at the top (03:00, or earlier by the same axis rule as the form). Two modes: the average day over the chapter (from the existing `hourBins`), or one selected day. Each ring has its own color. Tapping a ring shows totals.
- **Day lines:** one horizontal line per day, stacked in date order, running across the 24-hour axis. Colored segments show how the day was spent. Color by part, or by library item. It makes sleep drift and constants visible (for example always at school or college between the same hours). Overlapping parts are drawn as thin parallel lanes inside the row.
- Both can be added to the Storybook as pages.

#### Day identifiers
- Every day can have three identifiers: a **sticker**, a **word** and a **color**. A Profile setting chooses which of them are used (any one, two or all three; default all). The day header shows only the chosen ones.
- **Word of the day:** one word describing the day, picked from a built-in "Words" library. The library is creatable, so you can type a new word. Stored as `Day.wordItemId`. Words count as library items, so they feed Insights, the library views and the Words page.
- **Color of the day:** one of 12 fixed swatches, stored as `Day.colorKey`. The swatches do not depend on the theme, so books stay stable.
- Uses: the calendar color layer ("Color of the day"), the Storybook color quilt page, and decoration.
- **Words page:** a Dashboard library view and a Storybook page showing the chapter's words as a word cloud, sized by frequency and tinted by the average feeling of those days.

#### Targets, Explore, pins and library views
- **Per-part daily targets** in the Form Builder. Target kinds: at least, at most, between, exactly, and yes (for yes/no). **"No target" is an explicit choice**, and it is the default, for parts where you simply do it or don't. Parts with a target get a goal line and a hit rate on charts. Parts with no target get neither. Target changes apply from today (2.2).
- **Explore chart builder** (the main way to build your own graphs):
  - **Series:** up to 4. Each picks a metric from any source: part metrics (yes/no done, scale value, number, minutes, words, library item count or one item's presence), day feeling, QOTD length and re-rolls, cycle flow and symptoms, word-of-day presence, and session-level metrics grouped per item (3C).
  - **Chart types:** line, bar, scatter (series A against series B) and pie or donut (for shares such as time per activity, library item share, yes/no split, feeling split).
  - **Options:** lag of 0 to 3 days, aggregation (daily, weekday average, 3-day or 7-day moving average), normalise to 0 to 100% so different units can share one axis, filters (library item or tag present, weekday, cycle phase, feeling range, only days where a yes/no part is yes), a trend line, and the Spearman correlation with the number of days and a one-line plain explanation.
  - **Scope:** the current chapter.
  - **Save:** stores the whole spec (title, type, series, filters, lag, aggregation, normalisation) in a new `savedCharts` table (id, spec, order, updatedAt, deletedAt). A list of saved charts is inside Explore, with edit, duplicate and delete.
  - **Use:** pin to Home, or add to the Storybook. A Storybook page keeps the spec and is rendered from a data snapshot taken at close.
  - It uses the same metric extraction as the engine.
- **Pinned graphs on Home.** A scrollable section of up to 5 graph cards. The defaults are the chapter heatmap and the calendar. Any dashboard chart or saved Explore chart can be pinned.
- **Library views.** Library item pages and the constellation view, as a way to view the library inside Dashboard.

#### Calendar v2
The heatmap and the calendar do different jobs, and both stay.
- The **chapter heatmap** shows how fully you used the journal in this chapter, day 1, 2, 3 and so on.
- The **calendar** is real dates across chapters, past and future, a view of your life over time.
- **Month view** you can swipe across all time.
- **Color layer (selectable):** any numeric or scale part (heat-style), any yes/no part (streak-style), the day feeling, the color of the day, QOTD length, or the **cycle phase bands** (when cycle tracking is on; the legend appears with it).
- **Symbols (always on):** one shape per day for the feeling, not dependent on color: star for Outstanding, diamond for Notable, triangle for Neutral, hollow circle for Low, filled dot for Miserable.
- Chapter boundaries are marked.
- **Tapping a day** shows the content strip below the calendar (2.6), not an overlay.
- It is built as a list of **layers**, so a later module can add its own layer. There are no tasks, goals or events in the journal (see "Later").

#### Small items
- **Date format** setting with presets: DD MMM YYYY, MMM DD YYYY, YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, and a short "18 AUG" style. One central `formatDate()` used everywhere.
- **Haptic tick** (Vibration API where supported) when a day is saved and when a chapter closes.
- **Home order:** thin chapter banner, Question of the day, the Cycle card (when cycle tracking is on), then the pinned graphs (heatmap and calendar by default), with the backup nudge when due.

### 3E. Parked (good ideas, not in v2)
- Sealed time capsule note. It fits the vibe but not the core loop.
- Chapter comparison.
- Mini experiments.
- Multi-chapter charts and analysis, including a timeline ribbon, a year-in-pixels or year-in-color view and cycle bands on long charts.
- Tasks, goals and events (see the Planner under "Later").

### Build order
1. QOTD and its reminder (3A). Independent, small, high value.
2. Session-level analysis (3C). The data is already there, and it changes what the app can tell you.
3. Storybook slice 1 (3B). Needs the reflection blocks (R3), the reading view (2.1) and QOTD.
4. Text-pattern insights (3C).
5. Time-use views, day identifiers and the Words page (3D).
6. Streaks and counts setting, targets, the heatmap split and library views.
7. Explore chart builder, saved charts, pinned graphs and calendar v2.
8. Date format and the haptic tick (small, any time).
9. Storybook slices 2 and 3.

### Step 3 exit checks
- [ ] QOTD: the same prompt all day, changes at the day boundary, unlimited re-rolls are counted, Home shows nothing but the prompt, text box and storybook button, the reminder arrives at the chosen time, and it survives backup and restore.
- [ ] Session-level analysis finds the planted per-item effects in generated data (and stays quiet on the null run), and the Dashboard shows per-item time and averages.
- [ ] A chapter can be built up over weeks or entirely in the last 2 days, closed with the closing ceremony, exported to PDF, and the book is unchanged afterwards.
- [ ] Text-pattern insights find the planted repeated phrases in generated data and stay quiet on the null run.
- [ ] The polar clock and day lines render from real and generated data, and can be added to a book.
- [ ] Day identifiers follow the Profile setting. The word, color and quilt work.
- [ ] With "Streaks and counts" off, no streak, completion percentage or count is visible anywhere unless a graph is switched on manually.
- [ ] The heatmap shows the on-time and added-later split.
- [ ] Explore can build, save, edit, pin and add-to-book a chart with every option, and a saved chart reopens with all its settings.
- [ ] Targets, saved charts, pinned graphs and the calendar work, and are included in the full backup.
- [ ] End-to-end tests (1F) cover the new flows.

---

## Later (v3 / v4)

### New character system
- **Why the current approach fails:** characters are hand-drawn SVGs animated with CSS transforms and guessed pivot points. There is no rig, no skeleton and no state machine, so animation can never look professional.
- **Goal:** characters that look and animate like real game or app characters.
- **Direction:** design characters in a tool made for 2D character animation, and play them in the app through a runtime. Candidates to evaluate (check current licensing, pricing and bundle size first):
  - **Rive:** rigged vector animation with state machines, made for interactive characters in apps, with a web runtime. Likely the best fit.
  - **Lottie:** great for one-shot animations, little interactivity.
  - **Spine:** mature skeletal 2D animation, paid editor.
  - Live2D or DragonBones are a weaker fit.
- **Requirements:** works offline (bundle the assets), reacts to the existing events (tap, saved, locked, chapter closed), adapts to the archive (grayscale) look, small size.
- **First step:** a one-day spike. One character in the chosen tool, wired into `CharacterStage`, compared with today. Then decide. Until then, all 8 characters stay and F9 is the only fix.

### Planner module (tasks, goals, events)
- Tasks, a planning calendar and events are a different product from the journal. They do not belong in the core, and the journal calendar stays journal-only.
- Shape: a separate module in the same repo, with its own screens, its own IndexedDB database and its own install scope, so it can be installed on its own. The journal links to it through a narrow read-only contract such as "day signals" (`{ date, key, value }`, for example `tasks_completed`). The journal imports them as derived metrics, so Dashboard, Insights and the calendar layers can use them.
- Not before the journal is solid.

### Sync and login
- It needs auth, a server database, sync with conflict handling, photo storage and responsibility for storing diaries. Records already have UUIDs and tombstones, which helps. Step 1 (full backup and snapshots) covers data loss until then.

### Onboarding and public-ready
- Starter packs (a minimal one, a wellness one, a student one), a demo mode that uses the generator, a first-run flow (welcome, starter pack, name, character, theme, form window, first chapter, notifications later), a good README with screenshots, an architecture write-up (offline-first, effective-dated forms, stats engine) and a simple landing page.
