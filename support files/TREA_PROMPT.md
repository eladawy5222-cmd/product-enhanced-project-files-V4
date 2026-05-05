# TREA Prompt — Convert GAS Project to Electron Desktop App

## CONTEXT & OVERVIEW

I have an existing **Google Apps Script (GAS)** project that manages a travel/tourism automation system for **ftstravels.com**. The system syncs trips between **WordPress** (WP Travel Engine plugin), **Airtable**, and **AI services** (DeepSeek/OpenAI).

I want to **convert this entire project** into a **standalone Electron Desktop Application** that:
- Runs on any Windows PC or Windows Server
- Has a full GUI (dashboard, controls, logs, scheduler)
- Replaces ALL GAS-specific APIs with Node.js equivalents
- Can be packaged as an installable `.exe` / `.msi`
- Preserves 100% of the existing business logic

All 27 source files are in this project directory. Read ALL of them before starting.

---

## CURRENT PROJECT ARCHITECTURE

### Source Files (27 files):

**PHP (WordPress — DO NOT MODIFY):**
- `fts-trip-api-update.php` — Custom REST API plugin on WordPress

**GAS Scripts (TO BE CONVERTED TO Node.js):**

Core Infrastructure:
- `config.gs` — Configuration (API URLs, Base ID, Table Names, Link Fields, Sync Limits)
- `state.gs` — Import state management via ScriptProperties
- `utils_http.gs` — HTTP helpers (GET/POST/PATCH/DELETE) with retry & backoff
- `utils_airtable.gs` — Airtable API wrapper (CRUD + batch + find/upsert)

Import Pipeline (WordPress → Airtable):
- `wp_fetch.gs` — Fetch single/multiple trips from WP API
- `sync_runner.gs` — Incremental auto-import (paginated, daily limit, batch)
- `mapper.gs` — Transform WP JSON → Airtable fields (Trips + 12 child tables)
- `upsert.gs` — Write data to Airtable (create/update + replace children)

AI Enhancement Pipeline (9 sequential stages):
- `ai_enhancer.gs` — Stage 1: Content (Overview, Description, Itinerary Desc, Tab Content, Duration)
- `ai_addons_enhancer.gs` — Stage 2: Enhanced Add-ons + 3 fixed items
- `ai_highlights.gs` — Stage 3: 5-10 trip highlights
- `ai_itinerary_enhancer.gs` — Stage 4: 5-30 itinerary steps
- `ai_includes_excludes.gs` — Stage 5: 4-16 includes, 4-6 excludes
- `ai_trip_facts.gs` — Stage 6: Exactly 6 trip facts
- `ai_faqs_enhancer.gs` — Stage 7: 8-12 FAQs
- `ai_seo_enhancer.gs` — Stage 8: SEO (Title, Meta, Permalink, Keywords, Excerpt)
- `ai_images_enhancer.gs` — Stage 9: Image SEO (Title, Caption, Alt) via OpenAI

Pipeline Orchestration:
- `enhancement_orchestrator.gs` — Sequential stage progression (Waiting → Pending → Processing → Done)
- `enhancement_helpers.gs` — Status updates, ImprovementRepository, claimStage_ (lease locking)
- `context_utils.gs` — buildUnifiedTripContext_ (aggregates all trip data for AI)

Publishing Pipeline (Airtable → WordPress):
- `publisher.gs` — Create new WP trips from Airtable enhanced data
- `updater.gs` — Update existing WP trips with enhanced data

Migration:
- `migration_config.gs` — Old base → new base migration settings
- `migration_mapper.gs` — Field mapping for migration
- `migration_runner.gs` — Migration execution
- `migration_test.gs` — Migration testing

---

## GAS → NODE.JS API CONVERSION MAP

Replace these GAS-specific APIs with Node.js equivalents:

