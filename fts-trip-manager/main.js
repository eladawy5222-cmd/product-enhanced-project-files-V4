const path = require('path')
const fs = require('fs')
const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const { mergeSeoStatusFromImprovementRecords } = require('./src/core/trips-merge')

function configurePlaywrightBrowsersPath() {
  try {
    if (!app || !app.isPackaged) return
    const bundledPath = path.join(process.resourcesPath, 'playwright-browsers')
    if (fs.existsSync(bundledPath)) {
      process.env.PLAYWRIGHT_BROWSERS_PATH = bundledPath
    }
  } catch {
  }
}

configurePlaywrightBrowsersPath()

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
}

function parseEnvFile(raw) {
  const out = {}
  const lines = String(raw || '').split(/\r?\n/)
  for (const line of lines) {
    const s = String(line || '').trim()
    if (!s || s.startsWith('#')) continue
    const idx = s.indexOf('=')
    if (idx <= 0) continue
    const k = s.slice(0, idx).trim()
    const v = s.slice(idx + 1).trim()
    out[k] = v
  }
  return out
}

function serializeEnv(obj) {
  const keys = Object.keys(obj)
  keys.sort()
  const lines = []
  for (const k of keys) {
    const v = obj[k]
    lines.push(`${k}=${v == null ? '' : String(v)}`)
  }
  return lines.join('\n') + '\n'
}

function readEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {}
    return parseEnvFile(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return {}
  }
}

function writeEnvFile(filePath, updates) {
  const existing = readEnvFile(filePath)
  const merged = { ...existing, ...(updates || {}) }
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, serializeEnv(merged), 'utf8')
  return merged
}

function buildBasicAuthHeader(user, pass) {
  const u = String(user || '')
  const p = String(pass || '')
  if (!u && !p) return null
  const token = Buffer.from(`${u}:${p}`).toString('base64')
  return `Basic ${token}`
}

