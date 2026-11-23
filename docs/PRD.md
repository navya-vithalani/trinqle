# Trinqle: Product Requirements (v1)

Name: **Trinqle** (trinket + twinkle + q). The character persona is always **Piqsie** (pronounced "pixie"), whatever look is active. Never hardcode either name in components; use constants/settings (`APP_NAME`, `characterName`).

## 1. Summary
A personal, phone-only (Android) PWA journal. Each night the user fills a **hyper-specific, structured form** (toggles, scales, numbers, time ranges, dropdown libraries, short text). The app turns that into dashboards and a data-driven **insights engine** (statistics, no LLM). Data lives on the device. Time is organised into **chapters** (20 to 45 days, default 28) that are frozen and archived when closed.

Single user. No accounts, no cloud sync in v1. No AI in v1.

## 2. Principles (apply to every decision)
1. **Nothing hardcoded about the user's life.** Sections, questions, parts, libraries and starter content come from data (a *form pack* JSON) and are editable in-app.
2. **Nightly path stays short.** Quick mode must be fillable in about 2 minutes. Full mode in 10 to 15.
3. **Missing is not zero.** Skipped extras, skipped days and questions added mid-chapter are *missing*, never 0.
4. **Past is frozen.** A closed chapter never changes, including how its dashboard looked.
5. **Modular and unlocked.** Versioned file formats, UUIDs + `updatedAt` on every record (keeps future sync possible), themes and characters pluggable without touching data or logic.
6. **Honest analysis.** Always show how sure the engine is. Run from day one, even on 2 days of data.
7. **Cute but uncluttered.** Calm screens, delightful micro-animation, no mascot spam.
8. **No emojis anywhere** (UI, copy, greetings, insights). Icons are semantic keys resolved by the active theme's icon set (default Lucide); stickers are images.

## 3. Core concepts (glossary)
- **Section**: a group of questions on the form (starter: Activities, Routine, Inner state, Outside world; plus Weekly and Chapter-end sections that appear on schedule).
- **Question**: a container of **parts**. May have sub-questions (`parentId`), may **repeat** (sessions), may be shown conditionally.
- **Part**: the atom. Exactly six kinds: `yesno`, `scale`, `number`, `text`, `timerange`, `library`. A part has a **level**: `core` (shown in quick mode) or `extra`. A `yesno` marked `gate` hides the question's other parts until true.
- **Library**: a shared, creatable list (People, Places, Projects, Foods, Symptoms, Feelings, per-activity type lists...). Same library can be used by many parts.
- **Day**: one logical date, with header fields (title, one-liner, sticker, overall rating, memorability).
- **Chapter**: 20 to 45 day span with title, summary, reflections, up to 10 photos, theme and character. Open, then closed (frozen).
- **Cycle**: period start and end dates (special, separate from daily answers).
- **Insight**: a finding from the engine with sureness, surprise and a combined score.

## 4. Scope
**In v1:** everything in section 5. **Out of v1:** cloud sync, accounts, AI/LLM features (dream condensing etc.), iOS-specific work, alarm-style overlays (impossible in a PWA), per-day photos, PIN or biometric lock (later), direct Google Drive upload (later; use the share sheet). Also deferred, see docs/ideas.md: Storybook archive view, to-do list, dream quick-log.

## 5. Functional requirements