| GAS API | Node.js Replacement |
|---------|-------------------|
| `UrlFetchApp.fetch(url, options)` | `axios` or `node-fetch` (use `axios` — better error handling) |
| `response.getResponseCode()` | `response.status` (axios) |
| `response.getContentText()` | `response.data` (axios auto-parses JSON) |
| `PropertiesService.getScriptProperties()` | `dotenv` for `.env` file + a `config-store.json` for mutable state |
| `LockService.getScriptLock()` | `proper-lockfile` npm package or `async-mutex` |
| `Utilities.base64Encode(str)` | `Buffer.from(str).toString('base64')` |
| `Utilities.sleep(ms)` | `await new Promise(r => setTimeout(r, ms))` (async) |
| `ScriptApp.newTrigger().timeBased()` | `node-cron` for scheduling inside the app |
| `Logger.log(msg)` | `winston` logger (file + console + UI event emitter) |
| `Utilities.getUuid()` | `crypto.randomUUID()` (Node 19+) or `uuid` package |
| `JSON.parse() / JSON.stringify()` | Same (native JS) |
| `LockService.getScriptLock().tryLock(ms)` | `async-mutex` with timeout |

---

## TARGET APPLICATION ARCHITECTURE

### Tech Stack:
```
Electron 28+ (Desktop Shell)
├── Main Process (Node.js Backend)
│   ├── src/
│   │   ├── config/
│   │   │   ├── app-config.js          ← from config.gs
│   │   │   ├── migration-config.js    ← from migration_config.gs
│   │   │   └── config-store.js        ← replaces ScriptProperties (persistent JSON file)
│   │   │
│   │   ├── core/
│   │   │   ├── http-client.js         ← from utils_http.gs (axios wrapper with retry/backoff)
│   │   │   ├── airtable-client.js     ← from utils_airtable.gs
│   │   │   ├── state-service.js       ← from state.gs
│   │   │   └── lock-service.js        ← replaces LockService
│   │   │
│   │   ├── import/
│   │   │   ├── wp-fetch.js            ← from wp_fetch.gs
│   │   │   ├── sync-runner.js         ← from sync_runner.gs
│   │   │   ├── mapper.js              ← from mapper.gs
│   │   │   └── upsert.js             ← from upsert.gs
│   │   │
│   │   ├── ai/
│   │   │   ├── ai-provider.js         ← DeepSeek/OpenAI call abstraction (from ai_enhancer.gs callAi_/callDeepseek_)
│   │   │   ├── context-utils.js       ← from context_utils.gs
│   │   │   ├── enhancement-helpers.js ← from enhancement_helpers.gs
│   │   │   ├── orchestrator.js        ← from enhancement_orchestrator.gs
│   │   │   ├── seo-enhancer.js        ← from ai_seo_enhancer.gs
│   │   │   ├── content-enhancer.js    ← from ai_enhancer.gs
│   │   │   ├── addons-enhancer.js     ← from ai_addons_enhancer.gs
│   │   │   ├── highlights-enhancer.js ← from ai_highlights.gs
│   │   │   ├── itinerary-enhancer.js  ← from ai_itinerary_enhancer.gs
│   │   │   ├── inc-exc-enhancer.js    ← from ai_includes_excludes.gs
│   │   │   ├── trip-facts-enhancer.js ← from ai_trip_facts.gs
│   │   │   ├── faqs-enhancer.js       ← from ai_faqs_enhancer.gs
│   │   │   └── images-enhancer.js     ← from ai_images_enhancer.gs
│   │   │
│   │   ├── publish/
│   │   │   ├── publisher.js           ← from publisher.gs
│   │   │   └── updater.js             ← from updater.gs
│   │   │
│   │   ├── migration/
│   │   │   ├── migration-mapper.js    ← from migration_mapper.gs
│   │   │   ├── migration-runner.js    ← from migration_runner.gs
│   │   │   └── migration-test.js      ← from migration_test.gs
│   │   │
│   │   ├── scheduler/
│   │   │   └── task-scheduler.js      ← replaces GAS time-driven triggers (uses node-cron)
│   │   │
│   │   └── logger/
│   │       └── app-logger.js          ← winston logger + event emitter for UI
│   │
│   ├── main.js                        ← Electron main process entry
│   └── preload.js                     ← Electron preload (IPC bridge)
│
├── Renderer Process (Frontend UI)
│   ├── index.html
│   ├── styles/
│   │   └── app.css                    ← Modern dark theme UI
│   └── renderer/
│       ├── app.js                     ← Main UI controller
│       ├── pages/
│       │   ├── dashboard.js           ← Trip status overview
│       │   ├── import.js              ← Import controls & status
│       │   ├── ai-pipeline.js         ← AI stages monitoring & control
│       │   ├── publisher.js           ← Publishing controls
│       │   ├── migration.js           ← Migration tools
│       │   ├── scheduler.js           ← Cron job management
│       │   ├── settings.js            ← API keys & configuration
│       │   └── logs.js                ← Real-time log viewer
│       └── components/
│           ├── trip-card.js           ← Trip status card component
│           ├── stage-badge.js         ← Pipeline stage status badge
│           ├── log-viewer.js          ← Live log streaming component
│           └── sidebar.js             ← Navigation sidebar
│
├── data/                              ← Persistent local storage
│   ├── config-store.json              ← Mutable config (replaces ScriptProperties)
│   └── logs/                          ← Log files
│
├── package.json
├── .env                               ← API Keys (AIRTABLE_API_KEY, DEEPSEEK_API_KEY, etc.)
└── electron-builder.yml               ← Build/package config for .exe/.msi
```

