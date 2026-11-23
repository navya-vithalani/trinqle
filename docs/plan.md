# Trinqle: Build Plan

Read PRD.md, TRD.md, design.md first. Work phase by phase. **Do not start a phase until the previous phase's exit checks pass.** Keep commits small; each phase ends with a deploy to Vercel and a manual phone check.

Cross-cutting from Phase 0: design tokens (no hardcoded colors/fonts in components), repository layer (no Dexie in UI), `formatVersion` on every file format, `core/` stays pure.

## Phase 0: Scaffold and shell
**Build:** Vite + React + TS repo, layout from TRD section 2, PWA plugin, bundled Fredoka, token system + Cutesy theme, 5-tab shell with empty states, safe-area handling, Vercel deploy, GitHub repo, CI (lint, typecheck, vitest).
**PWA icons from the logo:** keep the source at `public/icons/logo.svg` and wire `@vite-pwa/assets-generator` into the build: a `pwa-assets.config.ts` using the `minimal2023Preset`, run by an npm script (`pwa-assets-generator`) that executes before `vite dev` and `vite build`. It generates the 64/192/512 PNGs, the maskable icon, the Apple touch icon and `favicon.ico`; reference them in the web manifest and the HTML head. Changing the SVG must regenerate every icon automatically. Generated files are gitignored unless CI can't run the generator.
**Exit checks:** installs to Android home screen with the logo icon (maskable crop looks right); works offline after first load; tabs navigate; theme tokens switch light/dark; CI green; an automated check fails the build if any emoji character appears in source or content files.

## Phase 1: Data layer
**Build:** Dexie schema + migrations + repositories for every table (TRD 3), UUIDv7, soft delete, `logicalDate`, effective-dating helpers, form pack import (merge/replace) and export, schema validation with readable errors (the importer is format-driven and never tied to a specific pack). Write-protection hook for closed chapters. "Delete all data" in Profile.
**Exit checks (unit):** logicalDate across window edges, midnight and DST; effective-dating (`validFrom/validTo`); form pack import then export is identical; deleting all data resets cleanly; closed-chapter writes are rejected.

## Phase 2: Form engine and nightly form
**Build:** `core/formEngine`, all six part widgets (incl. time-range track, creatable library picker), gate/repeat/sub-question/showWhen/schedule logic, modal form (day header + mode choice; full mode paged by section with progress bar; quick mode flat list, no sections), completeness rule (core required to save), drafts, sticker library (12 built-ins + import), form window + lock, backfill (<= 3 days), editing open-chapter days (marked edited), AnswerLink writes. Build the reusable **Import dialog** (TRD 9): file picker + drag-and-drop for any form-pack JSON, validated, with a preview and merge/replace choice, fully offline. Bundle `starter-form-pack.json` only as an optional sample ("Use sample starter pack" shortcut) that goes through the same importer.
**Exit checks:** import a pack through the file dialog (invalid JSON rejected with a clear message), fill a quick night (< 2 min) and a full night; Save disabled until required core parts are answered; incomplete days don't count as filled or toward streaks; extras left missing; dream nests under each sleep block; overlapping sessions warn; backfill refused beyond 3 days; draft survives app kill; Playwright e2e passes.

## Phase 3: Chapters, Home, character, demo data
**Build:** chapter lifecycle (first-chapter prompt, 28-day default, end-date change 20 to 45, thick pre-close pop-up at T-2, **hard-lock Close Chapter gate** after the end date, always-open **Reflections sheet** with chapter-only prompts), Home (countdown, backfill banner, fill heatmap, greetings engine over `greetings.json` + form-pack aliases, cycle card with start/end + swipeable calendar + prediction), character system (roles, any number of limbs, gaits, built-in clips incl. walk/jump/dance/sleep/wave, declarative custom clips, tap reactions, stage scheduler) with **white-cat** and a test **spider** SVG (8 legs, octopod gait), empty states for every tab, Profile skeleton. **Demo data generator** in dev tools (seeded; also used for phases 5 to 7) producing months of plausible data with a `plantedEffects` config.
**Exit checks:** cycle durations and day-N correct across month boundaries; prediction only after 3 cycles; after the end date the whole app is locked behind the Close Chapter flow (use the dev simulated date), T-2 pop-up appears and can be dismissed, reflections autosave and persist all chapter, next chapter starts the day after the end date; greetings choose the right tier for sample contexts; same engine animates the cat, the 8-leg spider and a minimal SVG with only a body (missing roles skipped, no errors); walk gait phases correct per gait type; tap reactions work; reduced-motion gives static pose; generator produces N days deterministically from a seed.

## Phase 4: Form editor
**Build:** full-screen builder per design.md (Excel-style section tabs, question cards, part blocks with X and pencil, long-press to move a question): sections, questions, sub-questions, parts (all six kinds, config, core/extra, gate), drag reorder, move between sections, library manager (rename/merge/retire), scope prompt for structural edits (light edits immediate; next chapter default), core/extra toggle per part, retire not delete, kind-change = new part, Activity to Routine upgrade suggestion.
**Exit checks:** add a question mid-chapter with "from this chapter": earlier days show it as *missing*, not 0; retire a part: form hides it, old answers still exist and still resolve; rename propagates instantly; merging two library items rewrites AnswerLinks correctly; every edit survives reload.

