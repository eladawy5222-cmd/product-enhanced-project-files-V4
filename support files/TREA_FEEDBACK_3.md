# TREA Feedback #3 — Final Comprehensive Review

## ❌ CRITICAL ISSUE: 14 Files Are UNTOUCHED GAS Copies (AGAIN!)

This is the **THIRD time** this has happened. The following 14 files are **byte-for-byte identical** to the original `.gs` files — they were only renamed from `.gs` to `.js` with ZERO conversion:

### AI Pipeline (11 files — NOT converted):
| Converted File | = Original GAS File | Lines |
|---|---|---|
| `content-enhancer.js` | = `ai_enhancer.gs` | 783 |
| `addons-enhancer.js` | = `ai_addons_enhancer.gs` | 406 |
| `highlights-enhancer.js` | = `ai_highlights.gs` | 847 |
| `itinerary-enhancer.js` | = `ai_itinerary_enhancer.gs` | 641 |
| `inc-exc-enhancer.js` | = `ai_includes_excludes.gs` | 1908 |
| `trip-facts-enhancer.js` | = `ai_trip_facts.gs` | 709 |
| `faqs-enhancer.js` | = `ai_faqs_enhancer.gs` | 814 |
| `images-enhancer.js` | = `ai_images_enhancer.gs` | 1238 |
| `orchestrator.js` | = `enhancement_orchestrator.gs` | 386 |
| `context-utils.js` | = `context_utils.gs` | 219 |
| `enhancement-helpers.js` | = `enhancement_helpers.gs` | 248 |

### Migration (3 files — NOT converted):
| Converted File | = Original GAS File | Lines |
|---|---|---|
| `migration-mapper.js` | = `migration_mapper.gs` | 337 |
| `migration-runner.js` | = `migration_runner.gs` | 295 |
| `migration-test.js` | = `migration_test.gs` | 189 |

**Total: 8,831 lines of raw GAS code that will crash on Node.js.**

These files still contain:
- `UrlFetchApp.fetch()` — does not exist in Node.js
- `Logger.log()` — does not exist in Node.js
- `ScriptApp.newTrigger()` — does not exist in Node.js
- `PropertiesService.getScriptProperties()` — does not exist in Node.js
- `var` declarations instead of `const/let`
- Synchronous blocking code instead of `async/await`
- `function name()` global functions instead of module pattern
- No `require()` or `module.exports`
- Direct `airtableGet_()`, `airtableUpdate_()`, `airtableCreate_()`, `airtableDelete_()` calls (GAS global functions) instead of using the injected `airtable` dependency

---

## ❌ CRITICAL: Missing Publisher UI Page

`app.js` imports `PublisherPage` from `./pages/publisher.js`:
```js
import { PublisherPage } from './pages/publisher.js'
```

But the `publisher.js` file in the project is the **backend module** (has `module.exports = { createPublisher }`), NOT a UI page. There is NO `PublisherPage` export anywhere.

**The Prompt specified 8 UI pages:**
1. Dashboard ✅
2. Import ✅
3. AI Pipeline ✅
4. **Publisher — MISSING (no page for Publisher + Updater)**
5. Migration ✅
6. Scheduler ✅
7. Settings ✅
8. Logs ✅

The Publisher page must include:
- **Publisher workflow** (create NEW trips on WordPress)
- **Updater workflow** (update EXISTING trips on WordPress)
- Both are separate workflows as specified in the prompt
- Trip selection, language selection, status display
- Run Publisher / Run Updater buttons

---

## ⚠️ IMPORTANT: updater.js — Partial Conversion Issues

### 1. GAS Trigger Code Still Present (lines 3573-3589)
```js
function createUpdaterTrigger() {
  var triggers = ScriptApp.getProjectTriggers();  // ❌ GAS API
  ...
  ScriptApp.newTrigger('runUpdaterBatch')          // ❌ GAS API
    .timeBased()
    .everyMinutes(15)
    .create();
}
```
This function must be removed — scheduling is handled by `task-scheduler.js`.

### 2. Image Metadata Uses DeepSeek Instead of OpenAI
In `updater.js` line 69:
```js
async function callAi_(prompt) {
  return aiProvider.callDeepSeekJson(String(prompt || ''))
}
```
This `callAi_()` is used for image metadata generation (line 4281). **Images (Stage 9) MUST use OpenAI**, not DeepSeek.

**Fix needed**: The updater needs TWO AI call functions:
- `callDeepseekJson_()` for text-based AI calls (stages 1-8 content)
- `callOpenai_()` for image metadata (stage 9)