---

## DETAILED CONVERSION INSTRUCTIONS

### Phase 1: Project Setup

1. Initialize the Electron project:
```bash
mkdir fts-trip-manager
cd fts-trip-manager
npm init -y
npm install electron electron-builder --save-dev
npm install axios dotenv node-cron winston async-mutex electron-store
```

2. Create `.env` file with these keys (user will fill values):
```env
# WordPress API
WP_API_BASE=https://ftstravels.com/wp-json/fts/v1
WP_API_URL_SINGLE=https://ftstravels.com/wp-json/fts/v1/trip
WP_API_USER=
WP_API_PASS=

# Airtable
AIRTABLE_API_KEY=
AIRTABLE_BASE_ID=apphGHAvy5IhAWVw9

# AI Services
DEEPSEEK_API_KEY=
DEEPSEEK_ENDPOINT=https://api.deepseek.com/chat/completions
DEEPSEEK_MODEL=deepseek-chat
OPENAI_API_KEY=

# App Settings
DEBUG=true
PUBLISHER_WORKFLOW_ENABLED=false
WP_PER_PAGE=20
MAX_TRIPS_PER_RUN=1
MAX_TRIPS_PER_DAY=5
WORKER_ID=desktop-app
```

### Phase 2: Core Infrastructure Conversion

#### `config-store.js` — Replaces ScriptProperties
```javascript
// Use electron-store for persistent key-value storage
// This replaces PropertiesService.getScriptProperties()
// Must support: getProperty, setProperty, deleteProperty, setProperties, getProperties
// Store data in: %APPDATA%/fts-trip-manager/config-store.json
```

#### `http-client.js` — Replaces utils_http.gs
- Convert `httpRequestJson()` to async function using `axios`
- Keep the same retry logic (3 retries, exponential backoff)
- Keep the same error handling (retry on 5xx only)
- Remove `muteHttpExceptions` (axios handles this differently)

#### `airtable-client.js` — Replaces utils_airtable.gs
- Convert ALL functions to async/await
- Keep exact same API: `airtableGet_`, `airtableCreate_`, `airtableUpdate_`, `airtableBatchCreate_`, `airtableBatchDelete_`, etc.
- Export as a module (class or object)
- Keep `AirtableUtils.escapeFormulaValue` and `AirtableUtils.getTripRecordIdByTripID`

#### `lock-service.js` — Replaces LockService
- Use `async-mutex` with timeout
- `tryLock(timeoutMs)` → returns boolean
- `releaseLock()`

### Phase 3: Import Pipeline Conversion

#### `mapper.js` — from mapper.gs
- This is PURE JavaScript logic — minimal changes needed
- Just add `module.exports` at the end
- Keep ALL functions: `mapTripToTripsRow_`, `extractHighlights_`, `extractItinerarySteps_`, `extractFAQs_`, `extractIncludes_`, `extractExcludes_`, `extractAddOns_`, `extractPickupLocations_`, `extractTripFacts_`, `extractTripDetails_`, `extractPackages_`, `extractImages_`, `extractPrices_`
- Keep helper functions: `get_`, `TextUtils`, `parseCSV_`, `stripHtml_`, `decodeHtml_`, `sanitizeTemplateTokens_`

