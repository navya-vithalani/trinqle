# Trinqle: Ideas backlog (post-MVP)

Nothing here is part of v1 (see PRD.md, plan.md). Each idea has notes and, where needed, a **hook** v1 must keep so it can be added without a rewrite. Add new ideas at the bottom of the right section. Do not build from this file without an explicit instruction.

## Approved ideas

### 1. Storybook chapter view (build last among Phase E views, after QOTD & media settle)
Becomes the primary archive experience for closed chapters (keeping existing **Frozen Snapshot Archive Mode** intact as a toggleable backup until Storybook edge cases are finalized and proven):
- Cover: chapter title, dates, sticker quilt/mosaic border, and Piqsie moving around.
- Page 1: the big-picture reflections for that chapter (`chapterAnswers`).
- About 10 **hand-picked graphs** (chosen from frozen `FrozenChartModel[]`, filtering to highest signal/variance).
- Hand-picked **insights** that mattered during the month.
- **All memorable days** (`memorability >= 1`) with the full form entry snapshot.
- A few **favourite days** of any kind: just the day's title/one-liner plus the Highlights text.
- Favourite **question-of-the-day** answers (see idea 6).
- Photos (up to 10) with CSS 3D page-turn / swipe transitions matching the chapter's frozen theme.
- **Printable export:** CSS `@media print` book layout + Print-to-PDF button.

**Decision & Implementation Plan:**
- **Immutability (`A2`)**: `bookSelection { chartIds[], insightIds[], favoriteDates[], promptDates[] }` is **locked permanently** at the Closing Ceremony (just like frozen charts and entries). If the user skips manual picking or views an older closed chapter, `autoBuildBookSelection(chapter)` deterministically selects top-variance graphs, top-score insights, memorable days, and filled QOTD highlights.
- **Schema (`src/data/types.ts`)**: Extend `FrozenChapter.bookSelection?: BookSelection`.
- **Closing Ceremony (`src/ui/screens/ClosingCeremonyModal.tsx` / `ChapterGate.tsx`)**: Add curation steps picking graphs, insights, favorite dates, and QOTD answers before calling `closeChapterWithCeremony()`.
- **Reader UI (`src/ui/archive/StorybookView.tsx`)**: Paginated book spreads with swipe + arrow navigation, CSS page-turn animations, print stylesheet (`src/ui/archive/storybook-print.css`), and a backup **"Snapshot View"** toggle in the Archive header until Snapshot Mode is retired.

### 2. Wrapped (weekly, per chapter, yearly)
A Spotify-Wrapped style set of 7 to 8 animated, theme-styled slides showing the most outstanding things: biggest change vs baseline, record streaks, most-used library item, top activity time, best and worst day, top insight, a memorable day, plus 2 to 3 **quoted texts** from what you wrote. Weekly wrapped opens from Home/Dashboard; chapter wrapped opens per chapter; yearly wrapped aggregates closed chapters' frozen stats and insights.

**Implementation Plan:**
- **Generator (`src/core/wrapped.ts`)**: Pure deterministic selector `buildWrappedDeck({ scope: 'weekly' | 'chapter' | 'yearly', days, answers, chapters, metrics, baselines, insights })` outputting `WrappedSlide[]`. Quote extraction scores day text + highlights via lightweight in-memory TF-IDF across history, filters to length 40–180 chars, de-duplicates by date, and caps at 3 quotes. Computes metrics on demand (no heavy DB storage; optional tiny cached `WrappedSpec` in settings/chapter metadata).
- **Player UI (`src/ui/wrapped/WrappedModal.tsx`)**: Full-screen story progress bars, tap left/right navigation, theme-matched palette, plus a **"Save Card PNG"** button rendering the active slide onto an offscreen HTML5 `<canvas>`.

