var StateService = (function() {
  var LEGACY_KEYS = {
    page: 'LAST_PAGE',
    index: 'LAST_INDEX',
    todayCount: 'TODAY_COUNT',
    todayDate: 'TODAY_DATE'
  };
  var WP_IMPORT_KEY = 'WP_IMPORT_STATE';

  function getProps_() {
    return PropertiesService.getScriptProperties();
  }

  function loadLegacyImportState() {
    var p = getProps_().getProperties();
    return {
      page: Number(p[LEGACY_KEYS.page] || 1),
      index: Number(p[LEGACY_KEYS.index] || 0),
      todayCount: Number(p[LEGACY_KEYS.todayCount] || 0),
      todayDate: p[LEGACY_KEYS.todayDate] || ''
    };
  }

  function saveLegacyImportState(page, index, todayCount) {
    getProps_().setProperties({
      LAST_PAGE: String(page),
      LAST_INDEX: String(index),
      TODAY_COUNT: String(todayCount),
      TODAY_DATE: new Date().toDateString()
    });
  }

  function resetLegacyImportState() {
    var props = getProps_();
    props.deleteProperty(LEGACY_KEYS.page);
    props.deleteProperty(LEGACY_KEYS.index);
    props.deleteProperty(LEGACY_KEYS.todayCount);
    props.deleteProperty(LEGACY_KEYS.todayDate);
  }

  function loadWpImportState() {
    var json = getProps_().getProperty(WP_IMPORT_KEY);
    if (json) {
      try {
        return JSON.parse(json);
      } catch (e) {}
    }
    return {
      page: 1,
      index: 0,
      todayCount: 0,
      todayDate: new Date().toDateString()
    };
  }

  function saveWpImportState(page, index, todayCount) {
    var state = loadWpImportState();
    state.page = page;
    state.index = index;
    state.todayCount = todayCount;
    state.todayDate = state.todayDate || new Date().toDateString();
    getProps_().setProperty(WP_IMPORT_KEY, JSON.stringify(state));
  }

  function resetWpImportState() {
    getProps_().deleteProperty(WP_IMPORT_KEY);
  }

  function logWpImportState() {
    Logger.log(JSON.stringify(loadWpImportState(), null, 2));
  }

  function logLegacyImportState() {
    Logger.log(JSON.stringify(loadLegacyImportState(), null, 2));
  }

  return {
    legacyImport: {
      load: loadLegacyImportState,
      save: saveLegacyImportState,
      reset: resetLegacyImportState,
      log: logLegacyImportState
    },
    wpImport: {
      load: loadWpImportState,
      save: saveWpImportState,
      reset: resetWpImportState,
      log: logWpImportState
    }
  };
})();