#### `sync-runner.js` — from sync_runner.gs + wp_fetch.gs
- Convert `runImportStepSafe()` to async
- Replace `UrlFetchApp.fetch` with axios
- Replace `StateService` calls with the new config-store
- Keep daily limit logic (WP_IMPORT_DAILY_LIMIT = 60)
- Keep batch logic and pagination

#### `upsert.js` — from upsert.gs
- Convert to async/await
- Keep `replaceChildRecordsForTrip_` logic exactly
- Keep `upsertTrip_` logic exactly
- Keep `deleteTripAndChildrenByTripId_` logic

### Phase 4: AI Enhancement Pipeline Conversion

**CRITICAL: Every AI enhancer file follows the same pattern:**
1. Fetch trips/records with status = "Pending" from Airtable
2. Build context/prompt
3. Call AI API (DeepSeek or OpenAI)
4. Parse JSON response
5. Write results to Airtable improvement tables
6. Update status to "Done" or "Error"

**For EACH of these 9 files, convert as follows:**
- Make all functions `async`
- Replace `airtableGet_`, `airtableUpdate_`, etc. with imported module calls
- Replace `callAi_` / `callDeepseek_` with the shared `ai-provider.js` module
- Replace `Logger.log` with winston logger
- **PRESERVE ALL PROMPTS EXACTLY AS-IS** — do NOT modify any AI prompt text
- **PRESERVE ALL business logic** — field names, status values, batch sizes, limits
- Replace `claimStage_` with the new lock-service equivalent

#### `ai-provider.js` — Extract from ai_enhancer.gs
- Extract `callAi_()` and `callDeepseek_()` into a shared module
- Add OpenAI support (used by images enhancer)
- Both should be async
- Keep the JSON parsing fallback logic (regex match for `{...}`)

#### `orchestrator.js` — from enhancement_orchestrator.gs
- Convert `checkAndProgressPipeline()` to async
- Convert `progressTripPipeline_()` to async
- Keep ALL stage transition logic exactly:
  ```
  Stage 1 (Content) → Stage 2 (AddOns) → Stage 3 (Highlights) → Stage 4 (Itinerary)
  → Stage 5 (Inc/Exc) → Stage 6 (Trip Facts) → Stage 7 (FAQs)
  → Stage 8 (SEO) → Stage 9 (Images) → Pipeline Complete
  ```
- Keep `detectStuckProcesses()` logic
- Replace `LockService` with async-mutex

### Phase 5: Publishing Pipeline Conversion

- Convert `publisher.js` and `updater.js` to async
- Keep `ALWAYS_CREATE_NEW_TRIP` flag logic
- Keep all Airtable → WordPress payload building
- Keep preservation workflow logic
- Replace `UrlFetchApp.fetch` POST calls with axios

### Phase 6: Scheduler (Replaces GAS Triggers)

Create `task-scheduler.js` using `node-cron`:

```javascript
// Default schedules (matching original GAS triggers):
const DEFAULT_SCHEDULES = {
  importTrips:        { cron: '*/10 * * * *', enabled: false, fn: 'runImportStepSafe' },
  progressPipeline:   { cron: '*/5 * * * *',  enabled: false, fn: 'checkAndProgressPipeline' },
  detectStuck:        { cron: '*/30 * * * *', enabled: false, fn: 'detectStuckProcesses' },
  seoEnhancer:        { cron: '*/15 * * * *', enabled: false, fn: 'runAiSeoEnhancementBatch' },
  contentEnhancer:    { cron: '*/10 * * * *', enabled: false, fn: 'runAiEnhancementBatch' },
  addonsEnhancer:     { cron: '*/10 * * * *', enabled: false, fn: 'runAiAddOnsEnhancementBatch' },
  highlightsEnhancer: { cron: '*/10 * * * *', enabled: false, fn: 'runAiHighlightsEnhancementBatch' },
  itineraryEnhancer:  { cron: '*/10 * * * *', enabled: false, fn: 'runAiItineraryBatch' },
  incExcEnhancer:     { cron: '*/10 * * * *', enabled: false, fn: 'runAiIncludesExcludesBatch' },
  tripFactsEnhancer:  { cron: '*/10 * * * *', enabled: false, fn: 'runAiTripFactsBatch' },
  faqsEnhancer:       { cron: '*/10 * * * *', enabled: false, fn: 'runAiFaqsBatch' },
  imagesEnhancer:     { cron: '*/10 * * * *', enabled: false, fn: 'runAiImagesEnhancementBatch' },
  publisher:          { cron: '*/15 * * * *', enabled: false, fn: 'runPublisherBatch' },
};
```