### 3. Explore v2 (upgrade to the Phase D Explore workbench inside Insights tab)
Phase D already delivered the base `Findings | Explore` split inside `src/ui/screens/InsightsScreen.tsx` with Factor X, Outcome Y, a 0–3 day lag slider, Spearman/Mann-Whitney stats, and inline SVG scatter & group plots. Explore v2 adds the remaining power tools:
- Adjustable axis ranges / outlier zoom toggle.
- **Split-by overlay**: color/split points by weekday (Weekends vs Weekdays) or by any binary `yesno` habit.
- **FDR / Sureness readout**: live `sureness (0..10)` score alongside `n`, `rho`/`delta`, and `p-value`, plus ability to pin a manual finding or inspect its exact matching days on click.

**Implementation Plan:**
- **Core (`src/core/engine/explore.ts`)**: Extract and expand pairing/splitting calculations from `InsightsScreen.tsx`, computing group-split trend lines and Phase 7's monotonic `sureness` formula.
- **UI (`src/ui/screens/InsightsScreen.tsx`)**: Add `Split by` dropdown, custom Y-min/max clip inputs, clickable scatter dots opening global `onNavigateToProfileBrowse(date)`, and colored legend for split series.

### 4. To-do, Deadlines, Long-Term Goal Milestones & Part Targets
Decoupled completely from the nightly journaling form so tasks & long-term goals live in their own lightweight Home card + expandable Manager without cluttering bedtime check-ins, while numeric daily targets live right on each Part in the Form Builder:
- **Typed Tasks via Library Pickers**: Every task pairs `text` with an optional **Category / Type** chosen from a dedicated `Task Categories` library (using the existing `LibraryWidget` / `Library` + `Item` store so users can create & filter categories organically!).
- **Strict Expiry & Permanent Expired Record**: Every task has a creation timestamp (`createdAt`) and an expiry deadline (`expiresAt`, ranging from hours/days to months or years for long-term goals). If `logicalToday > expiresAt` (or `now > expiresAtTs`) while still incomplete, the task transitions permanently to `expired` and remains visible in an Archived/Expired log rather than silently disappearing.
- **Milestones & Manual Progress Slider**: Any task—especially multi-month or multi-year goals—supports adding timestamped **Milestones** (`text`, `createdAt`, and a manual `0..100%` completion slider). Saving a milestone updates the task's current `progressPct` and appends an immutable timeline point.
- **Efficiency & Trajectory Analytics**: Every completion computes `elapsedRatio = (completedAt - createdAt) / (expiresAtEndMs - createdAt)` and classifies execution into buckets:
  - **First Half (`<= 50%` of deadline)**
  - **First Two-Thirds (`<= 66.7%` of deadline)**
  - **Final Stretch (`> 66.7%` to `100%`)**
  - **Expired (`missed deadline`)**
  Dashboard renders interactive **Task Execution Charts** filterable by Category (`All` or specific Library `Item`): stacked/grouped timing breakdown bar + count/rate trend + **Per-Goal Milestone Trajectory Line Graph** plotting `progressPct` over calendar dates. External metrics (`tasks.completed`, `tasks.doneEarly`, `tasks.milestonesLogged`) also feed into `MetricsCalculator` & Insights Engine.
- **Per-Part Daily Metric Targets in Form Builder (`A2`)**: Inside `PartEditorModal.tsx`, `scale`, `number`, and `timerange` parts gain an optional **Target** configuration (`targetValue`, `targetOp: '>=' | '<='`, e.g., `>= 480m` for Sleep or `>= 8000` for Steps). Changing a target follows the Form Editor's effective-dating prompt (`This Chapter` vs `Next Chapter`), renders a dotted goal line on Dashboard `MetricCard` / `FrozenChapter` charts, and tracks target hit rate (% of filled days meeting goal).

**Database Schema & Architecture (`src/data/db.ts`, `src/data/types.ts`):**
Bump Dexie schema cleanly (adding indexed stores without breaking existing tables):
- `PartConfig` addition: optional `target?: { value: number; op: '>=' | '<=' }` on `ScaleConfig`, `NumberConfig`, and `TimeRangeConfig` (zero extra table needed; automatically inherits effective dating and chapter freeze).
- `tasks` store (`id, status, categoryItemId, expiresAt, createdAt, updatedAt, completedOn`):
  ```ts
  interface TaskItem extends BaseRecord {
    text: string
    libraryId?: string
    categoryItemId?: string // FK -> Item.id (type / project / area of life)
    startDate: string       // YYYY-MM-DD
    expiresAt: string       // YYYY-MM-DD (days, months, or years out)
    status: 'active' | 'done' | 'expired'
    progressPct: number     // 0..100
    completedAt?: number
    completedOn?: string
    expiredAt?: number
  }
  ```
