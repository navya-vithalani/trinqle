# Trinqle (v1.0.0)

**Trinqle** is a local-first, offline-capable PWA personal journal built for mobile life tracking. Nothing about your habits or routines is hardcoded: you design modular forms with reusable parts and creatable tag libraries, reflect each night alongside your companion persona **Piqsie**, and let a customisable, deterministic statistical engine uncover honest patterns on your device without AI or cloud storage.

---

## Key Features

- **Modular, Zero-Hardcode Life Tracking:** Define your own tracking system via importable JSON **Form Packs** (`sections`, `questions`, nested `sub-questions`, repeating sessions, `showWhen` conditional rules, weekday schedules) or live in-app **Form Editor** with effective-dated edits (`validFrom`/`validTo`). Six composable part kinds (`yesno` gates/toggles, `scale`, `number` with custom units & sum/mean aggregation, `text`, 24h midnight-crossing `timerange`, and shared `library` tags) adapt dashboards and analyses automatically.
- **Customisable & Deterministic Statistical Insights:** Runs 100% locally in a Web Worker using a seeded, repeatable statistics pipeline (`sureness`, `surprise`, combined score `>= bar`, FDR/Benjamini-Hochberg control, minimum sample gates) instead of black-box LLMs. Discovers lag `0..3` driver-outcome links (Spearman rank correlation, Mann-Whitney U, Cliff's delta), weekday-detrended shifts, cycle-phase effects, anomalies, changepoints, streaks, library item lags, and compound rules, plus an interactive **Explore** tab with custom factor/outcome/lag controls.
- **100% Local-First & Offline PWA:** Data lives on your phone in IndexedDB (`trinqle_db`), installable with manual-prompt service worker updates (`registerType: 'prompt'`) and locally bundled `@fontsource/*` fonts across 7 distinct visual themes (`Cutesy`, `Baked Clay`, `Cyberpunk`, `Retro`, `Royal`, `Newspaper`, `Sports`).
- **20–45 Day Chapters & Frozen Storybooks:** Organise life into chapters with autosaved reflections and up to 10 compressed photos. At close, a hard-lock ceremony (`ChapterGate`) snapshots the form, Dashboard chart models (`rendererVersion: 1`), and insights into read-only monochrome Archive Mode protected at the database hook level.
- **Backup, Safety Snapshots & Data Health Check:**
  - Verified **Full Backup ZIP** (`formatVersion: 2`) exporting all 16 stores (excluding push secrets) with dry-run validation before share/download and atomic Replace/Merge restore.
  - Automatic `navigator.storage.persist()` check + Profile protection warning, honest `last_backup_timestamp` tracking, and Home backup nudge banner.
  - Separate `trinqle_snapshots_db` automatically keeping the last **5** safety snapshots before Delete All, Import Replace, Chapter Close, and Data Health fixes.
  - Read-only **Data Health Check** reporting orphaned answers, empty/broken photo blobs, out-of-range values, duplicates, DB size, and clickable missing nights.
- **Hardened Optional Web Push Reminders:** Stateless Vercel Functions (`api/`) + Upstash Redis (`KV_REST_API_*` / `UPSTASH_REDIS_REST_*`), per-device 32-byte `manageToken` (`SHA-256` + `timingSafeEqual`), endpoint host allowlist, strict CSP in `vercel.json`, and `DOMPurify` SVG sanitization.

---

## Database Schema (IndexedDB via Dexie)

Every mutable entity extends `BaseRecord` (`{ id: UUIDv7, createdAt, updatedAt, deletedAt? }`) so records remain soft-deletable and sync-ready.

### Main Database: `trinqle_db` (v1)

| Store | Primary Key & Indexes | Purpose |
|---|---|---|
| `sections` | `id`, `order`, `scope`, `validFrom`, `validTo`, `deletedAt` | Form sections (`daily`, `weekly`, `chapterEnd`) |
| `questions` | `id`, `sectionId`, `parentId`, `order`, `validFrom`, `validTo`, `deletedAt` | Top-level & sub-questions, repeating sessions, `showWhen` rules, `cycle` flag |
| `parts` | `id`, `questionId`, `order`, `kind`, `level`, `validFrom`, `validTo`, `deletedAt` | Input atoms (`yesno`, `scale`, `number`, `text`, `timerange`, `library`), `core`/`extra`, `gate` |
| `libraries` | `id`, `name`, `retired`, `deletedAt` | Shared reusable tag/item lists (Activities, People, Places, Foods, etc.) |
| `items` | `id`, `libraryId`, `name`, `retired`, `mergedInto`, `deletedAt` | Entries belonging to a `Library` |
| `days` | `date` (PK `YYYY-MM-DD`), `chapterId`, `memorability`, `mode`, `backfilled`, `filledAt`, `deletedAt` | Daily headers (title, one-liner, sticker, rating, memorability, mode, timezone) |
| `answers` | `id`, `[date+partId+instance]`, `date`, `questionId`, `partId`, `deletedAt` | Normalized part answers per logical date & repeating session `instance` |
| `answerLinks` | `id`, `answerId`, `date`, `libraryId`, `itemId`, `deletedAt` | Denormalized index linking library answers to tags/items for fast queries |
| `cycles` | `id`, `startDate`, `endDate`, `deletedAt` | Menstrual cycle spans across chapters |
| `chapterAnswers` | `id`, `[chapterId+promptId]`, `chapterId`, `promptId`, `deletedAt` | Chapter-level reflection answers & custom prompt responses |
| `chapters` | `id`, `status`, `startDate`, `plannedEndDate`, `endDate`, `deletedAt` | Open/closed chapters (20–45 days), photos (`Blob[]`), and frozen chart/insight snapshots |
| `baselines` | `id`, `metricKey`, `asOfChapterId`, `deletedAt` | Per-weekday rolling mean/SD baselines updated on chapter close |
| `runs` | `id`, `at`, `trigger`, `deletedAt` | Insights Engine execution runs (window bounds, bar threshold, counts) |
| `insights` | `id`, `runId`, `signature`, `score`, `status`, `deletedAt` | Discovered insights, evidence days, sureness/surprise scores, and user ratings |
| `stickers` | `id`, `name`, `builtin`, `deletedAt` | Built-in and imported custom stickers (`DOMPurify`-sanitized SVGs or 256px rasters) |
| `settings` | `key` (PK) | User settings (`user_name`, form window hours, `timeFormat`, `weekStart`, backup timestamps) |

> **Write-Lock Guarantee:** Dexie hooks on `chapters`, `days`, `answers`, `answerLinks`, and `chapterAnswers` block mutations touching closed chapters unless explicitly executed via `runBypassingClosedGuard()` during verified imports, reset, or demo seeding.

### Safety Snapshot Database: `trinqle_snapshots_db` (v1)

| Store | Primary Key & Indexes | Purpose |
|---|---|---|
| `snapshots` | `id`, `createdAt`, `reason` | Isolated store retaining the 5 most recent verified full-backup ZIP payloads (`before_delete_all`, `before_import_replace`, `before_chapter_close`, `before_health_fix`, `manual`) |

---

## Local Development

```bash
npm install
npm run dev
```

On an empty installation, tap **"See the scope of the app using fresh demo data"** on Home to import the starter form pack and generate 3 chapters (2 frozen closed chapters, 1 open chapter), menstrual cycles, dashboard charts, and insights in one click. Developer demo tools in Profile are gated behind `import.meta.env.DEV` or `localStorage.setItem('trinqle_dev_mode', '1')`.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server (regenerates PWA icons first) |
| `npm run build` | Run TypeScript typecheck (`tsc`) + production PWA build |
| `npm run lint` | Run ESLint across all `.ts` / `.tsx` files |
| `npm test` | Run Vitest unit & integration test suite (zero-emoji check included) |
| `npm run test:e2e` | Run Playwright mobile viewport (`390x844`) end-to-end tests |
| `npm run preview` | Preview production `dist/` bundle |

---

## Environment Variables (Optional Web Push Only)

Core journaling, dashboards, insights, backups, and offline mode require **zero environment variables**. To enable background Web Push reminders on Vercel:

```env
VAPID_PUBLIC_KEY=          # P-256 public key (base64url)
VAPID_PRIVATE_KEY=         # P-256 private key (base64url)
VITE_VAPID_PUBLIC_KEY=     # Same public key exposed to Vite client build
VAPID_SUBJECT=mailto:you@example.com
CRON_SECRET=               # Random bearer secret protecting /api/send
KV_REST_API_URL=           # Redis REST URL (or UPSTASH_REDIS_REST_URL)
KV_REST_API_TOKEN=         # Redis REST token (or UPSTASH_REDIS_REST_TOKEN)
```

For scheduled reminders via [`.github/workflows/notify-cron.yml`](.github/workflows/notify-cron.yml), configure repository secrets `CRON_SECRET` and `VERCEL_PROJECT_URL`.