async function createServices(rootDir, existing) {
  require('dotenv').config({ path: path.join(rootDir, '.env') })

  const { getAppConfig } = require('./src/config/app-config')
  const { createConfigStore } = require('./src/config/config-store')
  const { createLogger } = require('./src/logger/app-logger')
  const { createHttpClient } = require('./src/core/http-client')
  const { createAirtableClient } = require('./src/core/airtable-client')
  const { createLock } = require('./src/core/lock-service')
  const { createStateService } = require('./src/core/state-service')
  const { createWpClient } = require('./src/import/wp-fetch')
  const { createUpsertService } = require('./src/import/upsert')
  const { createSyncRunner } = require('./src/import/sync-runner')

  const { createAiProvider } = require('./src/ai/ai-provider')
  const { createOrchestrator } = require('./src/ai/orchestrator')
  const { createSeoEnhancer } = require('./src/ai/seo-enhancer')
  const { createContentEnhancer } = require('./src/ai/content-enhancer')
  const { createAddonsEnhancer } = require('./src/ai/addons-enhancer')
  const { createHighlightsEnhancer } = require('./src/ai/highlights-enhancer')
  const { createItineraryEnhancer } = require('./src/ai/itinerary-enhancer')
  const { createIncExcEnhancer } = require('./src/ai/inc-exc-enhancer')
  const { createTripFactsEnhancer } = require('./src/ai/trip-facts-enhancer')
  const { createFaqsEnhancer } = require('./src/ai/faqs-enhancer')
  const { createImagesEnhancer } = require('./src/ai/images-enhancer')

  const { createPublisher } = require('./src/publish/publisher')
  const { createUpdater } = require('./src/publish/updater')

  const { createMigrationRunner } = require('./src/migration/migration-runner')
  const { createMigrationTest } = require('./src/migration/migration-test')

  const { createTaskScheduler } = require('./src/scheduler/task-scheduler')

  const config = getAppConfig({ rootDir })
  const store = existing && existing.store ? existing.store : createConfigStore({ filePath: path.resolve(rootDir, 'data', 'config-store.json') })
  const logger = existing && existing.logger ? existing.logger : createLogger({ rootDir, debug: config.DEBUG })
  const http = createHttpClient({ logger, debug: config.DEBUG })
  const airtable = createAirtableClient({ http, logger, baseId: config.AIRTABLE_BASE_ID, apiKey: config.AIRTABLE_API_KEY })
  const lock = createLock()
  const state = createStateService({ store })
  const aiProvider = createAiProvider({ http, logger, config })

  const orchestrator = createOrchestrator({ airtable, http, config, logger, lock, store })
  const wp = createWpClient({ http, config })
  const upsert = createUpsertService({ airtable, config, logger, fetchTripById: wp.fetchTripById })
  const syncRunner = createSyncRunner({
    logger,
    config,
    lock,
    state,
    wp,
    upsert,
    getTripRecordIdByTripID: (tripId) => airtable.getTripRecordIdByTripID(tripId),
    initializePipeline: (tripRecordId) => orchestrator.initializeEnhancementPipeline_(tripRecordId)
  })

  const seoEnhancer = createSeoEnhancer({ airtable, http, config, logger, lock, store, aiProvider })
  const contentEnhancer = createContentEnhancer({ airtable, http, config, logger, lock, store, aiProvider })
  const addonsEnhancer = createAddonsEnhancer({ airtable, http, config, logger, lock, store, aiProvider })
  const highlightsEnhancer = createHighlightsEnhancer({ airtable, http, config, logger, lock, store, aiProvider })
  const itineraryEnhancer = createItineraryEnhancer({ airtable, http, config, logger, lock, store, aiProvider })
  const incExcEnhancer = createIncExcEnhancer({ airtable, http, config, logger, lock, store, aiProvider })
  const tripFactsEnhancer = createTripFactsEnhancer({ airtable, http, config, logger, lock, store, aiProvider })
  const faqsEnhancer = createFaqsEnhancer({ airtable, http, config, logger, lock, store, aiProvider })
  const imagesEnhancer = createImagesEnhancer({ airtable, http, config, logger, lock, store, aiProvider })

  const publisher = createPublisher({ airtable, http, config, logger, lock, store, aiProvider })
  const updater = createUpdater({ airtable, http, config, logger, lock, store, aiProvider })

  const migrationRunner = createMigrationRunner({ airtable, http, config, logger, lock, store, orchestrator })
  const migrationTest = createMigrationTest({ airtable, http, config, logger, lock, store, orchestrator })

  const stageResetFieldMap = {
    seo: { table: 'Improvement With AI', field: 'AI_SEO_Status' },
    content: { table: 'Trips', field: 'AI_Status' },
    addons: { table: 'Trips', field: 'AI_AddOns_Status' },
    highlights: { table: 'Trips', field: 'AI_Highlights_Status' },
    itinerary: { table: 'Trips', field: 'AI_Itinerary_Status' },
    incexc: { table: 'Trips', field: 'AI_IncExc_Status' },
    tripfacts: { table: 'Trips', field: 'AI_TripFacts_Status' },
    faqs: { table: 'Trips', field: 'AI_FAQs_Status' },
    images: { table: 'Trips', field: 'AI_Images_Status' }
  }

  const taskFns = {
    runImportStepSafe: async () => syncRunner.runImportStepSafe(),
    checkAndProgressPipeline: async () => orchestrator.checkAndProgressPipeline(),
    detectStuckProcesses: async () => orchestrator.detectStuckProcesses(),

    runAiSeoEnhancementBatch: async () => seoEnhancer.runAiSeoEnhancementBatch(),
    runAiEnhancementBatch: async () => contentEnhancer.runAiEnhancementBatch(),
    runAiAddOnsEnhancementBatch: async () => addonsEnhancer.runAiAddOnsEnhancementBatch(),
    runAiHighlightsEnhancementBatch: async () => highlightsEnhancer.runAiHighlightsEnhancementBatch(),
    runAiItineraryBatch: async () => itineraryEnhancer.runAiItineraryBatch(),
    runAiImagesEnhancementBatch: async () => imagesEnhancer.runAiImagesEnhancementBatch(),

    runAiIncludesExcludesBatch: async () => incExcEnhancer.runAiIncludesExcludesExtractionBatch(),
    runAiTripFactsBatch: async () => tripFactsEnhancer.runAiTripFactsEnhancementBatch(),
    runAiFaqsBatch: async () => faqsEnhancer.runAiFaqsEnhancementBatch(),

    runPublisherBatch: async () => publisher.runPublisherBatch(),
    runUpdaterBatch: async () => updater.runUpdaterBatch()
  }

  const scheduler = createTaskScheduler({
    logger,
    store,
    taskFns,
    onTaskEvent: existing && existing.onTaskEvent ? existing.onTaskEvent : null
  })

  async function resetTripStage(tripRecordId, stageName) {
    const key = String(stageName || '').toLowerCase().replace(/[^a-z]/g, '')
    const m = stageResetFieldMap[key]
    if (!m) throw new Error(`Unknown stage: ${String(stageName)}`)

    if (m.table === 'Trips') {
      await airtable.airtableUpdate('Trips', tripRecordId, { [m.field]: 'Pending', Pipeline_Status: 'In Progress' })
      return true
    }

    const formula = `FIND('${String(tripRecordId)}', ARRAYJOIN({Trip}))`
    const res = await airtable.airtableGet('Improvement With AI', { filterByFormula: formula, maxRecords: 1 })
    const recs = res && res.records ? res.records : []
    if (!recs.length) throw new Error('Improvement record not found')
    await airtable.airtableUpdate('Improvement With AI', recs[0].id, { [m.field]: 'Pending' })
    await airtable.airtableUpdate('Trips', tripRecordId, { Pipeline_Status: 'In Progress' })
    return true
  }

  return {
    rootDir,
    config,
    store,
    logger,
    http,
    airtable,
    lock,
    state,
    aiProvider,
    orchestrator,
    syncRunner,
    seoEnhancer,
    contentEnhancer,
    addonsEnhancer,
    highlightsEnhancer,
    itineraryEnhancer,
    incExcEnhancer,
    tripFactsEnhancer,
    faqsEnhancer,
    imagesEnhancer,
    publisher,
    updater,
    migrationRunner,
    migrationTest,
    scheduler,
    resetTripStage
  }
}

