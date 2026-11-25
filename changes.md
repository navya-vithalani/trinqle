# Trinqle: Changelog & PRD/TRD Drift Log

This file records bug fixes applied to the codebase and tracks every place where the current implementation drifts from [docs/PRD.md](docs/PRD.md), [docs/TRD.md](docs/TRD.md), or [docs/design.md](docs/design.md).

---

## 1. Fixes Applied (Bug, Logic, Security & Consistency Pass)

### Security & Backend
- **[api/send.ts](api/send.ts)**: Closed an authentication bypass where passing `{"test": true}` without `endpoint` skipped `CRON_SECRET` verification and triggered the full subscriber cron broadcast. `test: true` now requires a valid `endpoint`, always returns from the test branch, and body parsing runs before auth checks.
- **[api/kv.ts](api/kv.ts)**: Replaced sequential `N+1` `await fetch(...)` calls in `SubscriptionStore.getAll()` with `Promise.all(...)` to avoid serverless timeouts as subscriptions grow.
- **[src/core/search.ts](src/core/search.ts)**: Added `escapeRegex()` for user search queries (prevents `RegExp` syntax crashes on characters like `[` or `(`) and `escapeHtml()` before wrapping matches in `<mark>` tags (prevents HTML injection / XSS via `dangerouslySetInnerHTML` in `ArchiveScreen`).
- **[src/characters/sanitizer.ts](src/characters/sanitizer.ts)**: Hardened `sanitizeSvg()` with fixed-point iterative tag stripping, disallowed `<style>` / `<base>` tags, event-handler stripping without requiring leading whitespace (e.g., `<svg/onload=...>`), external `http(s)://` and `data:` link stripping, and a browser `DOMParser` allowlist pass when available.
- **[src/core/zip.ts](src/core/zip.ts)**: Added ZIP path-traversal guards (`..`, leading slashes, null bytes), entry-count limits, and bounds checks on `readZipArchive()`.

### Data Integrity, Engine & UI Bugs
- **[src/data/repositories/DayRepository.ts](src/data/repositories/DayRepository.ts)**: `deleteDay()` now soft-deletes `answerLinks` alongside `days` and `answers` so deleted entries do not leave stale library tag counts.
- **[src/data/repositories/ChapterRepository.ts](src/data/repositories/ChapterRepository.ts)**: `updateChapter()` now enforces closed-chapter write protection.
- **[src/ui/screens/DashboardScreen.tsx](src/ui/screens/DashboardScreen.tsx)**:
  - Loaded real `Section` names from `FormRepository.getSections()` instead of stripping `s_` from `sectionId` (fixes UUID display for custom sections).
  - Removed the `links.length > 0 ? links : filteredLinks` fallback on `LibraryMetricCard` so unused libraries do not display tags from other libraries.
  - Applied `searchQuery` and `selectedSectionId` filters to the Journal (`text`) view.
  - Replaced UTC `new Date().toISOString().slice(0, 10)` date-scope anchor with `logicalDate(...)`.
- **[src/ui/dashboard/LibrariesListView.tsx](src/ui/dashboard/LibrariesListView.tsx)**: Resolved real `Question` and `Part` labels for `ItemHistoryModal` via `AnswerLink.answerId -> Answer` instead of hardcoding `'Tagged activity'`.
- **[src/core/engine/generator.ts](src/core/engine/generator.ts)**: Fixed inverted `sureness` formula where `n < 5` could score higher (`1.8`) than `n = 5..7` (`0.95`); `sureness` now scales monotonically with `n` while remaining `< 1.0` for `n < 8`.
- **[src/ui/screens/InsightsScreen.tsx](src/ui/screens/InsightsScreen.tsx)**: Fixed stale `selectedRun` / `insights` mismatch after `handleGenerate()` by passing `savedRun.id` to `loadData(savedRun.id)`.
- **[src/ui/form/NightlyFormModal.tsx](src/ui/form/NightlyFormModal.tsx)**:
  - Initialized `overallRating` as `undefined` (`Unrated`) instead of `7.5` so untouched forms do not skew rating averages.
  - Scoped `checkOverlappingTimeRanges()` per question instead of across unrelated questions (e.g., Sleep vs Study).
  - Rendered the selected sticker `<img>` in the Day Header picker button instead of text-only display.
  - Exposed all 4 memorability levels (`0` Normal, `1` Notable, `2` Outstanding, `3` Star) matching `types.ts`, `HeatmapCalendar`, and `ArchiveScreen`.
  - Enforced `completeness.complete` on `Save` / `Save changes` when editing existing days.
  - Used the form's logical `date` instead of `todayLogicalDate` when starting/ending a period during backfill.
  - Filtered displayed questions through `isQuestionVisible()` from `core/formEngine.ts` so `showWhen` and `schedule.weekdays` take effect in the UI.
