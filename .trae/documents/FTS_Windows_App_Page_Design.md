# Windows Desktop App (Desktop-first) — Page Design Spec

## Global Styles
- Layout: fixed left sidebar + top title bar; content area scrolls.
- Spacing: 8px base scale (8/16/24/32).
- Typography: 14px base; headings 18/22/28.
- Theme: modern dark.
  - Background: #0B0F17 (app chrome) + #0F172A (panels)
  - Surface: #111827, border #1F2937
  - Text: #E5E7EB, muted #9CA3AF
  - Accent (travel blue): #2196F3
  - Success: #22C55E, Warning: #F59E0B, Error: #EF4444
- Buttons: primary (accent), secondary (surface), danger (error);
- Tables: sticky header, row hover highlight, right-aligned numeric columns.
- Status badges:
  - Waiting: gray
  - Pending: blue
  - Processing: yellow + spinner
  - Done: green
  - Error: red

## Shell Layout (All Pages)
1. Sidebar (left, fixed)
   - Navigation links (routes): Dashboard, Import, AI Pipeline, Publisher, Migration, Scheduler, Settings, Logs.
   - Optional status footer: current worker id, last sync time.
2. Title Bar (top)
   - Page title + contextual actions (page-specific).
3. Content (scrollable)
   - Cards, tables, and forms per page.

---

## Page 1: Dashboard (`/dashboard`)
### Layout
- Top row: Summary cards.
- Main row: Trips table with filters.

### Page Structure
1. Summary Cards
   - Total Trips
   - Pipeline Active
   - Completed
   - Errors
2. Filters Bar
   - Pipeline_Status dropdown
   - Stage status filter (choose stage + status)
   - “Errors only” toggle
   - Auto-refresh toggle + interval selector (default 30s)
   - “Refresh now” button
3. Trips Table
   - Columns: TripID, Title, Pipeline_Status, stage badges (9), Publish_Status
   - Row expand/collapse for details

### Interactions
- Expanding a trip shows a compact read-only panel of key fields and stage statuses.
- Auto-refresh updates table without losing current filters.

---

## Page 2: Import (`/import`)
### Layout
- Two-column: controls left, status/progress right.

### Page Structure
1. Controls Card
   - “Import All Trips” button
   - “Import Single Trip by ID” input + button
   - “Reset Import State” button (confirmation modal)
2. Current Import State Card
   - Page
   - Index
   - TodayCount
   - Last run time + last outcome
3. Live Progress Card
   - Progress bar + current activity text
   - Recent per-trip outcomes list

---

## Page 3: AI Pipeline (`/ai-pipeline`)
### Layout
- Top actions bar + stage grid below + per-trip control panel.

### Page Structure
1. Global Actions
   - “Run Full Pipeline Check” button
   - “Detect Stuck Processes” button
2. Stage Sections (9 cards, one per stage)
   - Stage name + description
   - Status counts: Waiting / Pending / Processing / Done / Error
   - Controls:
     - “Run Batch” (all Pending)
     - Trip selector dropdown
     - “Run This Stage on Selected Trip”
     - “Reset Stage to Pending” (for selected trip)
3. Per-Trip Pipeline Panel
   - Trip selector dropdown
   - Stage status strip (9 badges)
   - For each stage (clickable row):
     - “Run Now”
     - “Reset to Waiting”
     - “Reset to Pending”
   - “Initialize Pipeline” button for selected trip

### Interaction Rules
- Independent stage execution is supported: stages can be run or re-run without enforcing sequential order.
- UI disables conflicting actions when a stage is Processing for the same trip.

---

## Page 4: Publisher (`/publisher`)
### Layout
- Two workflow panels stacked: Publisher (create) and Updater (update).

### Page Structure
1. Workflow Toggle
   - “Publisher workflow enabled” toggle
2. Publisher (Create New Trips) Panel
   - “Run Publisher Batch” button
   - Table of trips eligible to publish (no WP Post ID): TripID, Title, Publish_Status, Pipeline_Status, actions
   - Per trip action: “Publish Now”
3. Updater (Update Existing Trips) Panel
   - “Run Updater Batch” button
   - Table of trips eligible to update (has WP Post ID): TripID, Title, WP Post ID, Publish_Status, actions
   - Per trip action: “Update Now”

---

## Page 5: Migration (`/migration`)
### Layout
- Controls on top, progress + logs below.

### Page Structure
1. Controls
   - “Run Test Migration (5)” button
   - “Run Full Migration” button
   - “Reset TripID Counter” button (danger)
2. Progress
   - Progress bar + counters (processed/success/errors)
3. Migration Log Viewer
   - Streamed logs scoped to migration module

---

## Page 6: Scheduler (`/scheduler`)
### Layout
- Table-centric.

### Page Structure
1. Top Actions
   - “Start All” button
   - “Stop All” button
2. Schedules Table
   - Columns: Task name, cron (editable input), enabled (toggle), last run, next run, run count, error count, actions
   - Row action: “Run Now”
3. Inline Validation
   - Invalid cron shows error state and blocks save.

---

## Page 7: Settings (`/settings`)
### Layout
- Single-column form with section cards.

### Page Structure
1. WordPress
   - `WP_API_BASE`, `WP_API_URL_SINGLE`, `WP_API_USER`, `WP_API_PASS`
   - “Test WordPress” button
2. Airtable
   - `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`
   - “Test Airtable” button
3. AI
   - DeepSeek: `DEEPSEEK_API_KEY`, `DEEPSEEK_ENDPOINT`, `DEEPSEEK_MODEL` + “Test DeepSeek”
   - OpenAI: `OPENAI_API_KEY` + “Test OpenAI”
4. App
   - `DEBUG`, `PUBLISHER_WORKFLOW_ENABLED`, `WP_PER_PAGE`, `MAX_TRIPS_PER_RUN`, `MAX_TRIPS_PER_DAY`, `WORKER_ID`
5. Save
   - “Save Settings” button (writes `.env` + config-store)

---

## Page 8: Logs (`/logs`)
### Layout
- Full-height log viewer.

### Page Structure
1. Filters Bar
   - Level filter: DEBUG/INFO/WARN/ERROR
   - Module filter: import/ai/publish/migration/scheduler
   - Search input
2. Log Viewer
   - Auto-scroll toggle
   - Color-coded log lines
3. Actions
   - “Clear Logs” button
   - “Export Logs” button