function createBroadcaster() {
  function windows() {
    return BrowserWindow.getAllWindows()
  }

  return {
    send(channel, payload) {
      for (const w of windows()) {
        try {
          w.webContents.send(channel, payload)
        } catch {
        }
      }
    }
  }
}

function setup() {
  const appDir = path.resolve(__dirname)
  const rootDir = app.isPackaged ? app.getPath('userData') : appDir
  ensureDir(path.resolve(rootDir, 'data'))

  if (app.isPackaged) {
    const userEnvPath = path.join(rootDir, '.env')
    if (!fs.existsSync(userEnvPath)) {
      ensureDir(path.dirname(userEnvPath))
      const templatePath = path.join(appDir, '.env.example')
      if (fs.existsSync(templatePath)) {
        fs.copyFileSync(templatePath, userEnvPath)
      } else {
        fs.writeFileSync(userEnvPath, '', 'utf8')
      }
    }
  }

  const broadcaster = createBroadcaster()

  function createWindow() {
    const win = new BrowserWindow({
      width: 1280,
      height: 800,
      backgroundColor: '#0b0f14',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(appDir, 'preload.js')
      }
    })

    win.loadFile(path.join(appDir, 'renderer', 'index.html'))
    return win
  }

  const services = { current: null }
  async function rebuildServices() {
    if (services.current && services.current.scheduler) {
      try {
        services.current.scheduler.stopAll()
      } catch {
      }
    }

    services.current = await createServices(rootDir, {
      store: services.current ? services.current.store : null,
      logger: services.current ? services.current.logger : null,
      onTaskEvent: (channel, payload) => {
        broadcaster.send(channel, payload)
      }
    })

    if (services.current && services.current.logger) {
      services.current.logger.onEntry((entry) => broadcaster.send('log:entry', entry))
    }
  }

  function current() {
    if (!services.current) throw new Error('Services not ready')
    return services.current
  }

  ipcMain.handle('cache:clear', async () => {
    try {
      const s = current()
      if (s && s.updater && typeof s.updater.clearCaches === 'function') {
        await s.updater.clearCaches()
      }
      return true
    } catch {
      return false
    }
  })

  function wrapTask(channelName, fn) {
    return async (_evt, ...args) => {
      const startedAt = new Date().toISOString()
      broadcaster.send('task:started', { task: channelName, startedAt, argsPreview: args && args.length ? args.slice(0, 3) : [] })
      try {
        const result = await fn(...args)
        broadcaster.send('task:completed', { task: channelName, finishedAt: new Date().toISOString() })
        if (String(channelName).startsWith('import:') || String(channelName).startsWith('pipeline:') || String(channelName).startsWith('ai:') || String(channelName).startsWith('publish:') || String(channelName).startsWith('update:')) {
          broadcaster.send('trips:updated', { ts: new Date().toISOString(), source: channelName })
        }
        return { ok: true, result }
      } catch (e) {
        const err = String(e && e.message ? e.message : e)
        broadcaster.send('task:error', { task: channelName, error: err, finishedAt: new Date().toISOString() })
        return { ok: false, error: err }
      }
    }
  }

  ipcMain.handle('config:get', async (_evt, key) => {
    return current().store.getProperty(String(key))
  })

  ipcMain.handle('config:set', async (_evt, key, value) => {
    current().store.setProperty(String(key), value == null ? '' : String(value))
    return true
  })

  ipcMain.handle('import:run', wrapTask('import:run', async () => current().syncRunner.runImportStepSafe()))
  ipcMain.handle('import:single', wrapTask('import:single', async (tripId) => current().syncRunner.syncSingleTripById(String(tripId || ''))))
  ipcMain.handle('import:reset', wrapTask('import:reset', async () => current().syncRunner.resetWpImportStateForToday()))

  ipcMain.handle('pipeline:check', wrapTask('pipeline:check', async () => current().orchestrator.checkAndProgressPipeline()))
  ipcMain.handle('pipeline:detect-stuck', wrapTask('pipeline:detect-stuck', async () => current().orchestrator.detectStuckProcesses()))

  ipcMain.handle('ai:init-pipeline', wrapTask('ai:init-pipeline', async (tripRecordId) => current().orchestrator.initializeEnhancementPipeline_(String(tripRecordId || ''))))
  ipcMain.handle('ai:reset-stage', wrapTask('ai:reset-stage', async (tripRecordId, stageName) => current().resetTripStage(String(tripRecordId || ''), String(stageName || ''))))

  ipcMain.handle('ai:run-stage', wrapTask('ai:run-stage', async (stageName, tripRecordId) => {
    const s = String(stageName || '').toLowerCase().trim()
    const map = {
      seo: () => current().seoEnhancer.runAiSeoEnhancementBatch(),
      content: () => current().contentEnhancer.runAiEnhancementBatch(),
      addons: () => current().addonsEnhancer.runAiAddOnsEnhancementBatch(),
      highlights: () => current().highlightsEnhancer.runAiHighlightsEnhancementBatch(),
      itinerary: () => current().itineraryEnhancer.runAiItineraryBatch(),
      incexc: () => current().incExcEnhancer.runAiIncludesExcludesExtractionBatch(),
      tripfacts: () => current().tripFactsEnhancer.runAiTripFactsEnhancementBatch(),
      faqs: () => current().faqsEnhancer.runAiFaqsEnhancementBatch(),
      images: () => current().imagesEnhancer.runAiImagesEnhancementBatch()
    }
    const key = s.replace(/[^a-z]/g, '')
    if (!map[key]) throw new Error(`Unknown stage: ${s}`)

    const tripId = String(tripRecordId || '').trim()
    if (tripId) {
      await current().resetTripStage(tripId, s)
    }
    return map[key]()
  }))

  ipcMain.handle('publish:run', wrapTask('publish:run', async () => current().publisher.runPublisherBatch()))
  ipcMain.handle('update:run', wrapTask('update:run', async () => current().updater.runUpdaterBatch()))
  ipcMain.handle('publish:toggle', wrapTask('publish:toggle', async (enabled) => {
    const en = !!enabled
    current().store.setProperty('PUBLISHER_WORKFLOW_ENABLED', en ? 'true' : 'false')
    return en
  }))

  ipcMain.handle('migration:test', wrapTask('migration:test', async () => current().migrationTest.runTestMigration()))
  ipcMain.handle('migration:run', wrapTask('migration:run', async () => current().migrationRunner.runFullMigration()))
  ipcMain.handle('migration:reset', wrapTask('migration:reset', async () => current().migrationRunner.resetTripIDCounter()))

  ipcMain.handle('scheduler:get-all', async () => current().scheduler.getAllSchedules())
  ipcMain.handle('scheduler:update', async (_evt, name, patch) => current().scheduler.updateSchedule(String(name || ''), patch || {}))
  ipcMain.handle('scheduler:run-now', wrapTask('scheduler:run-now', async (name) => current().scheduler.runNow(String(name || ''))))
  ipcMain.handle('scheduler:start-all', wrapTask('scheduler:start-all', async () => current().scheduler.startAll()))
  ipcMain.handle('scheduler:stop-all', wrapTask('scheduler:stop-all', async () => current().scheduler.stopAll()))

  ipcMain.handle('trips:fetch-all', async () => {
    const airtable = current().airtable
    const all = []
    let offset = null
    do {
      const params = { pageSize: 100 }
      if (offset) params.offset = offset
      const res = await airtable.airtableGet('Trips', params)
      const recs = res && res.records ? res.records : []
      for (const r of recs) all.push({ id: r.id, fields: r.fields || {} })
      offset = res && res.offset ? res.offset : null
    } while (offset)

    const improvements = []
    offset = null
    do {
      const params = { pageSize: 100 }
      if (offset) params.offset = offset
      const res = await airtable.airtableGet('Improvement With AI', params)
      const recs = res && res.records ? res.records : []
      for (const r of recs) improvements.push({ id: r.id, fields: r.fields || {} })
      offset = res && res.offset ? res.offset : null
    } while (offset)

    return mergeSeoStatusFromImprovementRecords(all, improvements)
  })

  ipcMain.handle('trips:fetch-one', async (_evt, tripRecordId) => {
    const id = String(tripRecordId || '')
    const res = await current().airtable.airtableGet('Trips', { filterByFormula: `RECORD_ID() = '${id}'`, maxRecords: 1 })
    const recs = res && res.records ? res.records : []
    return recs.length ? { id: recs[0].id, fields: recs[0].fields || {} } : null
  })

  ipcMain.handle('settings:get', async () => {
    const keys = [
      'WP_API_BASE',
      'WP_API_URL_SINGLE',
      'WP_API_USER',
      'WP_API_PASS',
      'AIRTABLE_API_KEY',
      'AIRTABLE_BASE_ID',
      'DEEPSEEK_API_KEY',
      'DEEPSEEK_ENDPOINT',
      'DEEPSEEK_MODEL',
      'OPENAI_API_KEY',
      'DEBUG',
      'PUBLISHER_WORKFLOW_ENABLED',
      'WP_PER_PAGE',
      'MAX_TRIPS_PER_DAY',
      'MAX_TRIPS_PER_RUN',
      'WORKER_ID'
    ]

    const out = {}
    for (const k of keys) out[k] = process.env[k] || ''
    out.CONFIG_STORE_PATH = current().store.filePath
    out.ENV_PATH = path.join(rootDir, '.env')
    return out
  })

  ipcMain.handle('settings:save', wrapTask('settings:save', async (settings) => {
    const s = settings && typeof settings === 'object' ? settings : {}
    const envPath = path.join(rootDir, '.env')

    const allowed = new Set([
      'WP_API_BASE',
      'WP_API_URL_SINGLE',
      'WP_API_USER',
      'WP_API_PASS',
      'AIRTABLE_API_KEY',
      'AIRTABLE_BASE_ID',
      'DEEPSEEK_API_KEY',
      'DEEPSEEK_ENDPOINT',
      'DEEPSEEK_MODEL',
      'OPENAI_API_KEY',
      'DEBUG',
      'PUBLISHER_WORKFLOW_ENABLED',
      'WP_PER_PAGE',
      'MAX_TRIPS_PER_DAY',
      'MAX_TRIPS_PER_RUN',
      'WORKER_ID'
    ])

    const updates = {}
    for (const k of Object.keys(s)) {
      if (!allowed.has(k)) continue
      updates[k] = String(s[k] == null ? '' : s[k])
    }

    const merged = writeEnvFile(envPath, updates)
    for (const k of Object.keys(merged)) process.env[k] = merged[k]
    for (const k of Object.keys(updates)) current().store.setProperty(k, updates[k])
    await rebuildServices()
    return true
  }))

  ipcMain.handle('settings:test', wrapTask('settings:test', async (serviceName) => {
    const name = String(serviceName || '').toLowerCase().trim()
    const svc = current()
    const http = svc.http
    const cfg = svc.config

    if (name === 'wordpress') {
      const headers = {}
      const auth = buildBasicAuthHeader(cfg.WP_API_USER, cfg.WP_API_PASS)
      if (auth) headers.Authorization = auth
      let base = String(cfg.WP_API_BASE || '')
      const qIndex = base.indexOf('?')
      if (qIndex !== -1) base = base.substring(0, qIndex)
      if (base.endsWith('/')) base = base.slice(0, -1)
      if (base.endsWith('/trips')) base = base.slice(0, -6)
      if (base.endsWith('/trip')) base = base.slice(0, -5)
      const url = base + '/trips'
      const resp = await http.getJson(url, headers)
      return { ok: true, sample: resp }
    }

    if (name === 'airtable') {
      const res = await svc.airtable.airtableGet('Trips', { maxRecords: 1 })
      return { ok: true, sampleCount: (res && res.records ? res.records.length : 0) }
    }

    if (name === 'deepseek') {
      const res = await svc.aiProvider.callDeepseek('Return JSON only: {"ok": true}')
      return { ok: true, sample: res }
    }

    if (name === 'openai') {
      const res = await svc.aiProvider.callOpenai('Return JSON only: {"ok": true}')
      return { ok: true, sample: res }
    }

    throw new Error(`Unknown service: ${serviceName}`)
  }))

  ipcMain.handle('logs:export', async () => {
    const res = await dialog.showSaveDialog({
      title: 'Export Logs',
      defaultPath: path.join(rootDir, 'data', 'logs', `export-${Date.now()}.log`)
    })
    if (res.canceled || !res.filePath) return { ok: false, canceled: true }

    const srcPath = path.join(rootDir, 'data', 'logs', 'app.log')
    fs.copyFileSync(srcPath, res.filePath)
    return { ok: true, filePath: res.filePath }
  })

  ipcMain.handle('logs:clear', async () => {
    const logPath = path.join(rootDir, 'data', 'logs', 'app.log')
    try {
      fs.writeFileSync(logPath, '', 'utf8')
    } catch {
    }
    return true
  })

  app.whenReady().then(() => {
    createWindow()

    rebuildServices()
      .then(() => {
        broadcaster.send('services:ready', { ts: new Date().toISOString() })
      })
      .catch((err) => {
        console.error('Service init error:', err)
        broadcaster.send('services:error', { ts: new Date().toISOString(), error: String(err && err.message ? err.message : err) })
      })
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

if (process.versions && process.versions.electron) {
  setup()
}

module.exports = { createServices }