- `taskMilestones` store (`id, taskId, createdAt`):
  ```ts
  interface TaskMilestone extends BaseRecord {
    taskId: string          // FK -> TaskItem.id
    date: string            // YYYY-MM-DD
    text: string
    progressPct: number     // Snapshot 0..100 from manual slider
  }
  ```
- **Why two tables instead of embedding arrays on `TaskItem`**: IndexedDB queries (`db.taskMilestones.where('taskId').equals(...)` and date-range scans for Dashboard graphs) stay fast (`O(log N)`), sync-safe via independent `updatedAt`/`deletedAt`, and clean to plot as chronological series.
- **UI & Components**:
  - `src/data/repositories/TaskRepository.ts`: sweep-on-load `sweepExpiredTasks(now, today)` marking past-deadline `active` tasks as `expired`, CRUD for tasks & milestones, timing-ratio helpers, and category filter queries.
  - `src/ui/home/TodoCard.tsx`: compact Home checklist showing active due-soon / pinned goals with 1-tap complete, quick "+ Task / Goal" composer (with Category picker & expiry presets: Today, 3d, 1w, 1m, 6m, 1y, Custom), and quick "+ Milestone" drawer.
  - `src/ui/dashboard/TasksAnalyticsView.tsx`: category filter pills, Early (`<=50%`) / First Two-Thirds (`<=66.7%`) / Late / Expired donut & bar charts, and selectable Goal Progress step-line SVG showing milestone timestamps & annotations.
  - `src/ui/editor/PartEditorModal.tsx`: Target value & operator fields + dotted reference line + hit-rate pill in `src/ui/screens/DashboardScreen.tsx`.

### 5. Quick-log drawer (Unified Dream & Pocket Note + Android PWA shortcuts)
Confirmed unified **Quick Log** (`dream` and `note` tags) reachable from Home AND Android Home-screen long-press app shortcuts (`?quick=dream` / `?quick=note`). When tonight's Nightly Form opens, pending quick notes for that logical day can be appended with timestamps into Dream / Highlights / Note fields while keeping the original timestamped notes preserved.

**Implementation Plan:**
- **Schema (`src/data/types.ts`, `src/data/db.ts`)**: Add `quickNotes` table: `QuickNote { id, createdAt, updatedAt, deletedAt?, logicalDate: string, kind: 'dream' | 'note', text: string, attachedToAnswerId?: string }`.
- **Manifest & Routing (`vite.config.ts`, `src/ui/App.tsx`)**: Add PWA `shortcuts` entries (`Log Dream` -> `/?quick=dream`, `Pocket Note` -> `/?quick=note`) in `vite.config.ts` manifest; parse `?quick=` in `App.tsx` to open the quick composer immediately.
- **UI (`src/ui/dialogs/QuickNoteSheet.tsx`, `src/ui/form/NightlyFormModal.tsx`)**: Fast sheet with tag switch (`Dream` | `Pocket Note`), autofocus textarea, optional voice dictation button (Idea 16), and a `"pending notes (N) - Append to entry"` chip inside `NightlyFormModal`.

### 6. Question of the day (QOTD)
Hardcoded, curated pool of **50+ thought-provoking, universally relatable open-ended prompts** (e.g., curiosity, perspective, small absurdities, memory triggers — designed to scratch the brain without feeling clinical).
- **Visibility & Opt-Out (`A5`)**: Shown **only inside the Nightly Form** (no Home screen clutter), with a **Profile setting toggle** (`Question of the Day`, default `On`) to turn it on or off anytime.
- **Deterministic Daily Selection**: Seed-hashed per `date` against non-recently-used prompts in the 50+ hardcoded pool so every day feels fresh and never repeats inside a chapter.
- **Closing Ceremony Link**: Starred QOTD answers can be picked in the Closing Ceremony (Idea 1) for the chapter Storybook.