## Phase 5: Dashboard and journal
**Build:** metrics registry (TRD 6), daily table builder, chart components per part kind (yesno heatmap+streak with gap bridging, timerange minutes + time-of-day heatmap, scale/number trend, text list, library frequency, memorability, cycle), two-way filters + search + date scope, Journal view, **Libraries view** (libraries > items with uses, first/last used, days per item, from `AnswerLink`), expand-to-full-screen, edit-in-place (open chapter).
**Exit checks:** removing a yesno part makes its streak graph disappear; adding a new activity creates its charts with no code change; streak bridges skipped days; time-of-day split of a 11 pm to 1 am session is correct; journal filters isolate all dreams; Libraries view shows correct use counts and day lists for an item, including after a merge.

## Phase 6: Close, archive, export/import, backup
**Build:** Close Chapter flow (hard lock; only confirming is mandatory; closed chapters fully read-only; steps: title, summary, 5 to 10 reflections, up to 10 photos with compression), freeze (TRD 8), archive list, **archive mode** (per-theme monochrome variant on all tabs except Home, banner, Back, frozen render, read-only; archive **Home stays colourful** and shows photos, summary, reflections, metadata, the chapter's character, with no countdown/form/cycle/backfill/heatmap), Memorable days view, **Archive Search** (TRD 11b: fuzzy across all chapters incl. the open one; filters by source, section, question, part kind, chapter, date range; phrase mode), chapter zip export (share sheet + fallback) and import (conflict handling), Back up now (open chapter), weekly backup nudge, CSV export, persistent storage request, past-forms browser.
**Exit checks:** search finds a misspelled word from a dream text and a library item name across closed and open chapters, and filtering to one question narrows results; close then reopen: dashboard identical to the moment of close, even after later form edits and a code change to a renderer (rendererVersion test); export, delete-all, import returns logically equal data; photos survive round trip; archive mode blocks all writes; archive variant keeps the theme's icons/shapes/motion and multi-series chart colours; archive Home is full colour.

## Phase 7: Insights engine
**Build:** `core/engine` per TRD 7 + Worker, scoring, dedupe, baselines, Insights tab (list, rate, discard/undo, runs history), Sunday prompt + Generate now, compositional phrasing, evidence strips.
**Validation harness (required, not optional):**
1. **Planted effects:** generate >= 120 days with known effects, e.g. mood +1.5 on exercise days; Monday mood -1; person X appears in dreams 2 days after meeting X (p 0.6 vs 0.05); sleep drops 1 h after day 70 (change point); one extreme day; a 4-day rough stretch; a large-range number (steps 2,000 to 14,000) that lifts mood; and a text `written` driver (days with a 'regret' note followed by lower mood two days later). The engine must surface each within the top 20 with sureness above 6 at n >= 90.
2. **Pure noise:** same structure, no effects. Fewer than 2 insights may exceed score 6.5; sureness distribution must be low and not inflated.
3. **Tiny data:** 2 to 5 days: runs without crashing, produces >= 20 items (weird is fine) all with sureness < 2.
4. Determinism: same data and seed give identical output. Budget: <= 10 s on 6 months of dense data on a mid-range phone.
**Exit checks:** all four validation checks pass; ratings stored but do not change scores; discarded signatures never reappear.

## Phase 8: Notifications
**Build:** VAPID push, service-worker handler, `/api` endpoints, KV store, GitHub Actions scheduler every 15 min, prefs UI in Profile (nudge time, Monday insights, chapter-ending), permission asked after first saved night, generic payloads.
**Exit checks:** subscribe/unsubscribe works; test notification arrives with app closed on Android; no journal text in any payload or server log.

## Phase 9: Themes, characters, polish
**Build:** second and third themes (e.g. royal, cyberpunk, retro) via token files, icon sets and component skins (themes control everything except layout; each defines its own archive variant); theme + character selection per chapter (stored in export); SVG import with sanitising and the role-mapping screen; multi-view characters (front/side swap); character of the month picker; animation polish; accessibility audit (axe, contrast per theme and monochrome, reduced motion); performance pass; icon set and sticker pack.
**Exit checks:** adding a new theme requires only a new file + registry line (verify by adding one); imported hostile SVG (script, onload, foreignObject) is neutralised; AA contrast in all themes; Lighthouse PWA and performance budgets met.

## Definition of done (v1)
All exit checks pass; install on the user's Android phone; one real week of use without data loss; export/import round trip verified on device.

## Deferred (post-v1)
PIN/biometric lock, direct Drive upload, optional AI condensing for dream text, cloud sync (data model already sync-ready), new part kinds (only if truly needed).
