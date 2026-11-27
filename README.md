# Trinqle (v1.0.0)

**Trinqle** is a local-first, offline-capable PWA personal journal designed for mobile use. Each night you complete a customizable structured form (yes/no gates, scales, numbers, 24-hour time ranges, creatable tag libraries, repeating session blocks, and short text) alongside your companion persona **Piqsie**. All journal data stays in your browser's IndexedDB, powering interactive dashboards, chapter heatmaps, cycle tracking, full-text fuzzy archive search, a seeded statistical insights engine (running offline in a Web Worker), and frozen multi-chapter Storybooks.

---

## Key Features

- **100% Local-First & Offline PWA:** Stored in IndexedDB via Dexie (`trinqle_db`), installable with manual-prompt service worker updates (`registerType: 'prompt'`) and locally bundled `@fontsource/*` fonts across all 7 themes (`Cutesy`, `Baked Clay`, `Cyberpunk`, `Retro`, `Royal`, `Newspaper`, `Sports`).
- **Structured Form & Repeating Sessions:** Paged Full mode or Quick (~2 min) mode, core vs optional parts, tri-state `yesno` gates starting blank, nested sub-questions, `showWhen` rules, 24-hour Dual-Clock `TimeRangeWidget` supporting midnight crossing, and effective-dated live Form Editor.
- **Chapters & Frozen Archives:** 20–45 day chapters (default 28), hard-lock Closing Ceremony (`ChapterGate`) with reflections and up to 10 compressed photos, closed-chapter Dexie write protection, and monochrome Archive Mode viewing frozen chart snapshots and insights.
- **On-Device Statistical Insights Engine:** Deterministic Web Worker analysis covering paired correlations, lags (`0..3`), weekday trends, cycle-phase effects, anomalies, change points, library item lags, compound rules, and an interactive **Explore** builder.
- **Backup, Safety Snapshots & Data Health Check:**
  - Verified **Full Backup ZIP** (`formatVersion: 2`) exporting all 16 stores (excluding push secrets) with dry-run validation before share/download and atomic single-transaction restore (Replace or Merge).
  - Persistent storage auto-request + status indicator (`Protected` / `Not protected`), honest backup timestamps, and weekly/nights-since Home nudge.
  - Separate `trinqle_snapshots_db` automatically retaining the last **5** safety snapshots before Delete All, Import Replace, Chapter Close, and Data Health repairs.
  - Read-only **Data Health Check** scanning orphaned answers, empty/broken photo blobs, out-of-range values, duplicates, DB size, and clickable missing nights.
- **Hardened Optional Web Push Reminders:** Stateless Vercel Functions (`api/`) + Upstash Redis (`KV_REST_API_*`), per-device 32-byte `manageToken` (`SHA-256` + `timingSafeEqual`), endpoint host allowlist, strict CSP in `vercel.json`, and `DOMPurify` SVG sanitization.

---

## Local Development

```bash
npm install
npm run dev
```

On an empty installation, tap **"See the scope of the app using fresh demo data"** on Home to import the starter form pack and generate 3 chapters (2 frozen closed chapters, 1 open chapter), menstrual cycles, dashboard charts, and insights in one click. (Developer demo tools in Profile are gated behind `import.meta.env.DEV` or `localStorage.setItem('trinqle_dev_mode', '1')`.)

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
KV_REST_API_URL=           # Upstash Redis REST URL (linked in Vercel Storage)
KV_REST_API_TOKEN=         # Upstash Redis REST token
```

For scheduled reminders via [`.github/workflows/notify-cron.yml`](.github/workflows/notify-cron.yml), configure repository secrets `CRON_SECRET` and `VERCEL_PROJECT_URL`.