**Implementation Plan:**
- **Pool & Selector (`src/core/qotd.ts`)**: Built-in `QOTD_PROMPTS: ReadonlyArray<{ id: string; text: string }>` (50+ prompts, zero emojis), plus `pickQotdForDate(date, excludePromptIds)`.
- **Storage & UI (`src/data/types.ts`, `src/ui/form/NightlyFormModal.tsx`, `src/ui/screens/ProfileScreen.tsx`)**: Store response on `Day.qotdAnswer?: { promptId: string; promptText: string; answer: string }`, add Profile Settings toggle (`qotd_enabled`), and render a compact collapsible card in `NightlyFormModal` when enabled.

### 7. Libraries: Deeper linking & Tag Constellation
Upgrade the v1 `LibrariesListView` into a full discovery hub with dedicated per-item profile pages (`ItemDetailModal` / sub-view) plus a **Tag Constellation** visual graph showing which people, places, triggers, and themes orbit each other across your diary.

**Implementation Plan:**
- **Analytics (`src/core/libraries/deepStats.ts`)**: Given `items`, `answerLinks`, `days`, and `dailyMetrics`: compute co-occurrence counts `(itemA, itemB)` on same days and `1..3d` lags (e.g., Alex -> Flying dream), average `overallRating` & `mood` lift (`delta` vs non-item days), `lastSeenDate`, `longestStreak`, and seasonal heatmap.
- **Constellation Layout (`src/ui/dashboard/TagConstellation.tsx`)**: Deterministic force/radial SVG layout placing frequent items as themed nodes sized by usage and connected by weighted co-occurrence edges; tapping a node highlights neighbors and opens the deep **Item Detail View**.

### 8. Chapter comparison
Compare any two chapters (e.g., current open chapter vs previous closed chapter) or **Current Chapter vs All-Time Baseline** side by side across all sections and metrics. Reuses `FrozenChapter.stats` and `db.baselines` (already updated at chapter close in Phase D!).

**Implementation Plan:**
- **Comparator (`src/core/chapters/compare.ts`)**: Compute normalized metrics snapshot for open chapters on the fly using `metrics/calculator.ts` so open chapters compare apples-to-apples against `FrozenChapter.stats` and `Baseline` weekday norms. Output section-grouped rows with `aMean`, `bMean`, `delta`, `% change`, `fillRateDelta`, and mini sparklines.
- **UI (`src/ui/dashboard/ChapterCompareView.tsx`)**: Integrated selector modal or sub-tab inside Dashboard & Archive (`Compare Chapters`) with color-coded delta chips and aligned time-series overlay SVG.

### 9. Data health check
Offline integrity and plausibility monitor catching suspicious entries without nagging or auto-modifying user data: overlapping `timerange` sessions on the same question, impossible durations (`<= 0m` or `> 18h`), unusually long open menstrual cycles (`> 14 days`), extreme numeric outliers (`|z| >= 3.5` against personal mean/SD), and dangling references.

**Implementation Plan:**
- **Scanner (`src/core/healthCheck.ts`)**: Pure analyzer `runDataHealthCheck({ days, answers, questions, parts, cycles })` returning deterministic `HealthIssue { signature, severity: 'warn' | 'info', date?, cycleId?, message, actionHint }`.
- **Suppression & UI (`src/ui/components/HealthAlertStrip.tsx`)**: Store dismissed issue signatures in `SettingsRepository` (`dismissed_health_issues: string[]`). Surface a subtle collapsible pill/banner on Home when un-dismissed warnings exist, with `"Inspect day"` (opens global `NightlyFormModal` directly on that date) and `"Keep as is"` (dismisses signature).

## Selected Phase E Additions (confirmed in discussion)

