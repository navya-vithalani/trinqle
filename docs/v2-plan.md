# Trinqle: v2 Plan

This is the plan for **v2**, starting on top of the completed **v1.0.0** baseline (where security, full-database backups, safety snapshots, Data Health Check, form-driven demo generator, ESLint, and mobile Playwright E2E are complete and verified). Where this file disagrees with legacy MVP docs, this file wins. Update `PRD.md`, `TRD.md`, and `design.md` at the end of each step.

## Product direction (applies to every decision below)

- The core of Trinqle is a few minutes each night: spend time with yourself and know yourself better. Features that add tracking pressure or turn the app into a planner do not belong in the journal core.
- Two goals at once: (1) the best possible app for the owner's own use; (2) something sensible for other people and good enough to show as a project. So nothing may be hyper-personal. Optional modules (like cycle tracking) are switchable.
- Offline-first and local-first stays. Data lives on the device and stays protected via persistent storage, full backups, and automatic safety snapshots.
- A chapter is a story. The Storybook is where a chapter ends, and everything the app does should help build it.
- Dashboard is for graphs and visualizations you look at or build. Insights are things the rule-based engine notices that you might not have noticed. Improve the generic engine rather than adding one-off insight types.
- Local schema upgrades in v2 may reset the database when conversion is non-trivial, backed by full-backup export and safety snapshots before destructive actions.
- Accessibility: keep text readable and the app usable. Respect reduced motion and do not rely on color alone for meaning.

## How a chapter works

- A chapter lasts **20 to 45 days**. A day ends at the **day boundary**: the end hour of the form window set in Profile (default `03:00`). This one setting is used everywhere, including the logical date and the QOTD change time.
- On day 1 of a new chapter the app starts fresh. The Dashboard and Insights are empty because they only use the current chapter's data. The form carries over exactly as it was at the end of the previous chapter.
- Closing a chapter turns it into one Storybook in the Archive. Closed chapters are read-only (enforced at the IndexedDB hook level), and their forms cannot be edited.
- The thin chapter banner on Home is the entry point for the chapter and its Storybook.
- When a chapter is created, the app stores a snapshot of the form on the chapter record (`formSnapshotStart`). At close, the existing frozen form snapshot is the end snapshot. The Storybook's then-vs-now spread compares the two by part id (added, removed, renamed, moved). No version history of the form is kept.
- Profile > Browse forms shows only the current chapter's form. Days from closed chapters can only be opened, read-only, from the calendar.

## How v2 is organised

1. **Step 2: Simplify, then redesign.** First remove machinery (2.0), then change how existing things look and flow.
2. **Step 3: New features.** QOTD, Storybook, session/text insights, Explore chart builder, day identifiers.
3. **Later (v3/v4):** new character system, Planner module, sync and login, onboarding.

---

## Step 2: Simplify, then redesign

Goal: same core purpose, far less machinery and a much better feel. Do 2.0 first, because it deletes code that the redesign would otherwise rewrite twice. Several screens get rewritten, so split the large files (`FormEditorScreen`, `NightlyFormModal`, `generator`) while doing it.

### 2.0 Simplify first (removals and data-model cleanup)

This is the first Dexie schema bump. Local data is test data, so the upgrade may reset the database. Write conversion code only if it is trivial.

- **R1. Remove question scheduling.** Delete `Question.schedule` (weekdays, chapter-end) and `Section.scope` (weekly, chapter-end). Every reachable question is asked every day. Everything that is not core is optional, and "missing is not zero" already handles sparse answers. This also deletes branches from `isQuestionVisible` and `checkCompleteness`. Weekly and monthly questions are gone. Update the starter pack, the PRD and the generator.
- **R2. Remove Quick/Full mode.** There is one form. Remove `mode` from the form flow, `expandedMore`, the quick-mode badges and the PRD success criteria that mention it.
- **R3. Chapter reflections leave the questions database.** There is no chapter-end section and no `ChapterAnswer` rows any more. Each chapter keeps its own freestyle reflection blocks (prompt plus answer) in a JSON field on the chapter record, with a short list of preset suggestions (long-term goal, philosophy, what I learned and so on) and custom blocks. The draft is saved in the same record while the chapter is open, and it is frozen with the chapter at close. The blocks become pages of the Storybook (3B).
- **R4. Heatmap becomes intensity based.** Day color depends on the share of reachable parts that were answered, in 5 steps using quantile buckets of the user's own data (like GitHub). The denominator excludes parts that were not reachable that day. All parts count equally.
- **R5. "Core" exists only in the form UI.** The part keeps its `level` flag (core or extra) only to drive the form UI: blocking submit and the required marking (2.1), and the editor. The database, calculator, engine, heatmap and Dashboard treat every part alike.
  - No answer always means empty (`null`), never 0. Delete the calculator rules that turn an unanswered core part into 0.
  - A core part must be answered to submit: yes/no chosen (blank -> yes -> no), scale chosen, number entered, time range set, text not empty, at least one library item. Someone who does not want to answer a part every day does not make it core.
  - Parts that are not reachable (gate, parent question, `showWhen`) have no row and are empty.