- **[src/ui/widgets/TimeRangeWidget.tsx](src/ui/widgets/TimeRangeWidget.tsx)**: Added `useEffect` sync when async `value` loads, and added a `Next AM` phase button on the End clock.
- **[src/ui/archive/ArchiveHomeScreen.tsx](src/ui/archive/ArchiveHomeScreen.tsx)**: Revoked `URL.createObjectURL()` blob URLs cleanly in `useEffect`, and resolved reflection prompt labels from `chapter.frozen?.formSnapshot` and `chapter.customPrompts`.
- **[src/ui/screens/ArchiveScreen.tsx](src/ui/screens/ArchiveScreen.tsx)**: Populated Search's section dropdown dynamically from `FormRepository.getSections()`.
- **[src/tools/demoData.ts](src/tools/demoData.ts)**: Used `logicalDate` instead of UTC date slicing and populated `frozen` payloads via `buildFrozenChapter()` for closed demo chapters.
- **[index.html](index.html), [src/index.css](src/index.css), [src/ui/components/ErrorBoundary.tsx](src/ui/components/ErrorBoundary.tsx)**: Fixed malformed CSS variable classes on `<body>`, removed `user-scalable=no`, scoped Retro theme button styling to `.sticker-button` instead of all `<button>` elements, and replaced hardcoded Cutesy hex colors in `ErrorBoundary` with theme CSS variables.

### Phase A: Global Architecture & Core Invariants
- **[src/core/settings.ts](src/core/settings.ts)**: Added centralized `loadAppSettings()` unifying saved Profile settings (`user_name`, `form_window_start`, `form_window_end`, `week_start`, `time_format`) and seeded fallback keys (`windowStartHour`, `windowEndHour`, `weekStart`, `timeFormat`), plus `formatTimeByPreference()`.
- **[src/ui/App.tsx](src/ui/App.tsx)**: Lifted the Day Inspector (`NightlyFormModal`) globally so tapping any day in Dashboard, Insights, Archive, or Home opens directly without tab-switching; added `?tab=` deep-link parsing from push notifications; wired `archiveReadOnly` to `ProfileScreen` and `frozenChapter` to `InsightsScreen`; runs `migrateLegacyLibraryAnswersIfNeeded()` on startup.
- **[src/data/migrations.ts](src/data/migrations.ts), [src/ui/widgets/LibraryWidget.tsx](src/ui/widgets/LibraryWidget.tsx), [src/data/repositories/LibraryRepository.ts](src/data/repositories/LibraryRepository.ts)**: Migrated legacy item-name library answers to canonical `Item.id[]` arrays + `AnswerLink` records and added 1-tap `Recent:` item chips.
- **[src/ui/widgets/TimeRangeWidget.tsx](src/ui/widgets/TimeRangeWidget.tsx)**: Switched default dial snapping to **5 minutes** (matching PRD F5), added direct `<input type="time">` keyboard fallback, and added `timeFormat` (`12h`/`24h`) display support.
- **[src/ui/components/Navbar.tsx](src/ui/components/Navbar.tsx)**: Wired bottom navigation icons dynamically through `getTheme(themeId).iconSet`.
- **[src/ui/components/HeatmapCalendar.tsx](src/ui/components/HeatmapCalendar.tsx), [src/ui/components/CycleHealthView.tsx](src/ui/components/CycleHealthView.tsx), [src/ui/components/UnifiedCalendarCard.tsx](src/ui/components/UnifiedCalendarCard.tsx)**: Wired `weekStart` (`Monday`/`Sunday`), aligned Heatmap days onto real weekday columns, and connected `"Convert / Discard as Spotting"` to `CycleRepository.deleteCycle()`.
- **[src/core/greetings.ts](src/core/greetings.ts), [src/ui/components/CharacterStage.tsx](src/ui/components/CharacterStage.tsx)**: Populated 3-day `form_aliases` stats (`mood3`, `moodDelta`, `sleep3Hours`, `sleepLowDays3`, `exerciseDays3`, `studyDays3`, `studyMinutes3`, `water3avg`) and `userName`, plus added ambient `sleepy`/`excited`/`normal` mascot states.
- **[api/send.ts](api/send.ts)**: Added production guard requiring `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` outside local dev.