### 5.1 Nightly form
- F1. Form window default **21:00 to 03:00**, editable in Profile. Entries made before the window end belong to the **previous** date. Outside the window the Home card shows "opens at 9 pm" (read-only preview allowed in dev mode).
- F2. Form starts with the **day header**: title, one-liner, sticker (from the sticker library), overall rating (scale), memorability (3-way: normal / notable / outstanding, plus a rare **star** level), and **mode choice: Quick or Full**.
- F2b. The form opens as a **bordered pop-up (modal sheet), not a full page**; frame and entrance/exit animation come from the theme. Step 1 is the day header plus the Quick/Full choice. **Full mode:** paged by section, with a **progress bar at the top** (one segment per section, current one highlighted) and Back/Next at the bottom; the last page has Save. **Quick mode:** one flat list of the core questions (target 7 to 10), **no sections and no progress bar**, a single Save, and a "More questions" expander at the bottom that reveals extras inline.
- F3. Quick mode shows `core` parts only; Full mode shows everything. Which parts are core is editable per part in the form editor. The day stores which mode was used.
- F4. **A night saves only when every required core part is answered.** Core yes/no toggles start visibly at "No" and count as answered; other core parts must be filled; a core part under a gate is required only when the gate is on, and a repeating question with its gate on needs at least one complete session. Untouched extras are *missing*. Incomplete drafts are kept as drafts, but the day counts as unfilled: it shows empty on the heatmap and does not count toward fill streaks.
- F4b. Display defaults: **12-hour times** and **weeks start on Monday** (stored as settings).
- F5. Part widgets: yesno toggle; scale (stars *or* continuous slider, display setting only; value stored as number, e.g. 7.8); number stepper; text (multiline, optional, works with Gboard voice typing); **timerange** (interactive draggable 24 h track with 5 min snapping, crosses midnight, text entry fallback); library picker (type to search, Enter or "create new" adds an item, single or multi).
- F6. A **gate** yesno reveals the question's other parts. **Repeating** questions show "+ Add session"; each session holds its own set of parts. Warn (do not block) on overlapping time ranges within the same question.
- F7. **Sub-questions** nest under a parent and inherit the parent's session instance (e.g. Dream under each Sleep block).
- F8. Conditional visibility via `showWhen` rules. Questions can have a **schedule** (daily, certain weekdays, chapter-end, only while period active).
- F9. Drafts autosave. Saving is explicit ("Save tonight"). Saved days of the **open chapter** can be edited, marked "edited".
- F10. **Backfill**: only the last 3 days, only within the open chapter, marked `backfilled`. A day with no entry stays missing.
- F11. Period: when no cycle is open, the Period question shows **Start period**. While open, it shows flow, pain, symptoms, note daily plus **End period**. Start and end dates can be backdated.
- F12. Sleep: repeating time ranges (night + naps) with quality. Total sleep and main sleep are derived. Dream is a sub-question per sleep block (night vs nap is implicit).

### 5.2 Tabs
- **Home** (top to bottom): (1) chapter countdown (tap to move end date, max 45 days from start), (2) tonight's form card (locked / open / filled; on Sundays after saving: "Generate insights?"), with a backfill banner directly under it when any of the last 3 days is missing, (3) greeting line (rule-based over last 3 to 4 days), (4) **character stage**: a dedicated area where the chosen character does random animations and reacts when tapped, so it never clutters other screens, (5) fill heatmap for the open chapter (empty / quick / full / backfilled), (6) cycle card with swipeable month calendar (the **only** place that ignores chapter boundaries), (7) a compact **Reflections** row (e.g. "4 of 9 answered") that opens the always-open reflections sheet. Two days before the chapter end: prompt to close it. Empty state: big panel with **Import a form** (opens the Import dialog: pick or drop any form-pack JSON), **Build one**, and a small "Use sample starter pack" shortcut.
- **Dashboard**: auto-generated from the current form. Two filters: **part kind** and **section/question**, plus search and date scope (default: open chapter). Each question shows graphs per its parts (see 5.5). **Journal view** = the text-part filter (read all dreams, gratitude, etc.). Removing a part removes its graphs (old data remains). A top toggle switches **Questions | Libraries**: the **Libraries view** lists every library with its items (uses, first and last used); tapping an item shows the days it appears on (date, title, the question it was used in), each opening that day. It follows the same date scope; rename/merge stays in Profile > Libraries.
- **Insights**: latest run, earlier runs, Discarded list, per-insight rating, "Generate now".
- **Archive**: three segments: **Chapters** (closed chapters + import button), **Memorable days** (across all chapters), and **Search**. Opening a chapter switches the whole app to **archive mode** (5.6).
  - **Search** covers the entire history **including the open chapter**: any keyword or phrase from any text answer, library item name, day title/one-liner, chapter title/summary or reflection. It is **fuzzy** (typos, partial words) with an optional exact-phrase mode, and can be **filtered** by source (text answers, library items, day header, reflections), section, question (e.g. only dream stories), part kind, chapter and date range. Results are grouped by day, newest first (toggle: best match first), show which question the match came from with the match highlighted, and tap through to that day.
- **Profile** (replaces "Settings"): Edit form, Libraries (rename/merge/retire items), form pack import/export, chapter import/export, Back up now, CSV export, form window hours, time format (default 12 h) and week start (default Monday), stickers (view all, import), theme and character, notifications, past-forms browser (read-only day-by-day), **Delete all data** (typed confirmation), dev tools (demo data generator).

