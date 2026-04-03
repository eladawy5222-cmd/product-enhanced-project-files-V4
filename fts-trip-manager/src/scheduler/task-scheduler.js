const cron = require('node-cron')
const cronParser = require('cron-parser')

const SCHEDULER_STORE_KEY = 'SCHEDULER_SCHEDULES'

const DEFAULT_SCHEDULES = {
  importTrips: { cron: '*/10 * * * *', enabled: false, fn: 'runImportStepSafe' },
  progressPipeline: { cron: '*/5 * * * *', enabled: false, fn: 'checkAndProgressPipeline' },
  detectStuck: { cron: '*/30 * * * *', enabled: false, fn: 'detectStuckProcesses' },
  seoEnhancer: { cron: '*/15 * * * *', enabled: false, fn: 'runAiSeoEnhancementBatch' },
  contentEnhancer: { cron: '*/10 * * * *', enabled: false, fn: 'runAiEnhancementBatch' },
  addonsEnhancer: { cron: '*/10 * * * *', enabled: false, fn: 'runAiAddOnsEnhancementBatch' },
  highlightsEnhancer: { cron: '*/10 * * * *', enabled: false, fn: 'runAiHighlightsEnhancementBatch' },
  itineraryEnhancer: { cron: '*/10 * * * *', enabled: false, fn: 'runAiItineraryBatch' },
  incExcEnhancer: { cron: '*/10 * * * *', enabled: false, fn: 'runAiIncludesExcludesBatch' },
  tripFactsEnhancer: { cron: '*/10 * * * *', enabled: false, fn: 'runAiTripFactsBatch' },
  faqsEnhancer: { cron: '*/10 * * * *', enabled: false, fn: 'runAiFaqsBatch' },
  imagesEnhancer: { cron: '*/10 * * * *', enabled: false, fn: 'runAiImagesEnhancementBatch' },
  publisher: { cron: '*/15 * * * *', enabled: false, fn: 'runPublisherBatch' },
  updater: { cron: '*/15 * * * *', enabled: false, fn: 'runUpdaterBatch' }
}

function safeJsonParse(s) {
  if (!s) return null
  try {
    return JSON.parse(String(s))
  } catch {
    return null
  }
}

function normalizeSchedule(def, stored) {
  const base = {
    cron: String(def.cron),
    enabled: !!def.enabled,
    fn: String(def.fn),
    lastRun: null,
    runCount: 0,
    errorCount: 0,
    lastError: null
  }

  if (stored && typeof stored === 'object') {
    if (typeof stored.cron === 'string') base.cron = stored.cron
    if (typeof stored.enabled === 'boolean') base.enabled = stored.enabled
    if (typeof stored.lastRun === 'string') base.lastRun = stored.lastRun
    if (typeof stored.runCount === 'number') base.runCount = stored.runCount
    if (typeof stored.errorCount === 'number') base.errorCount = stored.errorCount
    if (typeof stored.lastError === 'string') base.lastError = stored.lastError
  }

  return base
}

function nextRunFromCron(cronExpr) {
  try {
    const it = cronParser.parseExpression(String(cronExpr))
    return it.next().toDate().toISOString()
  } catch {
    return null
  }
}