Each schedule must be:
- Configurable (cron expression + enable/disable) from the UI
- Persisted in config-store.json
- Startable/stoppable at runtime without app restart

### Phase 7: Electron UI (Frontend)

**Design Requirements:**
- Modern dark theme (dark gray background, accent color: travel blue #2196F3)
- Sidebar navigation (fixed left)
- Responsive content area
- Use vanilla HTML/CSS/JS (no React/Vue — keep it simple and fast)
- Use IPC (contextBridge + ipcRenderer/ipcMain) for communication

**Pages:**

#### 1. Dashboard Page
- Summary cards: Total Trips, Pipeline Active, Completed, Errors
- Table of ALL trips from Airtable "Trips" table showing:
  - TripID, Title, Pipeline_Status
  - Each AI stage status as colored badges:
    - Gray = Waiting
    - Blue = Pending
    - Yellow/Spinning = Processing
    - Green = Done
    - Red = Error
  - Publish_Status
- Click trip → expand to see all details
- Auto-refresh every 30 seconds (configurable)
- Filter by: Pipeline_Status, specific stage status, errors only

#### 2. Import Page
- Button: "Import All Trips" (runs `runImportStepSafe`)
- Button: "Import Single Trip by ID" (input field + runs `syncSingleTripById`)
- Button: "Reset Import State" (runs `resetWpImportStateForToday`)
- Show current import state (page, index, todayCount)
- Live progress indicator

#### 3. AI Pipeline Page
- For each of the 9 stages, show:
  - Stage name and description
  - Number of trips in each status (Waiting/Pending/Processing/Done/Error)
  - Button: "Run Stage Manually" (runs the batch function once)
  - Button: "Reset Trip Stage" (set specific trip's stage status back to Pending)
- "Run Full Pipeline Check" button (runs `checkAndProgressPipeline`)
- "Detect Stuck Processes" button (runs `detectStuckProcesses`)
- Per-trip pipeline controls:
  - Select trip from dropdown
  - "Initialize Pipeline" button
  - "Re-run Stage X" for any stage

#### 4. Publisher Page
- Toggle: Enable/Disable publisher workflow
- Button: "Run Publisher Batch"
- Button: "Run Updater Batch"
- Table of trips with Publish_Status = Pending/Publishing/Done/Error
- Per-trip: "Publish Now" / "Update Now" buttons

#### 5. Migration Page
- Button: "Run Test Migration" (batch of 5)
- Button: "Run Full Migration"
- Button: "Reset TripID Counter"
- Migration log viewer
- Progress indicator

#### 6. Scheduler Page
- Table of all scheduled tasks (from DEFAULT_SCHEDULES above)
- For each task:
  - Name, cron expression (editable), enabled toggle
  - Last run time, next run time
  - Run count, error count
  - "Run Now" button (manual one-time execution)
- "Start All" / "Stop All" buttons
- Persist schedule changes to config-store

#### 7. Settings Page
- Form fields for ALL `.env` variables:
  - WordPress: WP_API_BASE, WP_API_USER, WP_API_PASS
  - Airtable: AIRTABLE_API_KEY, AIRTABLE_BASE_ID
  - AI: DEEPSEEK_API_KEY, OPENAI_API_KEY
  - App: DEBUG, WP_PER_PAGE, MAX_TRIPS_PER_DAY, WORKER_ID
- "Test Connection" buttons for each service (WordPress, Airtable, DeepSeek, OpenAI)
- "Save Settings" button
- Settings saved to `.env` file AND config-store

#### 8. Logs Page
- Real-time log viewer (scrolling, auto-scroll to bottom)
- Filter by level: DEBUG, INFO, WARN, ERROR
- Filter by module (import, ai, publish, etc.)
- Search within logs
- "Clear Logs" button
- "Export Logs" button (save to file)
- Color-coded: green=info, yellow=warn, red=error, gray=debug

### Phase 8: IPC Communication (Main ↔ Renderer)

Define IPC channels:

```javascript
// From Renderer → Main (invoke)
'config:get'           // Get config value
'config:set'           // Set config value
'import:run'           // Run import batch
'import:single'        // Import single trip by ID
'import:reset'         // Reset import state
'pipeline:check'       // Run pipeline check
'pipeline:detect-stuck' // Detect stuck
'ai:run-stage'         // Run specific AI stage (pass stage name)
'ai:reset-stage'       // Reset trip stage status
'ai:init-pipeline'     // Initialize pipeline for trip
'publish:run'          // Run publisher
'update:run'           // Run updater
'publish:toggle'       // Enable/disable publisher
'migration:test'       // Test migration
'migration:run'        // Full migration
'migration:reset'      // Reset counter
'scheduler:get-all'    // Get all schedules
'scheduler:update'     // Update schedule (cron, enabled)
'scheduler:run-now'    // Run task once manually
'scheduler:start-all'  // Start all enabled
'scheduler:stop-all'   // Stop all
'trips:fetch-all'      // Fetch all trips for dashboard
'trips:fetch-one'      // Fetch single trip details
'settings:get'         // Get all settings
'settings:save'        // Save settings
'settings:test'        // Test connection

// From Main → Renderer (send/on)
'log:entry'            // New log entry (for live log viewer)
'task:started'         // Background task started
'task:completed'       // Background task completed
'task:error'           // Background task error
'trips:updated'        // Trip data changed
```

### Phase 9: Packaging & Distribution

Configure `electron-builder.yml`:
```yaml
appId: com.ftstravels.trip-manager
productName: FTS Trip Manager
directories:
  output: dist
win:
  target:
    - nsis
    - portable
  icon: assets/icon.ico
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
```

---

## CRITICAL RULES

1. **DO NOT modify any AI prompt text** — copy them exactly as-is from the GAS files
2. **DO NOT change any Airtable field names** — they must match the existing schema exactly
3. **DO NOT change any API endpoint URLs** — keep WordPress and Airtable URLs identical
4. **DO NOT change the pipeline stage order** — it must remain: Content → AddOns → Highlights → Itinerary → Inc/Exc → Trip Facts → FAQs → SEO → Images
5. **DO NOT change status values** — keep: Waiting, Pending, Processing, Done, Error, Initialized, In Progress, Completed
6. **DO NOT change table names** — all Airtable table names must match exactly (e.g., "Improvement With AI", "Highlights Improvement With AI", etc.)
7. **PRESERVE ALL business rules** — museum distinction logic, conditional visit rules, realism rules, batch sizes, daily limits
8. **ALL functions must be async/await** — no callback hell
9. **Every module must have proper error handling** — try/catch with logging
10. **The app must work offline for configuration** — only fail when actually trying to call APIs

---

## EXECUTION ORDER

Build the project in this exact order:

1. **Project scaffolding** — package.json, electron setup, folder structure
2. **Core infrastructure** — config, http-client, airtable-client, state-service, lock-service, logger
3. **Import pipeline** — mapper, wp-fetch, sync-runner, upsert
4. **AI pipeline** — ai-provider, context-utils, enhancement-helpers, all 9 enhancers, orchestrator
5. **Publishing pipeline** — publisher, updater
6. **Migration** — migration-config, migration-mapper, migration-runner
7. **Scheduler** — task-scheduler with node-cron
8. **Electron main process** — main.js, preload.js, IPC handlers
9. **UI** — all pages and components
10. **Testing** — test each module individually
11. **Packaging** — electron-builder config, build .exe

---

## TESTING CHECKLIST

After building, verify:
- [ ] App launches and shows dashboard
- [ ] Settings page saves/loads API keys correctly
- [ ] "Test Connection" works for WordPress, Airtable, DeepSeek, OpenAI
- [ ] Import single trip by ID works
- [ ] Import batch works
- [ ] All 9 AI stages can be triggered manually
- [ ] Pipeline orchestrator progresses stages correctly
- [ ] Publisher creates/updates trips in WordPress
- [ ] Scheduler starts/stops cron jobs
- [ ] Logs appear in real-time in the UI
- [ ] App can be packaged as .exe and installed on another Windows machine