- **R6. Scales are always stored as 0 to 10.** `ScaleConfig` loses `min`, `max` and `step`, and gains `display` (slider, stars or blocks) and `divisions` (for example 3, 5, 7, 10 or 11). Tapping level `i` of `n` stores `(i - 1) / (n - 1) * 10`. All scales are comparable, and charts can overlay them. Changing the display or the number of divisions is cosmetic and applies to every day.
- **R7. Day header model.** `Day.oneliner` becomes `Day.highlights` (long text). `Day.overallRating` and `Day.memorability` are removed and replaced by `Day.feeling`, 1 to 5, which the engine reads as 0, 2.5, 5, 7.5 and 10. `stickerId` stays. The word and color fields arrive with 3D.
- **R8. Remove the cycle question from the form** (`special: 'cycle'`) and the update-cycle button and popup from the calendar. Cycle tracking gets its own page (2.7).
- **R9. Remove the character import UI.** Delete `CharacterImportDialog` and its import path. Characters are added in source code only. Custom stickers (SVG or raster uploads, auto-resized to 256 px) stay.

### 2.1 Nightly form

- **Day header (the first step).** Replaces the old setup page.
  - Row one: a **sticker tile** on the left (1/4 of the width). Tapping it expands a picker grid that shows only the sticker images, no names. The **title** of the day is on the right (3/4).
  - **Highlights:** a thicker text box styled like a journal entry, for venting about the day, up to 5,000 characters.
  - **Day feeling:** five blocks in a row with a neutral one in the middle: Miserable, Low, Neutral, Notable, Outstanding. One tap. This replaces both the 0 to 10 rating and the memorability choice.
  - One button: **Continue to form**. Remove the duplicate "Continue to questions" button and the Summary/Questions section header.
- **Bento grid.** Replace the one-part-below-the-other stack with a free-form bento layout using CSS grid dense auto-placement. Each part kind has a default tile size (time range tall, yes/no and number small, scale and dropdown medium, text and library wide).
- **Compact.** Sections and questions get tighter padding and headers.
- **Time-range tile.** Tall vertical 24-hour bar (~1/4 to 1/3 width). Axis starts at 03:00 by default (or earlier rounded down if a session starts earlier). Tapping opens the clock editor.
- **Core marking.** Core part labels use accent color, semibold weight, with a subtle 3-second pulsing glow (`text-shadow` 8px at ~40% opacity; static under reduced motion). No red borders, "required" text, or "tap to check" text. Pressing Save with missing items scrolls to the first missing part and pulses its label.
- **Reading view for a day.** Separate continuous reading page with Edit toggle, opened from heatmap/calendar day strips (including closed chapters).
- **Question of the day is not in the form.** Soft post-save prompt opening the QOTD block (3A).

### 2.2 Form editor

- **Drag and drop.** Remove up/down arrows; add `@dnd-kit` drag reordering + section-tab drop targets + accessible "Move to..." menu.
- **Draft and a single save.** Working copy until **Save** shows change summary and commits in one transaction; remove "this chapter or next chapter" prompt; add Discard + unsaved-changes guard.
- **How edits apply.** All structural edits apply from today (or tomorrow if today is saved complete) via `validFrom`/`validTo`. Changing part kind/library creates a new part id and retires the old one. Maintain `formSnapshotStart` and end snapshot for Storybook's then-vs-now spread.

### 2.3 Chapter screen
- Thin banner on Home opens the dedicated chapter screen: name, planned end date, reflection blocks, and Storybook builder/preview (3B). Single **Done** button; drafts autosave; end date validated on Done (locked in last 2 days).

### 2.4 Dashboard
- **Toggle:** `Premade | Explore`. Move Explore from Insights to Dashboard. Merge separate tags filter + Libraries view into one library filter. Remove Chapter highlights box from Dashboard.