function createTaskScheduler(options) {
  const logger = options.logger
  const store = options.store
  const taskFns = options.taskFns
  const onTaskEvent = typeof options.onTaskEvent === 'function' ? options.onTaskEvent : null

  if (!logger) throw new Error('createTaskScheduler: missing options.logger')
  if (!store) throw new Error('createTaskScheduler: missing options.store')
  if (!taskFns) throw new Error('createTaskScheduler: missing options.taskFns')

  let schedules = {}
  const jobs = new Map()

  function persist() {
    const out = {}
    for (const name of Object.keys(schedules)) {
      const s = schedules[name]
      out[name] = {
        cron: s.cron,
        enabled: !!s.enabled,
        lastRun: s.lastRun,
        runCount: s.runCount,
        errorCount: s.errorCount,
        lastError: s.lastError
      }
    }
    store.setProperty(SCHEDULER_STORE_KEY, JSON.stringify(out))
  }

  function load() {
    const stored = safeJsonParse(store.getProperty(SCHEDULER_STORE_KEY)) || {}
    const merged = {}
    for (const name of Object.keys(DEFAULT_SCHEDULES)) {
      merged[name] = normalizeSchedule(DEFAULT_SCHEDULES[name], stored[name])
    }
    schedules = merged
    persist()
  }

  function getSchedule(name) {
    const n = String(name)
    if (!schedules[n]) throw new Error(`Unknown schedule: ${n}`)
    return schedules[n]
  }

  function isRunning(name) {
    const job = jobs.get(String(name))
    return !!job
  }

  async function runTask(name, reason) {
    const n = String(name)
    const s = getSchedule(n)
    const fnName = String(s.fn)
    const fn = taskFns[fnName]
    if (typeof fn !== 'function') throw new Error(`Missing task function: ${fnName}`)

    const startedAt = new Date().toISOString()
    if (onTaskEvent) onTaskEvent('task:started', { task: n, fn: fnName, reason: reason || 'manual', startedAt })
    logger.info(`Scheduler: task started ${n} (${fnName}) reason=${reason || 'manual'}`)

    try {
      await fn()
      s.lastRun = new Date().toISOString()
      s.runCount += 1
      s.lastError = null
      persist()
      if (onTaskEvent) onTaskEvent('task:completed', { task: n, fn: fnName, reason: reason || 'manual', finishedAt: new Date().toISOString() })
      logger.info(`Scheduler: task completed ${n} (${fnName})`)
      return true
    } catch (e) {
      s.lastRun = new Date().toISOString()
      s.runCount += 1
      s.errorCount += 1
      s.lastError = String(e && e.message ? e.message : e)
      persist()
      if (onTaskEvent) onTaskEvent('task:error', { task: n, fn: fnName, reason: reason || 'manual', error: s.lastError, finishedAt: new Date().toISOString() })
      logger.error(`Scheduler: task error ${n} (${fnName}): ${s.lastError}`)
      return false
    }
  }

  function stop(name) {
    const n = String(name)
    const job = jobs.get(n)
    if (!job) return
    try {
      job.stop()
      if (typeof job.destroy === 'function') job.destroy()
    } catch {
    }
    jobs.delete(n)
  }

  function start(name) {
    const n = String(name)
    const s = getSchedule(n)
    if (!cron.validate(String(s.cron))) throw new Error(`Invalid cron: ${String(s.cron)}`)

    stop(n)
    const job = cron.schedule(String(s.cron), () => {
      runTask(n, 'cron').catch(() => {})
    })
    jobs.set(n, job)
  }

  function startAll() {
    for (const name of Object.keys(schedules)) {
      if (schedules[name].enabled) start(name)
    }
  }

  function stopAll() {
    for (const name of Array.from(jobs.keys())) stop(name)
  }

  function getAll() {
    const out = []
    for (const name of Object.keys(schedules)) {
      const s = schedules[name]
      out.push({
        name,
        cron: s.cron,
        enabled: !!s.enabled,
        fn: s.fn,
        lastRun: s.lastRun,
        nextRun: nextRunFromCron(s.cron),
        runCount: s.runCount,
        errorCount: s.errorCount,
        lastError: s.lastError,
        running: isRunning(name)
      })
    }
    return out
  }

  function update(name, patch) {
    const n = String(name)
    const s = getSchedule(n)
    const p = patch && typeof patch === 'object' ? patch : {}

    if (Object.prototype.hasOwnProperty.call(p, 'cron')) {
      const expr = String(p.cron || '').trim()
      if (!cron.validate(expr)) throw new Error(`Invalid cron: ${expr}`)
      s.cron = expr
    }
    if (Object.prototype.hasOwnProperty.call(p, 'enabled')) {
      s.enabled = !!p.enabled
    }

    persist()

    if (s.enabled) start(n)
    else stop(n)

    return { ...s, name: n, nextRun: nextRunFromCron(s.cron), running: isRunning(n) }
  }

  load()

  return {
    DEFAULT_SCHEDULES,
    getAllSchedules: getAll,
    updateSchedule: update,
    runNow: async (name) => runTask(name, 'manual'),
    startSchedule: start,
    stopSchedule: stop,
    startAll,
    stopAll
  }
}

module.exports = { createTaskScheduler, DEFAULT_SCHEDULES }