### 13. Closing Ceremony Keepsake Poster PNG
Generate a single high-resolution portrait poster card (`1080x1350`) using pure client-side HTML5 `<canvas>` right after chapter close or from Archive—featuring the chapter title & dates, your mascot character portrait, the full chapter **Sticker Mosaic grid** (every day's sticker arranged as a visual quilt), top 3 metrics vs previous chapter, and your favorite reflection quote, downloadable or shareable offline via Web Share API.
- **Implementation**: `src/core/posterExport.ts` drawing offscreen canvas from frozen/open chapter assets + button on Chapter Gate completion & Archive card (`Save Keepsake PNG`).

### 14. 24-Hour Circadian Rhythm Polar Clock (SVG Dashboard View)
A circular 24-hour polar dial in Dashboard aggregating all `timerange` logs (`Sleep`, `Work/Study`, `Workout`, etc.) across the selected date scope into radial colored wedges/arcs per hour—revealing sleep drift, deep-work peaks, and fragmented nights immediately on one clock face.
- **Implementation**: `src/ui/dashboard/CircadianClockCard.tsx` added inside Dashboard Time Ranges view, using real `hourBins` + individual session spans normalized into 24h angles (`0..360 deg`).

### 15. Seasonal Sticker Quilt & Photo Lightbox in Archive
Turn each chapter's chosen daily stickers into a woven **Sticker Quilt** header on Chapter Archive cards, plus add a swipeable **Photo Lightbox** modal with chapter date captions so uploaded chapter photos can be inspected full-screen alongside reflections.
- **Implementation**: `src/ui/archive/StickerQuilt.tsx` + `src/ui/archive/PhotoLightboxModal.tsx` wired into `ArchiveScreen.tsx` & `ArchiveHomeScreen.tsx`.

### 16. Echoes / "On This Day" Memories (Promoted from Parked)
Quiet collapsible memory whisper on Home & Archive surfacing past entries from earlier chapters that match today's calendar month-day (`MM-DD`), exact 30/90/365-day milestones, memorable entries (`memorability >= 1`), or shared Library tags—clickable directly via the global Day Inspector.
- **Implementation**: `src/core/echoes.ts` (`findMemoryEchoes(todayStr, days, answers, links)`) + `src/ui/home/EchoesCard.tsx`.

### 17. Baseline Drift Micro-Signals on Home
Reuse the `db.baselines` table populated on chapter close (Phase D) to surface gentle, strictly thresholded observational notes in the Home Greeting banner (e.g., *"3 nights under 6h sleep"* or *"Best 7-day mood stretch this chapter"*), avoiding notification spam.
- **Implementation**: Extend `buildGreetingContext()` in `src/core/greetings.ts` to read `db.baselines` alongside 3-day stats and score low-noise observational greeting templates.

### 18. Dashboard Mode Completeness Filter
Add a compact mode filter pill on Dashboard (`All Days | Quick Only | Full | Memorable`) and missing-day gap summary so you can inspect how averages shift between hurried Quick nights, Full logs, and Star days.
- **Implementation**: `modeFilter` state in `src/ui/screens/DashboardScreen.tsx` filtering computed day arrays cleanly before chart aggregation.

---

## Fresh Phase E Brainstorm Menu (for you to review, shortlist, or edit)

Here are additional creative, logical ideas built on Trinqle's existing schema and architecture. None will be built unless you shortlist them:

### 19. Interactive Life Seasons Timeline Ribbon (Multi-Chapter Zoom)
A horizontal scrollable timeline ribbon at the top of **Archive** showing every chapter side-by-side (theme color band, chapter title, mascot icon, average `overallRating` sparkline curve, and cycle start dots). Tapping any chapter zooms in, letting you see the macro arc of an entire year on one strip.
- **Hook**: Reuses `chapters[]`, `themeId`, and `FrozenChapter.stats` (`derived.overallRating`).

### 20. "Best Days vs Rough Days" Architecture Comparison Matrix
Inside Dashboard or Wrapped, automatically split the selected window into your **Top 20% Rated Days** vs **Bottom 20% Rated Days** and display a clean side-by-side comparison table across every core metric (`Sleep`, `Mood`, `Exercise %`, `Study`, top tags) so you immediately see the recipe of your best days vs hard days.
- **Hook**: Reuses `buildDailyMetricsTable()` and day `overallRating` quartiles.

### 21. Mini Routine Experiments / A-B Chapter Trials
Tag a 7–28 day streak or chapter as an intentional experiment (e.g., *"No phone in bed"* or *"Morning sunlight 15m"*) with a target habit rule. Shows a live compliance tracker card on Home and automatically computes a **Before Trial vs During Trial** significance card in Insights when the window closes.
- **Hook**: Small `Experiment { id, title, startDate, endDate, partId?, targetCount? }` record + `mannWhitneyU()` comparison in `stats.ts`.

### 22. Smart Saved Search Lenses & Markdown/Text Journal Digest
In **Archive Search**, let users save favorite query/filter combos as 1-tap pinned chips (e.g., *"Star Days + Mountain"* or *"2026 Dreams"*), plus add an **"Export Filtered Digest (.md / .txt)"** button to dump matching entries cleanly with dates, titles, and quotes for offline reading or printing.
- **Hook**: Reuses `search.ts` + a tiny `saved_search_lenses` array in `SettingsRepository`.

### 23. Cycle Phase Shaded Bands Behind Dashboard Charts
When cycle tracking is active, overlay subtle soft background ribbons (`Menstrual`, `Follicular`, `Ovulatory` estimate, `Luteal`) behind continuous line charts (Mood, Sleep, Energy, Rating) in Dashboard and Cycle Health View so hormonal patterns jump off the graph visually.
- **Hook**: Reuses `CycleRepository` intervals + inline SVG `<rect>` bands inside `MetricCard`.

### 24. Sealed "Time Capsule" Note to Next Chapter You
During the Closing Ceremony, add an optional sealed prompt: *"Write one note for whoever closes the next chapter."* It saves hidden (`sealedUntilNextClose: true`) and stays locked until the *next* chapter's Closing Ceremony opens it like a personal letter from a month ago.
- **Hook**: Small optional `capsuleNote?: { text: string; unlockedByChapterId?: string }` field on `Chapter`.

### 25. Sleep Debt & Social Jetlag Meter
In Dashboard's Time Ranges view, compare weekday vs weekend sleep midpoints and calculate cumulative weekly recovery gap ("Social Jetlag: +1h 45m weekend shift · 7d sleep avg vs your personal target"), turning sleep `timerange` logs into clear circadian insight.
- **Hook**: Reuses `Sleep` `timerange` intervals and optional Part `target` (`#4`) + `buildDailyMetricsTable()`.

### 26. Habit Domino / Cascade Chains ("When X Breaks or Clicks...")
A visual cascade in Dashboard / Insights showing sequential ripple effects over `0..3` days: e.g., *Late Sleep (<6h) -> Skipped Workout (68% next day) -> Lower Mood (-1.1)*—making lag findings read like a simple causal chain rather than isolated statistical cards.
- **Hook**: Reuses `CandidateResult[]` from `generator.ts` (`binary_outcome` + `library_lag` + `numeric_outcome` lag edges).

### 27. Year-in-Pixels Dual Matrix (Mood x Stickers)
An annual zoom view inside Archive showing all 365 days packed into a single crisp pixel/sticker tapestry (toggle between **Rating Color Grid**, **Memorability Jewels**, and **Tiny Sticker Icons**), with hover/tap jumping directly to any day via the global Day Inspector.
- **Hook**: Reuses `days[]` across all chapters + `getStickerById` + `HeatmapCalendar` layout helpers.

### 28. Sunday Weekly Digest Ritual Card (In-App Sunday Pause)
Every Sunday evening (when the form window opens), show an optional collapsible **7-Day Glance Card** right above tonight's nightly form: week's 7 stickers in a row, top rating swing vs prior week, mini Sparkline, and a 1-sentence fill prompt—replacing sterile notifications with a cozy weekly pause inside the app.
- **Hook**: Reuses existing Sunday trigger schedule cadence (`last_7_days`), `Day[]`, and `MetricsCalculator`.

### 29. Dream Symbol & Theme Lexicon (Recurring Symbols Counter)
Automatically extracts frequent keywords and Library items across all dream/sleep notes, ranking recurring motifs (places, people, emotions, motifs like *"water"*, *"exam"*, *"flying"*) over time with a first-seen date, recent frequency sparkline, and co-occurring sleep quality.
- **Hook**: Reuses `items` from Dream/Theme libraries + tokenized dream `text` parts + `deepStats.ts`.

### 30. Self-Contained Offline HTML Keepsake Archive Export
Alongside `.zip` backup and Storybook Print PDF, export a single standalone `.html` archival chronicle per chapter (inline SVG stickers, inline photos as data URLs, embedded CSS matching that chapter's theme) that opens beautifully offline in any desktop or mobile browser 20 years from now with zero dependencies.
- **Hook**: Pure string template builder reusing `FrozenChapter`, `days[]`, `chapterAnswers[]`, and sanitized SVG theme tokens.

### 31. Smart Backfill Catch-Up Stack
When you missed 2 or 3 days inside the open backfill window (`today-3 .. today-1`), offer a streamlined **"3-Minute Catch-Up"** stepped stack on Home letting you breeze through Header + Rating + Sticker + Core habits for all missed days in sequence without reopening modals 3 times.
- **Hook**: Wraps existing `NightlyFormModal` save pipeline sequentially over `missingDays[]`.

### 32. Milestone Celebration Badges on Mascot Stage (Non-Gamified Milestones)
Subtle organic celebrations on `CharacterStage` (confetti SVG petals / crown prop overlay when closing a chapter, crossing 50/100/365 lifetime logged days, or hitting a long-term Task Milestone `#4`), zero streak-guilt penalties or intrusive popups.
- **Hook**: Reuses `CharacterStage` ambient mood props + lifetime `days.length` / `taskMilestones.length`.

---

## Ideas Postponed / Deferred Beyond Phase E

### 10. Integrations and imports (Native wrapper or External CSV)
Bring numbers in from other apps (Health Connect, fitness wearables, Tally finance exports). Requires CSV column-mapper UI or Capacitor native wrapper feeding external daily numeric sources into `MetricsCalculator`.

### 11. Cloud sync
Multi-device desktop/mobile sync (UUIDs, `updatedAt`, and soft `deletedAt` tombstones are already sync-ready; requires auth + backend sync endpoint).

### 12. Optional AI features
Strictly opt-in later: summarizing rambling dreams while preserving raw original text, or natural-language queries over frozen summaries.

---

## Parked (not planned right now)
- PIN or fingerprint lock (WebAuthn).
- Reminder notifications beyond the three in v1.
- Standalone in-app voice-to-draft dictation UI (`SpeechRecognition` API; native Gboard mic already covers voice typing smoothly).

## Decided against (do not add)
Rest days (missing is already handled), pinned insights on Home (the greeting + baseline drift whisper is enough), encrypted exports, direct Google Drive upload (the share sheet is enough), a separate standalone goals-only tab (goals are cleanly unified inside the To-Do + Expiry + Milestones system and Form Builder per-part targets), and a separate "more themes/sticker packs/skins" idea (already shipped in Phase 9 & Phase C).

---

## Suggested Phase E Build Order (once you shortlist)
1. **Stage E1 — Quick Inputs & Daily Polish**: Quick-Log Dream/Pocket Note drawer + PWA shortcuts (#5), QOTD 50+ prompts + Profile toggle (#6), Baseline Drift Greetings (#17), Dashboard Mode Filter (#18).
2. **Stage E2 — Task Deadlines, Long-Term Goal Milestones & Part Targets**: `TaskItem` + `TaskMilestone` schema, Form Editor per-part Target thresholds + Dashboard dotted lines (#4).
3. **Stage E3 — Rich Analytics & Health**: Data Health Check (#9), Explore v2 (#3), 24h Circadian Polar Clock (#14), Deeper Library Item Pages + Tag Constellation (#7), Chapter vs Chapter Comparison (#8), plus any chosen brainstorm items (#19–#23).
4. **Stage E4 — Memories, Sharing & Storybook Finale**: Echoes / On This Day (#16), Seasonal Sticker Quilt + Photo Lightbox (#15), Closing Ceremony Keepsake Poster PNG (#13), Wrapped Decks (#2), and finally **Storybook Chapter View + PDF Print Export** (#1).