### 5.3 Form editor (Profile, full screen, block-builder feel)
- **Layout:** Excel-style **section tabs** along the top (+ to add; long-press a tab to rename, reorder or remove). Each question is a rounded card; each part is a bordered block inside it with an **X (delete)** and a **pencil (edit)** at its top; each part shows its input type and label. **Long-press a question to move it to another section**; drag to reorder. Nothing is rigid: any section, question, sub-question or part can be added, edited, moved or removed. The chapter-reflection prompts have their own tab here.
- Tree of sections, questions, parts with drag-and-drop reorder and move between sections. Create section, question, sub-question; add/remove/reorder parts; edit a part's config (range, display, library, multi, level core/extra, gate); edit labels, icons, schedule, `showWhen`.
- **Every question and part requires a label** (shown on the form). Each part's **core/extra level is a toggle in the editor** (quick mode = the core parts; keep a question's gate core if any sibling is core). A scale's display (stars or slider) is a per-part display setting only; the stored value is always a number, so changing it never changes data.
- **Library manager**: create libraries, rename/merge/retire items.
- **Light edits apply immediately:** renaming, relabeling, reordering, icons, library item edits, display style, text settings.
- **Structural edits** (add/remove/retire a section, question or part; change core/extra; change gate, repeat or schedule; change a part's kind) ask for scope: **"From next chapter"** (default) or **"This chapter"**. "This chapter" means additions are effective from the chapter's first day (earlier days are *missing* for that item), while removals and core/extra changes are effective from tomorrow. Whether a night is complete is always judged against the form as it was effective on that date. Implemented through `validFrom`/`validTo`, never by rewriting history. Changing a part's *kind* creates a new part and retires the old one.
- Removing = retire (hide from form), never delete data. Hard erase only via a deliberate "Erase forever" in Profile.
- Activity to Routine "upgrade": offered when an activity question had 4+ days/week for 12 weeks; accepting moves the question to another section (no data change).

### 5.4 Chapters
- F20. First chapter: ask "Start your first chapter today?"; end date defaults to start + 27 (28 days), adjustable 20 to 45.
- F21. The **Reflections sheet** (chapter-end section: goals, values, philosophy; 5 to 10 default prompts, editable in the form editor) is **open all chapter long** from Home. Answers autosave and stay editable until the chapter closes, so a thought from mid-chapter is never lost. You can also add **chapter-only prompts** and freestyle notes (stored on that chapter only, never in the form). From **2 days before the end**, the thin countdown banner expands into a thick, dismissible pop-up that prompts you to finish reflections, title, summary and up to **10 photos** (0 to 10, compressed).
- F22. **Chapter close is a hard-lock ceremony.** A chapter ends on its end date (the last night's form stays open until the window ends). From the first app open after that (logical date past the end date), **everything is locked**: no form, dashboard, insights, archive or profile, only a **Close Chapter** flow. Steps: review reflections (plus chapter-only prompts), title, summary, photos (0 to 10), confirm. Only the confirm is mandatory (a blank title becomes "Chapter N"). Confirming freezes the chapter (form snapshot, all dashboard chart models, all insights + ratings, theme, character, metadata), prompts the export, and the next chapter starts the day after the end date (days between the end date and closing are simply missing).
- F23. Chapter export = **.zip** (JSON + images) through the Android share sheet. Import unpacks into Archive; conflicts ask replace/skip.

### 5.5 Dashboard analysis per part kind (generic, written once)
- yesno: heatmap, streak (current/longest; skipped days bridged and shown as gaps), % done.
- timerange: minutes per day, time-of-day heatmap (sessions split across hours), category split, session count.
- scale/number: trend line, rolling average, best/worst days, weekday pattern.
- text: searchable list, "on this day" lookups; **written or not** is also a yes/no metric (streak, heatmap, correlations).
- library: frequency, recent items, co-occurrence.
- Memorability: count per level, star timeline. Cycle: lengths, durations, phase overlays.

### 5.6 Archive mode
Entire app locked to the chosen chapter, clearly bannered ("Viewing chapter X", Back). Dashboard, Insights and other tabs switch to the theme's **archive (monochrome) variant**, which keeps the theme's own shapes, icons, depth and motion (charts with multiple series keep colour). **Home stays full colour** and becomes a chapter page: title, dates, summary, up to 10 photos, reflection answers, chapter metadata (days filled, quick vs full, memorable-day counts, insight count, theme and character used) and the chapter's character on its stage. No countdown, form card, cycle card, backfill banner or heatmap. Dashboard and Insights render the **frozen** data. Form and edit actions are disabled. Theme/character are those the chapter was closed with. (Post-MVP, a **Storybook** view in docs/ideas.md will replace this presentation, so freezing must keep **all** chart models and insights with stable ids, plus each day's title/one-liner and Highlights text.)

### 5.7 Insights engine (rule/statistics based)
- Runs from day one on any amount of data, uncensored casual wording, honest scores (2 days of data means near-zero sureness).
- Triggers: Sunday prompt after saving, plus "Generate now" anytime (labelled with window, e.g. "partial week through Wed"). Compute budget about 10 s in a Web Worker, deterministic.
- Searches generically (no fixed insight templates): driver/outcome relationships at lags 0 to 3 days, weekday effects, unusual days vs baseline, change points, streak records, library lag (e.g. dreaming of someone 2 to 3 days after meeting them), cycle-phase effects, what the best days had in common, simple 3-way conditions. Windows: week, 4 weeks, chapter, last 3 chapters, all time vs running baseline.
- Each insight: **sureness** (0 to 10), **surprise** (0 to 10), combined score (geometric mean). Show **all with score >= 6.5** (configurable) and fill to a **minimum of 20**. Header states how many cleared the bar. Strong and weaker groups. Already-known findings marked "still true".
- User rates each insight (5-point agree scale), can **Discard** (hidden, signature remembered, undoable). Ratings are stored and never fed back into the engine.
- Insights show their evidence (the actual days with titles/one-liners).

### 5.6 Backup, export, import
Back up now (open chapter + form, zip via share sheet), chapter zips, form pack JSON, CSV of all data, import for all of these through one **Import dialog** (file picker + drag-and-drop, any valid file of a known type, validated with a preview before committing, works offline). Ask the browser for persistent storage. Weekly backup nudge.

### 5.9 Notifications (Android Web Push)
Optional 9 pm "diary is open" (time editable), Monday-morning "insights ready/open to generate", "chapter ends in 2 days". Payloads contain **no journal content**. Needs a small server (see TRD).

### 5.10 Theming and character
A theme owns **everything visual except layout**: colors, fonts, shapes (including button shapes), depth, motion, icon set, sticker and chart styling. Layout (what is placed where) is fixed by the app. v1 ships **cutesy**; more later. Theme is stored per chapter. The persona is always named **Piqsie**, whatever look is active. A **character** look is an SVG plus a small JSON mapping; one shared animation engine (idle, walk, jump, dance, sleep, wave, etc., any number of limbs) animates every character with no per-SVG code. Starter: white fluffy cat. SVG import in a later phase (sanitised, with a role-mapping screen).

### 5.11 Stickers, greetings, icons
- **No emojis anywhere** in the UI, copy, greetings or insights. Icons are semantic keys resolved by the theme's icon set.
- **Stickers** are images. 12 simple built-in SVG stickers ship with the app (`assets/stickers/`). Profile has a **Stickers library** that shows all stickers, plus **import** (PNG, JPG, WebP, SVG; SVG sanitised, rasters downscaled to 256 px). The day header picks from this library. Chapter exports include the stickers they reference.
- **Greeting:** the Home greeting comes from `greetings.json` (rules over the last 3 to 4 days, using the form pack's `aliases` for mood, sleep, etc.). It is code-owned and **not editable in the app**.

## 6. Non-functional
Offline-first (service worker), installable, works fully offline. Fast: Home interactive < 1 s on mid-range Android. Accessible: contrast, focus, touch targets 44 px, reduced-motion respected, screen-reader labels. Time-zone safe (store IANA tz per day). All formats versioned (`formatVersion`).

## 7. Success criteria
1. Fill a quick night in ~2 minutes, full night in ~10.
2. Add/remove/move a question with no code and no data loss; charts adapt.
3. Closed chapter reopens exactly as left, in monochrome archive mode.
4. Engine recovers planted effects in synthetic data and stays quiet on pure noise (see plan.md).
5. Whole data set survives export/import round trip byte-identically (logical equality).

## 8. Decisions log (do not relitigate)
Phone-only, local-only, share-sheet backup. No AI in v1; dream text kept raw. Home = default for no-activity days (no "Home" question). Fitness is an Activity. Photos only at chapter close. Text insights built compositionally from facts, not templates. Skipped days are bridged in streaks. Editing allowed only in open chapter. Starter pack is disposable; Delete-all exists for dev.

## 9. Defaults and assumptions (made without explicit discussion; change if wrong)
- Core yes/no toggles start at "No" and count as answered; core parts under a gate are required only when the gate is on.
- Day-header fields other than the Quick/Full choice are optional.
- Scales are 0 to 10 (period flow 0 to 5); the day's overall rating is 0 to 10.
- Streaks bridge skipped days; fill streaks count only saved, complete days.
- Insight ratings use 5 points; combined score is the geometric mean; compute cap about 10 s.
- Closed chapters are fully read-only, metadata included; everything is chosen in the Close Chapter flow. Reflection and extra-prompt answers are chapter-level, not daily.
- The weekly review is Sunday-only (weeks start Monday, so Sunday ends the week). Weekday numbers in data use 0 = Sunday.
- The tech stack is a default; equivalents are fine.
- The starter pack is disposable; its quick mode has 8 questions.
