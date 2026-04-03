# FTS Trip Manager (Windows Desktop App) — PRD

## 1. Product Overview

FTS Trip Manager is a standalone Windows desktop application that runs the existing ftstravels.com trip automation currently implemented in Google Apps Script.

It must preserve 100% of the current business logic and all AI prompt text exactly as-is, while replacing GAS-specific APIs with Node.js equivalents and providing an operator GUI.

## 2. Goals

* Run on any Windows PC or Windows Server.

* Provide a full GUI for: dashboard, import, AI pipeline control, publishing, migration, scheduler, settings, and logs.

* Replace all GAS runtime services (UrlFetchApp, PropertiesService, triggers, locks, Logger) with Node/Electron equivalents.

* Package as an installable `.exe` and/or `.msi`.

## 3. Non-Goals

* Changing WordPress plugin code (`fts-trip-api-update.php`) or modifying server-side schema.

* Changing Airtable table/field names, status values, or AI prompt wording.

## 4. Critical Rules (Must Not Change)

* AI prompts: copied verbatim; never editable in UI.

* Airtable schema: table names, field names, and status values must match the existing base exactly.

* Stage order remains: SEO → Content → AddOns → Highlights → Itinerary → Inc/Exc → Trip Facts → FAQs → Images.

* Status values remain: Waiting, Pending, Processing, Done, Error, Initialized, In Progress, Completed.

## 5. User Experience: 8 Pages (8 Routes)

Each page is a separate route and a separate file in `renderer/pages/`.

| # | Page        | Route          | Purpose                                                                                              |
| - | ----------- | -------------- | ---------------------------------------------------------------------------------------------------- |
| 1 | Dashboard   | `/dashboard`   | Summary cards (Total/Active/Completed/Errors), trips table with stage badges, auto-refresh, filters. |
| 2 | Import      | `/import`      | Import controls + import state display + live progress.                                              |
| 3 | AI Pipeline | `/ai-pipeline` | Monitor 9 stages, run stages manually, reset stages, per-trip controls, detect stuck.                |
| 4 | Publisher   | `/publisher`   | Two distinct workflows: Publisher (create new WP trips) and Updater (update existing).               |
| 5 | Migration   | `/migration`   | Test migration (5), full migration, reset TripID counter, migration logs/progress.                   |
| 6 | Scheduler   | `/scheduler`   | Manage cron jobs: edit cron, enable/disable, run now, start all/stop all.                            |
| 7 | Settings    | `/settings`    | Edit `.env` variables, test connections per service, save settings.                                  |
| 8 | Logs        | `/logs`        | Real-time logs with filters, search, clear/export.                                                   |

## 6. Functional Requirements (By Page)

### 6.1 Dashboard (`/dashboard`)

* Summary cards: Total Trips, Pipeline Active, Completed, Errors.

* Trips table from Airtable “Trips” table:

  * Columns: TripID, Title, Pipeline\_Status, Publish\_Status.

  * Stage badges per AI stage with colors: Waiting (gray), Pending (blue), Processing (yellow/spinner), Done (green), Error (red).

* Trip row expands to show key details.

* Filters: Pipeline\_Status, specific stage status, errors only.

* Auto-refresh every 30 seconds; refresh interval configurable.

### 6.2 Import (`/import`)

* Button: “Import All Trips” → runs `runImportStepSafe`.

* Input + button: “Import Single Trip by ID” → runs `syncSingleTripById`.

* Button: “Reset Import State” → runs `resetWpImportStateForToday`.

* Display current import state: page, index, todayCount.

* Live progress indicator and last run outcome.

### 6.3 AI Pipeline (`/ai-pipeline`)

* Show all 9 stages with counts by status (Waiting/Pending/Processing/Done/Error).

* Buttons:

  * “Run Full Pipeline Check” → `checkAndProgressPipeline`.

  * “Detect Stuck Processes” → `detectStuckProcesses`.

* Per-stage controls (for each stage):

  * “Run Batch” (process all trips with stage status = Pending).

  * Trip selector + “Run This Stage on Selected Trip”.

  * “Reset Stage to Pending” for selected trip.

* Per-trip controls:

  * Trip selector; shows all 9 stage statuses.

  * For any stage: “Run Now”, “Reset to Waiting”, “Reset to Pending”.

### 6.4 Publisher (`/publisher`)

* Must separate the two workflows:

  * Publisher: creates NEW trips in WordPress; handles trips with `Publish_Status = "Waiting"` and no WP Post ID.

  * Updater: updates EXISTING trips; handles trips with an existing WP Post ID and applies preservation rules.

* Controls:

  * Toggle enable/disable publisher workflow.

  * “Run Publisher Batch” and “Run Updater Batch”.

  * Per-trip: “Publish Now” / “Update Now” depending on whether WP Post ID exists.

* Table shows new vs existing and workflow status.

### 6.5 Migration (`/migration`)

* “Run Test Migration” (batch of 5).

* “Run Full Migration”.

* “Reset TripID Counter”.

* Migration log viewer + progress indicator.

### 6.6 Scheduler (`/scheduler`)

* Table of ALL scheduled tasks (mirroring original triggers) with:

  * Editable cron expression.

  * Enable/disable toggle.

  * Last run time, next run time.

  * Run count, error count.

  * “Run Now”.

* “Start All” / “Stop All”.

* Persist schedules in local config store and allow start/stop without app restart.

### 6.7 Settings (`/settings`)

* Form fields for all `.env` variables:

  * WordPress: `WP_API_BASE`, `WP_API_URL_SINGLE`, `WP_API_USER`, `WP_API_PASS`.

  * Airtable: `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`.

  * AI: `DEEPSEEK_API_KEY`, `DEEPSEEK_ENDPOINT`, `DEEPSEEK_MODEL`, `OPENAI_API_KEY`.

  * App: `DEBUG`, `PUBLISHER_WORKFLOW_ENABLED`, `WP_PER_PAGE`, `MAX_TRIPS_PER_RUN`, `MAX_TRIPS_PER_DAY`, `WORKER_ID`.

* “Test Connection” buttons per service: WordPress, Airtable, DeepSeek, OpenAI.

* “Save Settings” writes `.env` and config store.

### 6.8 Logs (`/logs`)

* Real-time log viewer.

* Filters: level (DEBUG/INFO/WARN/ERROR) and module (import/ai/publish/migration/scheduler).

* Search within logs.

* “Clear Logs” and “Export Logs”.

* Color-coded entries: gray=debug, green=info, yellow=warn, red=error.

## 7. Independent Stage Execution (Critical)

The user must be able to run any single stage on any trip without requiring the full sequential pipeline.

* Run Stage X for all pending trips (batch).

* Run Stage X for one selected trip.

* Re-run a completed stage.

* Skip stages (run Stage 5 directly even if Stage 3 has not run).

## 8. Data & Storage

* Canonical pipeline state remains in Airtable status fields and improvement tables.

* Local persistent storage:

  * Mutable state replacing ScriptProperties.

  * Scheduler configuration.

  * Logs.

* App must work offline for configuration workflows; failures occur only when making network calls.

## 9. Acceptance Criteria

* App launches on Windows and shows `/dashboard`.

* All 8 pages are accessible and functional.

* Settings can be saved/loaded; per-service “Test Connection” works.

* Import single-trip and batch import work.

* Each AI stage can be run in batch and per-trip independently.

* Publisher and Updater run via separate controls and IPC channels.

* Scheduler can start/stop jobs at runtime and persists configuration.

* Logs stream into the UI and can be filtered and exported.

