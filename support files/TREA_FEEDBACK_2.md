# CRITICAL: Compat Layer Must Be Removed — Proper Async Conversion Required

## The Problem

You used a `compat.js` shim layer and a text find-replace script (`convert-gas-module.js`) instead of actually rewriting the code as async/await Node.js modules.

This is **not acceptable** for the following reasons:

### 1. `sleepSync` Blocks the Electron Main Thread
- `sleepSync` is a **synchronous blocking call**
- In Electron, the main process runs both Node.js backend AND coordinates with the renderer
- Any blocking call **freezes the entire app UI** — the user cannot click, scroll, or interact
- GAS could afford synchronous code because each execution was isolated; Electron cannot

### 2. Functions Are Still Synchronous GAS-Style
- The original GAS functions were synchronous (GAS has no async/await)
- Your find-replace only renamed API calls but did NOT convert the control flow
- Functions that make HTTP calls (Airtable, WordPress, AI) MUST be `async` and use `await`
- Without this, errors won't propagate correctly and concurrent operations will fail

### 3. Compat Layer Is a Workaround, Not a Solution
- `compat.js` wraps the Phase 2 modules to look like GAS APIs
- This defeats the entire purpose of the conversion
- It adds an unnecessary abstraction layer that makes debugging harder
- It means the code is still effectively GAS code running through a translation layer

---

## What You Must Do

### Step 1: Delete These Files
```
DELETE: src/core/compat.js
DELETE: src/core/sync-wait.js  
DELETE: scripts/convert-gas-module.js
DELETE: scripts/convert-updater.js
DELETE: legacy-gas/ (entire folder)
```

### Step 2: Properly Convert Each File Using This Pattern

Look at how these files were **correctly** converted (they are your reference):
- `src/import/wp-fetch.js` — direct requires, async/await, no compat
- `src/import/sync-runner.js` — direct requires, async/await, no compat
- `src/import/upsert.js` — direct requires, async/await, no compat
- `src/ai/enhancement-helpers.js` — direct requires, async/await, no compat
- `src/ai/context-utils.js` — direct requires, async/await, no compat

Every converted file must follow this structure:

```javascript
// CORRECT PATTERN — direct imports, factory function, async/await

const { sleep } = require('../core/runtime')

function createModuleName(options) {
  const airtable = options.airtable    // from airtable-client.js
  const http = options.http            // from http-client.js  
  const config = options.config        // from app-config.js
  const logger = options.logger        // from app-logger.js
  const lock = options.lock            // from lock-service.js (if needed)
  const store = options.store          // from config-store.js (if needed)
  const aiProvider = options.aiProvider // from ai-provider.js (if needed)

  // ALL functions that call APIs must be async
  async function doSomething(tripId) {
    try {
      const data = await airtable.airtableGet('TableName', { ... })
      const result = await aiProvider.callDeepseek(prompt, options)
      await sleep(100)  // non-blocking sleep
      return result
    } catch (err) {
      logger.error(`Error: ${err.message}`)
      throw err
    }
  }

  return { doSomething }
}

module.exports = { createModuleName }
```

### Step 3: Convert ALL 15 Files Using the Correct Pattern

Each file must be manually rewritten (not find-replaced). The conversion for each file means:

| GAS Code | Node.js Conversion |
|----------|-------------------|
| `function doThing()` | `async function doThing()` |
| `var result = airtableGet_(table, params)` | `const result = await airtable.airtableGet(table, params)` |
| `var json = UrlFetchApp.fetch(url, opts)` | `const json = await http.requestJson(url, opts)` |
| `var resp = callAi_(prompt)` | `const resp = await aiProvider.callDeepseek(prompt)` (stages 1-8) |
| `var resp = callAi_(prompt)` | `const resp = await aiProvider.callOpenai(prompt)` (stage 9 Images ONLY) |
| `Logger.log(msg)` | `logger.info(msg)` |
| `Utilities.sleep(ms)` | `await sleep(ms)` |
| `Utilities.base64Encode(s)` | `base64Encode(s)` (from runtime.js) |
| `var lock = LockService.getScriptLock()` | `const locked = await lock.tryLock(timeout)` |
| `lock.releaseLock()` | `lock.releaseLock()` |
| `PropertiesService...getProperty(k)` | `store.getProperty(k)` |
| `PropertiesService...setProperty(k,v)` | `store.setProperty(k, v)` |
| `var x = something` | `const x = something` (use const/let, not var) |