Compare with `publisher.js` which correctly uses `aiProvider.callOpenai()` for its image metadata calls.

---

## ⚠️ IMPORTANT: mapper.js — Cosmetic Only

`mapper.js` is the original GAS code with only `module.exports = {...}` appended at the end. While it might work since the mapper is pure data transformation (no GAS APIs used), it should still be properly converted:
- `var` → `const/let`
- Proper module pattern with dependency injection
- Clean function exports

---

## ⚠️ IMPORTANT: File Structure Issues

### No Directory Organization
All files are dumped in a single flat directory. The prompt specifies this structure:
```
src/
├── core/          (app-config, http-client, airtable-client, etc.)
├── import/        (mapper, wp-fetch, sync-runner, upsert)
├── ai/            (ai-provider, all enhancers, orchestrator, etc.)
├── publish/       (publisher, updater)
├── migration/     (config, mapper, runner, test)
├── scheduler/     (task-scheduler)
├── renderer/
│   ├── pages/     (dashboard, import, ai-pipeline, publisher, etc.)
│   ├── components/(sidebar, trip-card, stage-badge, log-viewer)
│   └── styles/    (app.css)
├── main.js
└── preload.js
```

### Import Paths Are Wrong
`app.js` uses relative paths that assume directory structure:
```js
import { Sidebar } from './components/sidebar.js'
import { DashboardPage } from './pages/dashboard.js'
```
But all files are in the same directory. These imports will fail.

Similarly, `publisher.js` and `updater.js` use:
```js
const { sleep, base64Encode, getUuid, md5Base64 } = require('../core/runtime')
```
This path requires the `src/core/` directory to exist.

---

## ✅ WHAT'S WORKING WELL

### Properly Converted Files (18/32):
1. **Core Infrastructure** (7 files): Clean async/await, dependency injection, no GAS APIs
2. **Import Pipeline** (3 of 4): sync-runner, upsert, wp-fetch — properly converted
3. **AI Provider** (`ai-provider.js`): Correct separation — `callDeepseek()` and `callOpenai()`
4. **SEO Enhancer** (`seo-enhancer.js`): Properly converted, uses `callDeepseek` correctly
5. **Publisher** (`publisher.js`): Properly converted, uses `callOpenai` for images correctly
6. **Updater** (`updater.js`): Mostly converted (minor issues above)
7. **Electron** (`main.js`, `preload.js`): ~28 IPC channels, proper setup
8. **Scheduler** (`task-scheduler.js`): node-cron, persistent config, proper stats
9. **UI Pages** (7 of 8): Dashboard, Import, AI Pipeline, Migration, Scheduler, Settings, Logs
10. **UI Components** (4): Sidebar, TripCard, StageBadge, LogViewer
11. **Packaging** (package.json, electron-builder.yml): Correct dependencies, NSIS+MSI targets

---

## 📋 ACTION ITEMS (Priority Order)

### P0 — Must Fix (App Will Not Run Without These):
1. **Convert all 14 GAS files** to proper async/await Node.js modules (see list above)
   - Each file must: use `const/let`, `async/await`, dependency injection via `init()`, `module.exports`
   - Each file must: use injected `airtable`, `http`, `config`, `logger` instead of GAS globals
   - **CRITICAL: Preserve all AI prompts EXACTLY as-is (character-for-character)**
   - Only convert the code structure, NOT the prompt text
2. **Create Publisher UI page** (`publisher.js` renderer) with both Publisher + Updater workflows
3. **Organize files into directories** as specified in the prompt
4. **Fix all import paths** in app.js, publisher.js, updater.js, etc.

### P1 — Must Fix (Incorrect Behavior):
5. **Fix updater.js** image metadata to use OpenAI instead of DeepSeek
6. **Remove GAS trigger code** from updater.js (lines 3573-3589)
7. **Properly convert mapper.js** (not just append exports)

### P2 — Should Fix:
8. **migration-config.js** should use `module.exports` and match the clean pattern of other config files

---

## ⚠️ REMINDER: AI PROMPTS MUST NOT CHANGE

When converting the 14 files, you MUST:
- Keep every prompt string **exactly** as it appears in the GAS original
- Only change the code wrapper (var→const, sync→async, GAS APIs→injected deps)
- Do NOT modify, optimize, or "improve" any prompt text
- The prompts contain carefully tuned instructions (museum logic, conditional visits, HTML formatting rules, etc.)