### 2.5 Appearance and themes
- **Remove light/dark mode toggle.** Split themes into standalone light/dark-native themes (e.g. Baked Clay Light, Baked Clay Dark) built from shared bases + overrides. Keep Cozy/Cutesy, Retro, Baked Clay Light/Dark, Newspaper, Cyberpunk, Royal, and Sports, updating Dashboard & Archive monochrome variants.

### 2.6 Bottom navigation and Profile
- Fixed order: **Home, Archive, Dashboard, Insights, Profile**.
- Day strip under Heatmap/Calendar (`[sticker] [title] [highlights preview]`, Edit/Open button).
- Profile reorganised into clear groups (Your form, Cycle tracking toggle, Backup & Recovery/Health check, App preferences, Appearance, Danger zone, Dev-flagged Developer tools).

### 2.7 Cycle tracking page (optional module)
- Switchable in Profile. Home Cycle card opens a dedicated full Cycle page for logging period start/end, daily flow/pain/symptoms, stats, predictions, and optional calendar overlay layer.

### Step 2 exit checks
- [ ] All removals (R1 to R9) applied with no dead references or tables.
- [ ] Nightly form: single flow, bento layout, core glow without red boxes, vertical time bar, separate reading view.
- [ ] Form editor: drag/drop + draft + single transactional Save + effective dating works and preserves history.
- [ ] Single chapter screen, fixed 5-tab bar, dark-native themes without light/dark toggle, optional Cycle module.
- [ ] End-to-end mobile tests cover the new flows and pass in CI.

---

## Step 3: New features

### 3A. Question of the Day (QOTD)
- Card above pinned graphs on Home; same prompt all day changing at day boundary; unlimited re-rolls tracking `rerollCount`; add-to-book toggle; optional separate push reminder time.

### 3B. Chapter Storybook (replaces current Archive view)
- Theme-agnostic paper book layout (`1: Cover`, `2..k: Chapters/Highlights`, `Form then vs now`, `Charts`, `Written reflections & QOTD`, `Ending & Photos`). Built gradually while chapter is open; read-only snapshot at close; print-ready PDF export.

### 3C. Deeper Insights Engine
- **Session-level analysis:** per-session records tying answers & minutes to library items + Mann-Whitney per item + within-session correlations + per-item daily series.
- **Patterns in writing:** repeated 2–4 word phrases and similarity matching locally in the Web Worker (`n >= 5`, stop-word filtered, zero AI).
- **Derived time metrics:** duration, start, end, midpoint analysis cleanly integrated into weekday/baseline rules.

### 3D. Dashboard, Home, calendar and settings
- **Streaks and counts toggle** in Profile.
- **Heatmap on-time vs added-later split** (comparing `createdAt` against day boundary + corner dot for `editedAt`).
- **Time-use views:** Polar clock & Day lines views on Dashboard (exportable to Storybook).
- **Day identifiers:** selectable sticker, Word of the day (`Day.wordItemId`), Color of the day (`Day.colorKey`, 12 fixed swatches) + Words page.
- **Per-part targets & Full Explore chart builder:** multi-series (`line`, `bar`, `scatter`, `pie/donut`), lag `0..3`, smoothing, normalization, filters, Spearman stats, `savedCharts` table, pin to Home / add to Storybook.
- **Calendar v2:** swipeable multi-month calendar across chapters with selectable color layers & colorblind-safe feeling symbols.
- **Small items:** Date format presets (`formatDate()`) and Vibration API haptic tick.

### 3E. Parked (not in v2)
- Sealed time capsule note, multi-chapter comparison/ribbon, mini experiments, tasks/goals/events.

### Step 3 build order & exit checks
1. QOTD + reminder (3A)
2. Session-level analysis (3C)
3. Storybook slice 1 (3B)
4. Text-pattern insights (3C)
5. Time-use views, day identifiers, Words page (3D)
6. Streaks/counts toggle, targets, heatmap split, library views
7. Explore builder, saved charts, pinned graphs, Calendar v2
8. Date format & haptic tick
9. Storybook slices 2 & 3 (frozen snapshot & PDF export)

---

## Later (v3 / v4)

- **New character system:** Evaluate Rive / Lottie / Spine for rigged character animations offline.
- **Planner module:** Separate tasks/goals/events module communicating only via narrow `{ date, key, value }` day signals.
- **Sync and login:** Dedicated backend database (Postgres + Auth + object storage; replacing ephemeral KV) syncing UUIDv7 + tombstoned records.
- **Onboarding & public polish:** Interactive onboarding tour, preset sample form packs, and demo mode.