### Step 4: Special Attention for updater.js

This is the largest and most complex file (~4900 lines). It contains:
- Multi-language translation system (18+ languages)
- Language alias map and resolution
- Localized SEO generation
- Image translation and attachment management  
- Preservation workflow
- Package publishing
- AI-powered translation with retry logic
- Trip schema generation

ALL of these functions must be converted to async/await. The translation functions call DeepSeek AI — they MUST use `await aiProvider.callDeepseek()`.

### Step 5: Special Attention for publisher.js vs updater.js

These are TWO SEPARATE workflows:
- **publisher.js**: Creates NEW trips (HTTP POST), `ALWAYS_CREATE_NEW_TRIP = true`
- **updater.js**: Updates EXISTING trips (HTTP PUT/PATCH), `ALWAYS_CREATE_NEW_TRIP = false`

They must remain as separate modules with separate factory functions:
- `createPublisher(options)` 
- `createUpdater(options)`

### Step 6: AI Provider Routing — CRITICAL

```
Stages 1-8 (text): await aiProvider.callDeepseek(prompt, options)
Stage 9 (images):  await aiProvider.callOpenai(prompt, options)
```

Verify EACH enhancer file calls the correct provider:
- seo-enhancer.js → callDeepseek
- content-enhancer.js → callDeepseek  
- addons-enhancer.js → callDeepseek
- highlights-enhancer.js → callDeepseek
- itinerary-enhancer.js → callDeepseek
- inc-exc-enhancer.js → callDeepseek
- trip-facts-enhancer.js → callDeepseek
- faqs-enhancer.js → callDeepseek
- images-enhancer.js → callOpenai ← ONLY THIS ONE USES OPENAI

updater.js also calls AI for translation — those calls use DeepSeek.

### Step 7: Verification

After converting ALL files, run this grep and confirm ZERO matches:
```bash
grep -rn "UrlFetchApp\|PropertiesService\|LockService\|Logger\.log\|Utilities\.\|sleepSync\|createCompat\|compat\.js\|sync-wait" src/
```

Expected output: nothing (0 matches).

Also verify:
```bash
grep -rn "var " src/ | grep -v "node_modules" | head -20
```
Should return minimal results — prefer `const`/`let` over `var`.

---

## Conversion Order (largest and most critical first)

1. **src/publish/updater.js** (4900 lines, most complex — translation, languages, images, preservation)
2. **src/publish/publisher.js** (1800 lines — new trip creation, payload building)
3. **src/ai/orchestrator.js** (pipeline progression, stuck detection)
4. **src/ai/inc-exc-enhancer.js** (includes/excludes extraction)
5. **src/ai/content-enhancer.js** (content enhancement)
6. **src/ai/images-enhancer.js** (image SEO — uses OpenAI NOT DeepSeek)
7. **src/ai/faqs-enhancer.js** (FAQ generation)
8. **src/ai/trip-facts-enhancer.js** (trip facts)
9. **src/ai/itinerary-enhancer.js** (itinerary steps)
10. **src/ai/addons-enhancer.js** (add-ons enhancement)
11. **src/ai/highlights-enhancer.js** (highlights)
12. **src/ai/seo-enhancer.js** (SEO enhancement)
13. **src/migration/migration-test.js** (migration testing)
14. **src/migration/migration-runner.js** (migration execution)
15. **src/migration/migration-mapper.js** (field mapping)

---

## IMPORTANT REMINDERS

- **ALL AI prompts must remain EXACTLY as-is** — do not modify any prompt text
- **ALL Airtable field names must remain EXACTLY as-is**
- **ALL status values must remain EXACTLY as-is** (Waiting, Pending, Processing, Done, Error)
- **Write COMPLETE production-ready code** — no placeholders, no TODOs, no skeleton functions
- **Do NOT use compat.js or any shim/wrapper layer**
- **Every function that touches the network must be async**

Start converting updater.js now. Take your time and do it properly.