### Phase B: Home, Form Flow & Form Editor
- **[src/ui/screens/HomeScreen.tsx](src/ui/screens/HomeScreen.tsx)**: Hid Starter Pack card once sections exist (with explicit empty-form CTA otherwise), added a completed **Today Summary Card** (rating, sticker, Edit button), added a **Chapter Reflections progress bar**, and respected `appSettings` form window & `weekStart`.
- **[src/ui/form/NightlyFormModal.tsx](src/ui/form/NightlyFormModal.tsx)**: Added **Quick (~2 min) vs Full (~10 min)** mode toggle on Step 1, initialized fresh core `yesno` toggles at `false` ("No"), rendered nested `parentId` sub-questions inline inside repeating sessions, supported both `string` and `string[]` values in `AnswerLink` persistence, and prevented edits on `lockedClosed` days.
- **[src/ui/editor/FormEditorScreen.tsx](src/ui/editor/FormEditorScreen.tsx), [src/ui/editor/PartEditorModal.tsx](src/ui/editor/PartEditorModal.tsx)**: Fixed effective-dating `validFrom`/`validTo` bounds (`logicalToday` for retirements, `nextChapter` start date for future schedule changes); wrapped priority toggles, part additions, and kind changes (`retirePart` + `createPart`) in `ScopePromptModal`; enforced Core sibling rule for `gate` parts; added UI editors for `repeats`, `schedule.weekdays`, `showWhen`, and inline `+ Sub-question` with parts; added live **Quick/Full time-cost badge** and **Activity -> Routine upgrade suggestions** (`>= 48` days in 12 weeks).

### Phase C: Archive, Frozen Views, Export/Import & Custom Stickers
- **[src/core/freeze.ts](src/core/freeze.ts), [src/data/repositories/ChapterRepository.ts](src/data/repositories/ChapterRepository.ts), [src/ui/archive/FrozenDashboardView.tsx](src/ui/archive/FrozenDashboardView.tsx)**: Froze `library_frequency`, `text_summary`, and `memorability` chart models plus active `insights` during chapter closing ceremony and rendered all 6 chart types in `FrozenDashboardView`.
- **[src/ui/screens/InsightsScreen.tsx](src/ui/screens/InsightsScreen.tsx), [src/ui/screens/ProfileScreen.tsx](src/ui/screens/ProfileScreen.tsx)**: Enforced full Archive Mode lock (`frozenChapter` snapshot in Insights + `archiveReadOnly` notice/disable in Profile).
- **[src/core/zip.ts](src/core/zip.ts), [src/core/export.ts](src/core/export.ts), [src/ui/dialogs/ImportDialog.tsx](src/ui/dialogs/ImportDialog.tsx)**: Added `readZipArchiveAsync()` supporting Deflate (method 8) alongside Store; expanded ZIP exports/imports to include `chapterAnswers.json`, `cycles.json`, `insights.json`, `stickers.json`, and MIME-accurate photo blobs; upgraded `ImportDialog` to accept both `.json` form packs and `.zip` chapter archives with preview and `Replace`/`Skip` conflict handling.
- **[src/core/stickers.ts](src/core/stickers.ts), [src/ui/dialogs/StickerPickerModal.tsx](src/ui/dialogs/StickerPickerModal.tsx), [src/ui/screens/ProfileScreen.tsx](src/ui/screens/ProfileScreen.tsx)**: Added custom SVG (`sanitizeSvg`) and raster (downscaled to 256px) sticker upload, management in Profile > Stickers, and rendering in Picker, Nightly Form, and Today Summary.

