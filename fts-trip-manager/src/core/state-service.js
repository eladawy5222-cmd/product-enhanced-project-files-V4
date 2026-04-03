function createStateService(options) {
  const store = options.store

  const LEGACY_KEYS = {
    page: 'LAST_PAGE',
    index: 'LAST_INDEX',
    todayCount: 'TODAY_COUNT',
    todayDate: 'TODAY_DATE'
  }
  const WP_IMPORT_KEY = 'WP_IMPORT_STATE'

  function loadLegacyImportState() {
    const p = store.getProperties()
    return {
      page: Number(p[LEGACY_KEYS.page] || 1),
      index: Number(p[LEGACY_KEYS.index] || 0),
      todayCount: Number(p[LEGACY_KEYS.todayCount] || 0),
      todayDate: p[LEGACY_KEYS.todayDate] || ''
    }
  }

  function saveLegacyImportState(page, index, todayCount) {
    store.setProperties({
      LAST_PAGE: String(page),
      LAST_INDEX: String(index),
      TODAY_COUNT: String(todayCount),
      TODAY_DATE: new Date().toDateString()
    })
  }

  function resetLegacyImportState() {
    store.deleteProperty(LEGACY_KEYS.page)
    store.deleteProperty(LEGACY_KEYS.index)
    store.deleteProperty(LEGACY_KEYS.todayCount)
    store.deleteProperty(LEGACY_KEYS.todayDate)
  }

  function loadWpImportState() {
    const json = store.getProperty(WP_IMPORT_KEY)
    if (json) {
      try {
        return JSON.parse(json)
      } catch {
      }
    }
    return {
      page: 1,
      index: 0,
      todayCount: 0,
      todayDate: new Date().toDateString()
    }
  }

  function saveWpImportState(page, index, todayCount) {
    const state = loadWpImportState()
    state.page = page
    state.index = index
    state.todayCount = todayCount
    state.todayDate = state.todayDate || new Date().toDateString()
    store.setProperty(WP_IMPORT_KEY, JSON.stringify(state))
  }

  function resetWpImportState() {
    store.deleteProperty(WP_IMPORT_KEY)
  }

  return {
    legacyImport: {
      load: loadLegacyImportState,
      save: saveLegacyImportState,
      reset: resetLegacyImportState
    },
    wpImport: {
      load: loadWpImportState,
      save: saveWpImportState,
      reset: resetWpImportState
    }
  }
}

module.exports = { createStateService }

