# Feedback on PRD, Architecture & Page Design Documents

Good start on the documentation, but there are critical gaps compared to the TREA_PROMPT.md specifications. Please revise all 3 documents before building.

---

## 1. Pages: Must be 8 separate pages, NOT 3

The TREA_PROMPT.md specifies **8 distinct pages** with separate routes. Do NOT merge them:

| # | Page | Route | Purpose |
|---|------|-------|---------|
| 1 | Dashboard | /dashboard | Trip status overview, summary cards (Total/Active/Completed/Errors), trips table with stage badges, auto-refresh, filters |
| 2 | Import | /import | "Import All Trips" button, "Import Single Trip by ID" (input + button), "Reset Import State" button, current import state display, live progress |
| 3 | AI Pipeline | /ai-pipeline | All 9 stages with status counts (Waiting/Pending/Processing/Done/Error), "Run Stage Manually" per stage, "Reset Trip Stage", "Run Full Pipeline Check", "Detect Stuck Processes", per-trip dropdown with "Initialize Pipeline" and "Re-run Stage X" |
| 4 | Publisher | /publisher | **TWO separate workflows — Publisher AND Updater** (see point #6 below), toggle enable/disable, status table, per-trip buttons |
| 5 | Migration | /migration | "Run Test Migration" (batch of 5), "Run Full Migration", "Reset TripID Counter", migration log viewer, progress indicator |
| 6 | Scheduler | /scheduler | Table of ALL scheduled tasks with: editable cron expressions, enable/disable toggle, last/next run time, run/error counts, "Run Now" button, "Start All"/"Stop All" |
| 7 | Settings | /settings | ALL .env variables as form fields, "Test Connection" per service (WP/Airtable/DeepSeek/OpenAI), "Save Settings" |
| 8 | Logs | /logs | Real-time log viewer, filter by level (DEBUG/INFO/WARN/ERROR), filter by module (import/ai/publish), search, "Clear Logs", "Export Logs", color-coded |

Each page = separate route, separate file in `renderer/pages/`.

---

## 2. UI Framework: Use Vanilla JS, NOT React

The TREA_PROMPT.md specifies:
> "Use vanilla HTML/CSS/JS (no React/Vue — keep it simple and fast)"

**Remove** React, TypeScript, Vite, react-router, and tailwindcss from the tech stack.

**Use instead:**
- Plain HTML + CSS + JavaScript
- Simple CSS (custom, no framework) with the dark theme specified
- IPC via `contextBridge` + `ipcRenderer` / `ipcMain`
- Simple client-side routing (hash-based or manual page switching)

This keeps the app lightweight, fast to build, and easy to maintain.

---

## 3. IPC Channels: Must include ALL channels from TREA_PROMPT.md

Your architecture defines only 4 conceptual channels. The TREA_PROMPT.md specifies ~30 channels:

### Renderer → Main (invoke):
```
config:get, config:set
import:run, import:single, import:reset
pipeline:check, pipeline:detect-stuck
ai:run-stage, ai:reset-stage, ai:init-pipeline
publish:run, update:run, publish:toggle
migration:test, migration:run, migration:reset
scheduler:get-all, scheduler:update, scheduler:run-now, scheduler:start-all, scheduler:stop-all
trips:fetch-all, trips:fetch-one
settings:get, settings:save, settings:test
```

### Main → Renderer (events):
```
log:entry, task:started, task:completed, task:error, trips:updated
```

All of these must be defined in the architecture document.

---

## 4. Publisher vs Updater — TWO Separate Workflows

This is a critical distinction that is missing from your documents.

The project has **two completely different publishing workflows**:

### Publisher (`publisher.gs` → `publisher.js`)
- **Creates NEW trips** on WordPress (HTTP POST)
- Handles trips with `Publish_Status = "Waiting"` that have NO existing WP post
- Builds full payload from Airtable enhanced data
- Creates the trip + handles multi-language linking
- Updates Airtable with the new WordPress Post ID after creation

### Updater (`updater.gs` → `updater.js`)
- **Updates EXISTING trips** on WordPress (HTTP PUT/PATCH)
- Handles trips that ALREADY have a WordPress Post ID
- Updates only the enhanced/changed fields
- Has preservation workflow logic (keeps certain WP fields unchanged)
- Different API endpoint and payload structure

**In the UI (Publisher Page), both must be clearly separated:**
- "Run Publisher Batch" button (creates new trips)
- "Run Updater Batch" button (updates existing trips)
- Per-trip: "Publish Now" (for new) / "Update Now" (for existing)
- Table should show which trips are new vs. existing

**In the backend:**
- Two separate files: `publish/publisher.js` and `publish/updater.js`
- Two separate IPC channels: `publish:run` and `update:run`
- Two separate scheduler entries

---

## 5. Follow the Folder Structure EXACTLY

Use the exact structure from TREA_PROMPT.md:

```
fts-trip-manager/
├── src/
│   ├── config/
│   │   ├── app-config.js
│   │   ├── migration-config.js
│   │   └── config-store.js
│   ├── core/
│   │   ├── http-client.js
│   │   ├── airtable-client.js
│   │   ├── state-service.js
│   │   └── lock-service.js
│   ├── import/
│   │   ├── wp-fetch.js
│   │   ├── sync-runner.js
│   │   ├── mapper.js
│   │   └── upsert.js
│   ├── ai/
│   │   ├── ai-provider.js
│   │   ├── context-utils.js
│   │   ├── enhancement-helpers.js
│   │   ├── orchestrator.js
│   │   ├── seo-enhancer.js
│   │   ├── content-enhancer.js
│   │   ├── addons-enhancer.js
│   │   ├── highlights-enhancer.js
│   │   ├── itinerary-enhancer.js
│   │   ├── inc-exc-enhancer.js
│   │   ├── trip-facts-enhancer.js
│   │   ├── faqs-enhancer.js
│   │   └── images-enhancer.js
│   ├── publish/
│   │   ├── publisher.js
│   │   └── updater.js
│   ├── migration/
│   │   ├── migration-mapper.js
│   │   ├── migration-runner.js
│   │   └── migration-test.js
│   ├── scheduler/
│   │   └── task-scheduler.js
│   └── logger/
│       └── app-logger.js
├── main.js
├── preload.js
├── renderer/
│   ├── index.html
│   ├── styles/
│   │   └── app.css
│   ├── app.js
│   ├── pages/
│   │   ├── dashboard.js
│   │   ├── import.js
│   │   ├── ai-pipeline.js
│   │   ├── publisher.js
│   │   ├── migration.js
│   │   ├── scheduler.js
│   │   ├── settings.js
│   │   └── logs.js
│   └── components/
│       ├── trip-card.js
│       ├── stage-badge.js
│       ├── log-viewer.js
│       └── sidebar.js
├── data/
│   ├── config-store.json
│   └── logs/
├── package.json
├── .env
└── electron-builder.yml
```

---

## 6. Independent Stage Execution — CRITICAL

In the original GAS project, each of the 9 AI enhancement stages can be run **independently and separately** on any trip. This is NOT just a sequential pipeline — the user must be able to:

- **Run ANY single stage** on a specific trip without running the full pipeline
- **Re-run a completed stage** (e.g., re-run only FAQs on Trip #123 without touching other stages)
- **Skip stages** — run Stage 5 (Itinerary) directly on a trip even if Stage 3 (AddOns) hasn't run yet
- **Run a stage on multiple trips** as a batch (the original batch functions)
- **Run a stage on ONE trip** individually

This means the AI Pipeline page must have:

### Per-Stage Section (for each of the 9 stages):
- "Run Batch" button — processes all trips with status = Pending for this stage
- Trip selector dropdown + "Run This Stage on Selected Trip" button
- "Reset Stage to Pending" for a selected trip (so it can be re-processed)

### Per-Trip Section:
- Select a trip → see all 9 stage statuses
- Click any stage → options: "Run Now", "Reset to Waiting", "Reset to Pending"
- This gives full manual control over each stage independently

The IPC channels already support this:
- `ai:run-stage` — pass stage name + optional tripId (if tripId provided, run for that trip only; if not, run batch)
- `ai:reset-stage` — reset a specific stage for a specific trip

---

## 7. Missing Features to Add

Make sure these are ALL covered in the revised documents:

- [ ] Import Single Trip by ID (input field + button)
- [ ] Reset Import State button
- [ ] Detect Stuck Processes button
- [ ] Per-trip "Initialize Pipeline" control
- [ ] Per-trip "Re-run Stage X" for any of the 9 stages
- [ ] **Independent stage execution** (any stage on any trip, without full pipeline)
- [ ] **Per-stage batch run** (run one stage for all pending trips)
- [ ] **Per-stage single trip run** (run one stage for one specific trip)
- [ ] Migration page with test/full/reset controls
- [ ] Scheduler with editable cron expressions per task
- [ ] Log filtering by module (import, ai, publish, migration)
- [ ] Publisher vs Updater as separate workflows (not merged)
- [ ] "Test Connection" buttons for each service individually
- [ ] Auto-refresh on Dashboard (configurable interval)
- [ ] Prompt integrity: all AI prompts copied verbatim, never editable

---

## 8. Summary of Required Changes

| Document | What to Fix |
|----------|------------|
| **PRD** | Expand from 3 pages to 8, add all missing features, separate Publisher/Updater, add Migration page, add independent stage execution capability |
| **Technical Architecture** | Change React→Vanilla JS, Remove TypeScript/Vite/Tailwind, Expand IPC to ~30 channels, Add all 8 routes, Update folder structure, add `ai:run-stage` with optional tripId support |
| **Page Design** | Add designs for all 8 pages (not 3), detail Publisher vs Updater UI, add Import/Migration/Scheduler/Logs page designs, detail AI Pipeline page with per-stage AND per-trip controls |

**After revising all 3 documents, proceed to build following the TREA_PROMPT.md Execution Order (Phase 1 → Phase 9) exactly.**

**IMPORTANT: Write complete, production-ready code for every file. Do NOT use placeholders, TODO comments, or skeleton functions.**