### Phase D: Insights Engine Hardening & Interactive Explorer
- **[src/core/engine/generator.ts](src/core/engine/generator.ts), [src/core/engine/types.ts](src/core/engine/types.ts), [src/data/repositories/ChapterRepository.ts](src/data/repositories/ChapterRepository.ts)**: Integrated `detrendWeekday()` adjustment on mature series (`n >= 5` per weekday), **cycle-phase** significance testing (`menstrual`, `luteal`, `follicular`), **2-to-3-way compound rules**, `maxTests` (50,000) truncation safety guard, and `db.baselines` updates on chapter close.
- **[src/core/engine/insights.worker.ts](src/core/engine/insights.worker.ts), [src/core/engine/workerClient.ts](src/core/engine/workerClient.ts), [src/ui/screens/InsightsScreen.tsx](src/ui/screens/InsightsScreen.tsx)**: Moved statistical analysis off the main thread into a Web Worker (`runInsightsAsync`), added an analysis **Window selector** (`All Time`, `Open Chapter`, `Last 4 Weeks`, `Last 7 Days`), and built the **`Explore`** sub-tab with Factor X, Outcome Y, 0-3 day Lag slider, live Spearman / Mann-Whitney stats, and inline SVG scatter / group-comparison charts.

---

## 2. Current Drifts from PRD / TRD / Design

These remaining differences between the original specifications (`docs/PRD.md`, `docs/TRD.md`, `docs/design.md`) and the current codebase are either intentional UX improvements or environment/dependency trade-offs:

1. **Bottom Navigation Order (`Navbar.tsx` vs `design.md` Section 4)**
   - **PRD / Design**: `Home, Dashboard, Insights, Archive, Profile`.
   - **Current Code**: `Archive, Dashboard, Home, Insights, Profile` (centered Home button accented per theme).
   - **Status**: Intentional ergonomic improvement (centered Home thumb target); kept unless you prefer the original left-to-right order.

2. **Time Range Picker (`TimeRangeWidget.tsx` vs `PRD.md` F5 / `design.md` Section 5)**
   - **PRD / Design**: Interactive draggable **24h horizontal track** with **5 min snapping** and a direct text-entry fallback.
   - **Current Code**: Vertical 24h summary bar + **Dual 12-hour circular clock dial modal** with **5 min snapping**, `Next AM` phase selector, `12h`/`24h` formatting, and `<input type="time">` direct-entry fallback.
   - **Status**: Dual-clock modal preserved for theme polish while fulfilling 5-min precision and direct input.

3. **SVG Sanitizer (`sanitizer.ts` vs `TRD.md` 1)**
   - **TRD**: `DOMPurify` (SVG profile).
   - **Current Code**: Custom zero-dependency sanitizer hardened with iterative tag/attribute stripping and a browser `DOMParser` allowlist pass.
   - **Status**: Functional zero-dependency alternative.

4. **Fonts Offline (`index.html` vs `TRD.md` 11)**
   - **TRD**: App must not depend on the network for fonts.
   - **Current Code**: `Fredoka` is bundled locally via `@fontsource/fredoka`, while theme display fonts (`Orbitron`, `Rajdhani`, `Space Grotesk`, `Comfortaa`) load via Google Fonts CDN in `index.html` with local system/sans fallbacks.
   - **Status**: Deferred; can bundle local `@fontsource/*` packages for all theme fonts if full 100% offline typography is desired.
