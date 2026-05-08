const { contextBridge, ipcRenderer } = require('electron')

function on(channel, handler) {
  const wrapped = (_evt, payload) => handler(payload)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.off(channel, wrapped)
}

async function invokeWithCacheClear(channel, ...args) {
  if (channel !== 'cache:clear') {
    try {
      await ipcRenderer.invoke('cache:clear')
    } catch {
    }
  }
  return ipcRenderer.invoke(channel, ...args)
}

contextBridge.exposeInMainWorld('fts', {
  configGet: (key) => invokeWithCacheClear('config:get', key),
  configSet: (key, value) => invokeWithCacheClear('config:set', key, value),

  importRun: () => invokeWithCacheClear('import:run'),
  importSingle: (tripId) => invokeWithCacheClear('import:single', tripId),
  importReset: () => invokeWithCacheClear('import:reset'),

  pipelineCheck: () => invokeWithCacheClear('pipeline:check'),
  pipelineDetectStuck: () => invokeWithCacheClear('pipeline:detect-stuck'),

  aiRunStage: (stageName, tripRecordId) => invokeWithCacheClear('ai:run-stage', stageName, tripRecordId),
  aiResetStage: (tripRecordId, stageName) => invokeWithCacheClear('ai:reset-stage', tripRecordId, stageName),
  aiInitPipeline: (tripRecordId) => invokeWithCacheClear('ai:init-pipeline', tripRecordId),

  publishRun: () => invokeWithCacheClear('publish:run'),
  updateRun: () => invokeWithCacheClear('update:run'),
  publishToggle: (enabled) => invokeWithCacheClear('publish:toggle', enabled),

  migrationTest: () => invokeWithCacheClear('migration:test'),
  migrationRun: () => invokeWithCacheClear('migration:run'),
  migrationReset: () => invokeWithCacheClear('migration:reset'),

  schedulerGetAll: () => invokeWithCacheClear('scheduler:get-all'),
  schedulerUpdate: (name, patch) => invokeWithCacheClear('scheduler:update', name, patch),
  schedulerRunNow: (name) => invokeWithCacheClear('scheduler:run-now', name),
  schedulerStartAll: () => invokeWithCacheClear('scheduler:start-all'),
  schedulerStopAll: () => invokeWithCacheClear('scheduler:stop-all'),

  reviewsGetStats: () => invokeWithCacheClear('reviews:stats'),
  reviewsFetchRecent: (limit) => invokeWithCacheClear('reviews:recent', limit),
  reviewsResetCursor: () => invokeWithCacheClear('reviews:reset-cursor'),
  reviewsPublishTrip: (tripRecordId) => invokeWithCacheClear('reviews:publish-trip', tripRecordId),

  tripsFetchAll: () => invokeWithCacheClear('trips:fetch-all'),
  tripsFetchOne: (tripRecordId) => invokeWithCacheClear('trips:fetch-one', tripRecordId),

  settingsGet: () => invokeWithCacheClear('settings:get'),
  settingsSave: (settings) => invokeWithCacheClear('settings:save', settings),
  settingsTest: (serviceName) => invokeWithCacheClear('settings:test', serviceName),

  logsClear: () => invokeWithCacheClear('logs:clear'),
  logsExport: () => invokeWithCacheClear('logs:export'),

  onLogEntry: (handler) => on('log:entry', handler),
  onTaskStarted: (handler) => on('task:started', handler),
  onTaskCompleted: (handler) => on('task:completed', handler),
  onTaskError: (handler) => on('task:error', handler),
  onTripsUpdated: (handler) => on('trips:updated', handler)
  ,
  onServicesReady: (handler) => on('services:ready', handler),
  onServicesError: (handler) => on('services:error', handler)
})
