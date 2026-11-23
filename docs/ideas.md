# Trinqle: Ideas backlog (post-MVP)

Nothing here is part of v1 (see PRD.md, plan.md). Each idea has notes and, where needed, a **hook** v1 must keep so it can be added without a rewrite. Add new ideas at the bottom of the right section. Do not build from this file without an explicit instruction.

## Approved ideas

### 1. Storybook chapter view (build last, after everything else works)
Replaces the "app as it looked" archive mode with a **storybook** per closed chapter:
- Cover: chapter title and dates, with Piqsie moving around.
- Page 1: the big-picture reflections for that chapter.
- About 10 **hand-picked graphs** (chosen from the 50 to 60 possible charts, only those that show something real).
- Hand-picked **insights** that made sense during the month.
- **All memorable days** with the full form entry.
- A few **favourite days** of any kind: just the day's title/one-liner plus the Highlights text.
- Favourite **question-of-the-day** answers (see idea 6).
- Photos (up to 10). Page-turn animation, themed.
- **Printable export:** the storybook can be exported as a PDF to print.
Notes: selection happens in the Close Chapter flow (extra steps: pick graphs, insights, favourite days and prompt answers) and is stored as `bookSelection { chartIds[], insightIds[], favoriteDates[], promptDates[] }`. Chapters closed before this feature get an auto-pick (top graphs by variance, top insights by score, memorable days). Open question: can the selection change after close? (Closed chapters are currently fully read-only.)
Hooks in v1: freeze stores all chart models and all insights with stable ids; per-metric chapter stats; the starter form has a freestyle Highlights text part.

### 2. Wrapped (weekly, per chapter, yearly)
A Spotify-Wrapped style set of 7 to 8 slides showing the most outstanding things: biggest change vs baseline, record streaks, most-used library item, top activity time, best and worst day, top insight, a memorable day, plus a few **quoted texts** from what you wrote. Weekly wrapped opens from a button inside the chapter; the chapter wrapped is the "monthly" one; the yearly wrapped is built from chapter stats and frozen insights.
Notes: slides are chosen by rule (largest deviations, records, rarity). **Quote picking (rule-based):** candidate text blocks from days with high significance (memorable level, extreme overall rating vs your normal), scored by distinctiveness (TF-IDF over your whole history) and a length sweet spot, de-duplicated, capped at 2 to 3 quotes. **Storage:** wrapped is generated on demand from data already stored; at most cache a small spec (selected metric ids and quote ids, a few KB each). It adds almost no storage.

### 3. Explore (inside the Insights tab: Generate | Explore)
Pick any two metrics and see how they relate: scatter plot, a **lag slider**, adjustable scales, split by weekday or by yes/no, a correlation readout with sample size and sureness. The manual counterpart to the automatic insights; reuses the engine's tests and the metrics registry.

### 4. To-do list
Add tasks any time; the next day they appear as a checklist to tick off. Notes: `Task { id, text, createdOn, showOn (default next day), doneAt? }`; a Home card; ticking feeds a metric (done vs planned) into the metrics registry so insights can use it. **Goals and targets** (e.g. a target per number metric) belong here, not as a separate feature. Many behaviours still to decide (unticked tasks, repeating tasks, per-day targets).
Hook: the metrics registry accepts external metric sources.

### 5. Dream quick-log
Log a dream any time of day without opening the nightly form. Notes: `DreamNote { id, at, text }`; reachable from Home and from an Android **app shortcut** (long-press the app icon via the manifest `shortcuts` field); voice via Gboard. When tonight's form opens, notes attach to the dream story of the matching sleep block (appended with timestamps, raw text kept). Cheap enough to move into the MVP if wanted.

### 6. Question of the day
A pool of 20 to 30 prompts; one is picked at random each day (seeded by date, avoids repeats) and shown as an optional casual text answer in the form. When closing a chapter, you can pick favourite answers to include in the storybook alongside the Highlights. Notes: prompts live in their own list (editable); the answer is stored as a normal text answer for that day with the prompt id.

### 7. Libraries, deeper linking (beyond the v1 Libraries view)
The v1 Libraries view lists items, uses and the days they appear on. The deeper version adds per-item pages: co-occurrence with other items, mood and energy around those days, timeline, "last seen", lag patterns (for example a person showing up in dreams a few days after you meet them).

### 8. Chapter comparison
This chapter vs the previous one vs your baseline, side by side. Works from the per-metric **chapter stats** stored at freeze (n, mean, median, sd, min, max, fill rate), shown as deltas per metric and grouped by section. Separate from the running baseline, which is recency-weighted.
Hook in v1: `FrozenChapter.stats`.

### 9. Data health check
Spots oddities (overlapping sessions, impossible durations, a period open too long, a number far outside your normal) and shows a small alert on Home: "This looks odd, fix it or keep it?" Dismissed items are remembered.

### 10. Integrations and imports (later, probably with a native wrapper)
Bring numbers in from other apps: steps and health data, spending from a finance tool such as Tally, and more. A PWA cannot read Health Connect or other apps directly, so options are: (a) CSV/export import through the existing Import dialog (works in the PWA), or (b) wrap the same web code in a native shell (for example Capacitor) to use native plugins such as Health Connect, with no rewrite. Imported numbers become **external metric sources** in the registry (same daily-number shape as form parts), so they appear in the dashboard and insights automatically.

### 11. Cloud sync
Use on laptop and multiple devices. The data model is already sync-ready (UUIDs, `updatedAt`, soft deletes). Needs a backend, login and conflict handling.

### 12. Optional AI features
Kept deliberately vague until we know how it should work. Candidates: condensing a rambling dream while keeping the user's own words (raw text always kept), or friendlier phrasing of insights. Strictly opt-in, no AI in v1.

## Parked (not planned)
- PIN or fingerprint lock (WebAuthn).
- "On this day" memories from earlier chapters (uses the search index).
- Reminder notifications beyond the three in v1 (revisit depending on how the app is actually used).

## Decided against (do not add)
Rest days (missing is already handled), pinned insights on Home (the greeting is enough), encrypted exports, direct Google Drive upload (the share sheet is enough), a separate goals feature (folded into the to-do idea), and a separate "more themes/sticker packs/skins" idea (Phase 9 of plan.md already covers extra themes, sticker import and character import).
