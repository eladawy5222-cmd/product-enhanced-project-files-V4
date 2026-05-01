/************************************************************
 * UPDATER: Airtable -> WordPress
 * 
 * Pushes enhanced content back to WordPress.
 * Updates existing trips if TripID is a valid WP ID.
 * Requires the custom PHP endpoint: POST /wp-json/fts/v1/trips/{id}
 * 
 * NOTE: Functions and variables are suffixed with _Updater to avoid
 * conflicts with publisher.gs in the global GAS scope.
 ************************************************************/

const { sleep, base64Encode, getUuid, md5Base64 } = require('../core/runtime')
const { createContextUtils } = require('../ai/context-utils')
const { createImprovementRepository } = require('../ai/enhancement-helpers')
const { createDestinationService } = require('./destination-utils')

let airtable
let http
let config
let CONFIG
let logger
let lock
let store
let aiProvider
let contextUtils
let improvementRepo
let destinationService

function initUpdater(options) {
  if (!options) throw new Error('createUpdater: missing options')
  airtable = options.airtable
  http = options.http
  config = options.config
  logger = options.logger
  lock = options.lock
  store = options.store
  aiProvider = options.aiProvider
  if (!airtable) throw new Error('createUpdater: missing options.airtable')
  if (!http) throw new Error('createUpdater: missing options.http')
  if (!config) throw new Error('createUpdater: missing options.config')
  if (!logger) throw new Error('createUpdater: missing options.logger')

  CONFIG = config

  contextUtils = createContextUtils({ airtable, logger, config })
  improvementRepo = createImprovementRepository({ airtable, http })
  destinationService = createDestinationService({ fetchUrl, config, base64Encode })
  if (!lock) {
    lock = {
      async tryLock() {
        return true
      },
      releaseLock() {
      }
    }
  }
}

function log(msg) {
  logger.info(String(msg == null ? '' : msg))
}

function warn(msg) {
  logger.warn(String(msg == null ? '' : msg))
}

function error(msg) {
  logger.error(String(msg == null ? '' : msg))
}

async function airtableGet_(tableName, params) {
  return airtable.airtableGet(tableName, params || {})
}

async function airtableUpdate_(tableName, recordId, fields) {
  return airtable.airtableUpdate(tableName, recordId, fields || {})
}

async function airtableGetRecordById_Updater_(tableName, recordId) {
  var t = String(tableName || '').trim();
  var id = String(recordId || '').trim();
  if (!t || !id) return null;
  var res = await airtableGet_(t, {
    pageSize: 1,
    maxRecords: 1,
    filterByFormula: 'RECORD_ID()="' + id + '"'
  });
  var recs = res && res.records ? res.records : [];
  if (!recs.length) return null;
  return { id: recs[0].id, fields: recs[0].fields || {} };
}

async function callDeepseekJson_(prompt) {
  if (!aiProvider) throw new Error('Updater: missing aiProvider')
  const p = String(prompt || '')
  if (typeof aiProvider.callDeepseek === 'function') return aiProvider.callDeepseek(p)
  if (typeof aiProvider.callDeepSeekJson === 'function') return aiProvider.callDeepSeekJson(p)
  throw new Error('Updater: aiProvider missing callDeepseek/callDeepSeekJson')
}

async function callOpenai_(prompt) {
  if (!aiProvider) throw new Error('Updater: missing aiProvider')
  const p = String(prompt || '')
  if (typeof aiProvider.callOpenai === 'function') return aiProvider.callOpenai(p)
  if (typeof aiProvider.callOpenAiJson === 'function') return aiProvider.callOpenAiJson(p)
  throw new Error('Updater: aiProvider missing callOpenai/callOpenAiJson')
}

async function buildImageContext_(imageFields, tripFields, imageId, tripId) {
  const ctx = {}

  const img = imageFields || {}
  const trip = tripFields || {}

  ctx.imageId = imageId || ''
  ctx.tripId = tripId || ''

  ctx.currentTitle = img.Title || ''
  ctx.currentCaption = img.Caption || ''
  ctx.currentAlt = img.Alt || ''
  ctx.url = img.URL || ''

  ctx.tripTitle = trip.Title || ''
  ctx.tripLocation = Array.isArray(trip.Cities) ? trip.Cities.join(', ') : ''
  ctx.tripType = trip.Tour_Type || ''
  ctx.tripCategory = trip.Category || ''

  const tripPublicId = trip.TripID || ''
  const tripName = trip.Title || ''

  try {
    const imp = await improvementRepo.fetchImprovementRecordForTrip({
      tripRecordId: String(tripId || ''),
      tripPublicId: tripPublicId ? String(tripPublicId) : null,
      tripName: tripName ? String(tripName) : null,
      tableName: 'Improvement With AI',
      tripLinkField: 'Trip'
    })
    const f = imp && imp.fields ? imp.fields : {}
    ctx.tripDescription = f.AI_Trip_Description || ''
    ctx.seoTitle = f.AI_SEO_Title || ''
    ctx.seoMetaDescription = f.AI_SEO_Meta_Description || ''
    ctx.seoKeywords = f.AI_SEO_FocusKeywords || ''
  } catch {
    ctx.tripDescription = ''
    ctx.seoTitle = ''
    ctx.seoMetaDescription = ''
    ctx.seoKeywords = ''
  }

  if (!ctx.seoKeywords) {
    const rawKw = trip['Focus Keyword'] || trip.FocusKeyword || trip.SEO_FocusKeywords || trip.SEO_FocusKeywords_List || trip['Focus Keyword (from Improvement With AI)']
    if (rawKw) ctx.seoKeywords = Array.isArray(rawKw) ? String(rawKw[0] || '') : String(rawKw)
  }

  try {
    const U = await contextUtils.buildUnifiedTripContext(String(tripId || ''), trip)
    ctx.highlightsText = U && U.highlightsText ? U.highlightsText : ''
    ctx.itineraryText = U && U.itineraryText ? U.itineraryText : ''
    ctx.includesText = U && U.includesText ? U.includesText : ''
  } catch {
    ctx.highlightsText = ''
    ctx.itineraryText = ''
    ctx.includesText = ''
  }

  return ctx
}

function buildImagesPrompt_(ctx, keywordPlan, opts) {
  var p = keywordPlan && keywordPlan.primary ? String(keywordPlan.primary) : (ctx && ctx.seoKeywords ? String(ctx.seoKeywords) : '');
  var secondary = keywordPlan && keywordPlan.secondary && Array.isArray(keywordPlan.secondary) ? keywordPlan.secondary : [];
  secondary = secondary.map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x; });
  if (secondary.length > 12) secondary = secondary.slice(0, 12);
  var forbiddenTitles = opts && opts.forbiddenTitles && Array.isArray(opts.forbiddenTitles) ? opts.forbiddenTitles : [];
  forbiddenTitles = forbiddenTitles.map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x; });
  if (forbiddenTitles.length > 25) forbiddenTitles = forbiddenTitles.slice(0, 25);
  var preferredTitleKeyword = opts && opts.preferredTitleKeyword ? String(opts.preferredTitleKeyword) : '';
  preferredTitleKeyword = preferredTitleKeyword.trim();
  var seoTitle = ctx && ctx.seoTitle ? String(ctx.seoTitle) : '';

  var prompt =
    "You are an SEO and accessibility expert for a premium global travel website. Enhance the metadata for this travel image.\n\n" +
    
    "CURRENT IMAGE DATA:\n" +
    "Title: " + (ctx.currentTitle || 'N/A') + "\n" +
    "Caption: " + (ctx.currentCaption || 'N/A') + "\n" +
    "Alt: " + (ctx.currentAlt || 'N/A') + "\n\n" +
    
    "TRIP CONTEXT:\n" +
    "Trip Title: " + (ctx.tripTitle || 'N/A') + "\n" +
    "Location: " + (ctx.tripLocation || 'N/A') + "\n" +
    "Tour Type: " + (ctx.tripType || 'N/A') + "\n" +
    "Category: " + (ctx.tripCategory || 'N/A') + "\n" +
    "Description: " + (ctx.tripDescription || 'N/A') + "\n\n" +
    (ctx.highlightsText ? ("HIGHLIGHTS CONTEXT:\n" + ctx.highlightsText + "\n\n") : "") +
    (ctx.itineraryText ? ("ITINERARY CONTEXT:\n" + ctx.itineraryText + "\n\n") : "") +
    (ctx.includesText ? ("INCLUDES CONTEXT:\n" + ctx.includesText + "\n\n") : "") +
    
    "SEO CONTEXT (use for keyword optimization):\n" +
    "SEO Title: " + (ctx.seoTitle || 'N/A') + "\n" +
    "SEO Meta Description: " + (ctx.seoMetaDescription || 'N/A') + "\n" +
    "SEO Keywords: " + (ctx.seoKeywords || 'N/A') + "\n\n" +

    "KEYWORDS (STRICT):\n" +
    "- Primary Keyword (verbatim): " + p + "\n" +
    (secondary.length ? ("- Secondary Keyword for this image (verbatim, optional): " + secondary[0] + "\n\n") : "\n") +
    (preferredTitleKeyword ? ("TITLE SEO HINT: If it fits naturally, include this exact phrase ONCE in the title: " + JSON.stringify(preferredTitleKeyword) + "\n\n") : "") +
    (forbiddenTitles.length ? ("TITLE UNIQUENESS (STRICT): Do NOT reuse any of these titles: " + JSON.stringify(forbiddenTitles) + "\n\n") : "") +
    
    "🎯 ENHANCEMENT RULES:\n" +
    "1. Title (max 60 chars):\n" +
    "   - Must be SHORT and strongly linked to the trip SEO title\n" +
    "   - Format: '<Short Trip Name> <Visible Subject>'\n" +
    "   - Clear and concise\n" +
    "   - Include location if relevant\n" +
    "   - Avoid generic filler like: 'Experience the magic', 'Immerse yourself', 'Unforgettable moment'\n" +
    "   - Avoid repeated words/phrases\n" +
    "   - Example: 'Al-Hakim Mosque - Cairo Islamic Heritage Tour'\n\n" +
    
    "2. Caption (max 150 chars):\n" +
    "   - Short, simple, and quick context\n" +
    "   - Natural language\n" +
    "   - Example: 'The Al-Hakim Mosque in Cairo, built in 1013 AD'\n\n" +
    
    "3. Description (max 300 chars):\n" +
    "   - Detailed and SEO-oriented\n" +
    "   - Useful for Gallery/Slider context\n" +
    "   - Include historical/cultural context\n" +
    "   - Example: 'The Al-Hakim Mosque in Cairo is a stunning example of Fatimid architecture built in 1013 AD. It features unique minarets and a large courtyard, making it a key site for Islamic heritage tours.'\n\n" +
    
    "4. Alt Text (max 125 chars):\n" +
    "   - Descriptive for accessibility, describing only what is visible\n" +
    "   - End with the Primary Keyword verbatim.\n" +
    "   - Do NOT add secondary keywords to alt.\n" +
    "   - Example: 'Guests stargazing by a campfire under the stars " + p + "'\n\n" +

    "SECONDARY KEYWORD RULE (STRICT):\n" +
    (secondary.length ? ("- Include EXACTLY ONE secondary keyword verbatim ONCE in caption OR description: " + secondary[0] + "\n\n") : "- No secondary keyword provided.\n\n") +

    "- Use current data as base, enhance with trip context\n" +
    "- Do NOT invent details not in context\n" +
    "- Include location keywords for SEO\n" +
    "- STRICT REQUIREMENT: The Alt Text MUST contain the Primary Keyword '" + p + "' EXACTLY (verbatim). Do NOT translate or modify it.\n" +
    "- Output in ENGLISH ONLY\n\n" +
    
    "OUTPUT FORMAT (JSON ONLY):\n" +
    "{\n" +
    "  \"title\": \"Enhanced title here\",\n" +
    "  \"caption\": \"Enhanced short caption here\",\n" +
    "  \"description\": \"Enhanced detailed description here\",\n" +
    "  \"alt\": \"Enhanced alt text here\"\n" +
    "}\n";
  
  return prompt;
}

async function fetchUrl(url, options) {
  const opts = options || {}
  const method = opts.method ? String(opts.method).toLowerCase() : 'get'
  const headers = opts.headers || {}
  const payload = Object.prototype.hasOwnProperty.call(opts, 'payload') ? opts.payload : undefined
  const contentType = opts.contentType
  const reqHeaders = { ...headers }
  if (contentType && !reqHeaders['Content-Type'] && !reqHeaders['content-type']) reqHeaders['Content-Type'] = contentType

  const resp = await http.raw.request({
    url: String(url),
    method,
    headers: reqHeaders,
    data: payload,
    responseType: 'arraybuffer',
    validateStatus: () => true
  })

  const status = resp.status
  const buf = Buffer.from(resp.data || [])
  const ct = resp.headers && (resp.headers['content-type'] || resp.headers['Content-Type']) ? String(resp.headers['content-type'] || resp.headers['Content-Type']) : ''
  let blobName = ''
  const blob = {
    getBytes() {
      return Array.from(buf)
    },
    getContentType() {
      return ct || 'application/octet-stream'
    },
    setName(name) {
      blobName = String(name || '')
      return blob
    },
    getName() {
      return blobName
    }
  }

  return {
    getResponseCode() {
      return status
    },
    getContentText() {
      return buf.toString('utf8')
    },
    getBlob() {
      return blob
    }
  }
}

var UPDATER_BATCH_SIZE = 1;
var UPDATER_TRIPS_TABLE = 'Trips';
var UPDATER_IMPROVEMENT_TABLE = 'Improvement With AI';
var UPDATER_ITINERARY_IMPROVEMENT_TABLE = 'Itinerary Improvement With AI';
var UPDATER_HIGHLIGHTS_IMPROVEMENT_TABLE = 'Highlights Improvement With AI';
var UPDATER_FAQS_IMPROVEMENT_TABLE = 'FAQs Improvement With AI';
var UPDATER_TRIP_INCLUDES_IMPROVEMENT_TABLE = 'TripIncludes Improvement With AI';
var UPDATER_TRIP_EXCLUDES_IMPROVEMENT_TABLE = 'TripExcludes Improvement With AI';
var UPDATER_TRIP_FACTS_IMPROVEMENT_TABLE = 'TripFacts Improvement With AI';
var UPDATER_ADDONS_IMPROVEMENT_TABLE = 'AddOns Improvement With AI';
var UPDATER_IMAGES_IMPROVEMENT_TABLE = 'Images Improvement With AI';
var UPDATER_TRIP_DETAILS_TABLE = 'TripDetails';
var UPDATER_RAW_IMAGES_TABLE = 'Images';

var UPDATER_PUBLISH_STATUS_FIELD = 'Publish_Status'; // Field in Trips table

// If true: always CREATE a new WordPress trip on publish (never update existing)
// UPDATER MODIFICATION: Set to false to allow updates
var UPDATER_ALWAYS_CREATE_NEW_TRIP = false;

var UPDATER_DEBUG_VERBOSE = false;

var UPDATER_WP_TRIP_INFO_CACHE = {};
var UPDATER_AIRTABLE_TABLE_CACHE = {};
var UPDATER_AIRTABLE_TABLE_CACHE_META = {};
var UPDATER_AIRTABLE_QUERY_CACHE = {};
var UPDATER_LINKED_LOOKUP_STATE = {};
var UPDATER_AIRTABLE_PAGE_SIZE = 25;
var UPDATER_AIRTABLE_PAGE_DELAY_MS = 700;
var UPDATER_AIRTABLE_QUERY_DELAY_MS = 350;
var UPDATER_WP_STAGE_DELAY_MS = 1200;
var UPDATER_WP_HEAVY_STAGE_DELAY_MS = 2200;
var UPDATER_SCHEMA_STAGE_DELAY_MS = 900;
var UPDATER_ENABLE_STAGE_THROTTLING = true;
var UPDATER_MEDIA_BETWEEN_ITEMS_DELAY_MS = 900;
var UPDATER_ENSURE_FILENAME_DELAY_MS = 1400;
var UPDATER_SKIP_FILENAME_ON_QUOTA = true;

function clearUpdaterCaches_Updater_() {
  UPDATER_WP_TRIP_INFO_CACHE = {};
  UPDATER_AIRTABLE_TABLE_CACHE = {};
  UPDATER_AIRTABLE_TABLE_CACHE_META = {};
  UPDATER_AIRTABLE_QUERY_CACHE = {};
  UPDATER_LINKED_LOOKUP_STATE = {};
  log('Updater: Cleared in-memory caches');
}

function logVerbose_Updater_(msg) {
  if (UPDATER_DEBUG_VERBOSE) log(msg);
}

function isQuotaLikeError_Updater_(err) {
  var msg = err && err.message ? String(err.message) : String(err || '');
  var lc = msg.toLowerCase();
  return lc.indexOf('bandwidth quota exceeded') !== -1 ||
         lc.indexOf('too many requests') !== -1 ||
         lc.indexOf('rate limit') !== -1 ||
         lc.indexOf('quota exceeded') !== -1;
}

async function sleep_Updater_(ms) {
  var n = Number(ms) || 0;
  if (n > 0) await sleep(n);
}

async function throttleStage_Updater_(label, ms) {
  if (!UPDATER_ENABLE_STAGE_THROTTLING) return;
  var waitMs = Math.max(0, Number(ms) || 0);
  if (!waitMs) return;
  log('Updater: Throttling before ' + label + ' for ' + waitMs + ' ms');
  await sleep_Updater_(waitMs);
}

async function runNonCriticalStage_Updater_(label, fn, delayMs) {
  await throttleStage_Updater_(label, delayMs || UPDATER_WP_STAGE_DELAY_MS);
  try {
    return await fn();
  } catch (e) {
    if (isQuotaLikeError_Updater_(e)) {
      log('Updater: Non-critical stage throttled/soft-failed [' + label + ']: ' + (e && e.message ? e.message : String(e)));
      return null;
    }
    throw e;
  }
}

async function runCriticalStage_Updater_(label, fn, delayMs) {
  await throttleStage_Updater_(label, delayMs || UPDATER_WP_STAGE_DELAY_MS);
  return fn();
}

async function throttleMediaItem_Updater_(label) {
  await throttleStage_Updater_(label, UPDATER_MEDIA_BETWEEN_ITEMS_DELAY_MS);
}

function shouldSkipEnsureFilenameForError_Updater_(err) {
  if (!err) return false;
  if (!UPDATER_SKIP_FILENAME_ON_QUOTA) return false;
  return isQuotaLikeError_Updater_(err);
}

function buildUpdaterCacheKey_(tableName, params) {
  return String(tableName || '') + '::' + JSON.stringify(params || {});
}

async function airtableGetCached_Updater_(tableName, params, opts) {
  opts = opts || {};
  var key = buildUpdaterCacheKey_(tableName, params);
  if (!opts.force && Object.prototype.hasOwnProperty.call(UPDATER_AIRTABLE_QUERY_CACHE, key)) {
    return UPDATER_AIRTABLE_QUERY_CACHE[key];
  }
  await sleep_Updater_(UPDATER_AIRTABLE_QUERY_DELAY_MS);
  var res = await airtableGet_(tableName, params || {});
  UPDATER_AIRTABLE_QUERY_CACHE[key] = res;
  return res;
}

function buildLookupStateKey_Updater_(tableName, linkFieldName, targetId, mode) {
  return [
    String(tableName || ''),
    String(linkFieldName || ''),
    String(targetId || ''),
    String(mode || 'multi')
  ].join('::');
}

function setLookupState_Updater_(tableName, linkFieldName, targetId, mode, state) {
  var key = buildLookupStateKey_Updater_(tableName, linkFieldName, targetId, mode);
  UPDATER_LINKED_LOOKUP_STATE[key] = state || {};
  return UPDATER_LINKED_LOOKUP_STATE[key];
}

function getLookupState_Updater_(tableName, linkFieldName, targetId, mode) {
  var key = buildLookupStateKey_Updater_(tableName, linkFieldName, targetId, mode);
  return UPDATER_LINKED_LOOKUP_STATE[key] || null;
}

function isLookupStateIncomplete_Updater_(state) {
  if (!state) return false;
  return !!(state.partial || state.formulaQuotaHit || state.cacheQuotaHit || state.pageCapHit);
}

function describeLookupState_Updater_(state) {
  if (!state) return 'no-state';
  return 'records=' + Number(state.recordsCount || 0) +
    ', formulaQuotaHit=' + (!!state.formulaQuotaHit) +
    ', cacheQuotaHit=' + (!!state.cacheQuotaHit) +
    ', pageCapHit=' + (!!state.pageCapHit) +
    ', usedFallback=' + (!!state.usedFallback);
}

function abortIfIncompleteLookup_Updater_(tripId, checks) {
  var bad = [];
  for (var i = 0; i < checks.length; i++) {
    var check = checks[i];
    var state = getLookupState_Updater_(check.tableName, check.linkFieldName, tripId, check.mode);
    if (!isLookupStateIncomplete_Updater_(state)) continue;
    bad.push(check.label + ' [' + describeLookupState_Updater_(state) + ']');
  }
  if (bad.length) {
    throw new Error('Updater: Incomplete Airtable dataset for Trip ' + tripId + ': ' + bad.join(' | '));
  }
}

async function getTripInfoFromWpCached_Updater_(wpId) {
  var key = String(wpId || '');
  if (!key) return null;
  if (UPDATER_WP_TRIP_INFO_CACHE.hasOwnProperty(key)) {
    log('REUSING CACHED WORDPRESS TRIP INFO');
    return UPDATER_WP_TRIP_INFO_CACHE[key];
  }
  var info = await getTripInfoFromWp_(key);
  UPDATER_WP_TRIP_INFO_CACHE[key] = info;
  return info;
}

function getRawImagesTableName_Updater_() {
  if (typeof UPDATER_RAW_IMAGES_TABLE === 'undefined' || !UPDATER_RAW_IMAGES_TABLE) {
    log('Updater: Missing table constant UPDATER_RAW_IMAGES_TABLE (images/raw images). Falling back to "Images".');
    return 'Images';
  }
  return UPDATER_RAW_IMAGES_TABLE;
}

async function airtableGetAllByFormula_Updater_(tableName, filterByFormula) {
  if (!filterByFormula) return [];
  var stateKey = String(tableName || '') + '::formula::' + String(filterByFormula || '');
  var all = [];
  var offset = null;
  var pages = 0;
  var meta = {
    quotaHit: false,
    pageCapHit: false,
    partial: false
  };
  do {
    var params = { pageSize: UPDATER_AIRTABLE_PAGE_SIZE, filterByFormula: filterByFormula };
    if (offset) params.offset = offset;
    var res = null;
    try {
      res = await airtableGetCached_Updater_(tableName, params);
    } catch (e) {
      if (isQuotaLikeError_Updater_(e)) {
        meta.quotaHit = true;
        meta.partial = true;
        UPDATER_AIRTABLE_QUERY_CACHE[stateKey + '::meta'] = meta;
        throw e;
      }
      throw e;
    }
    if (res && res.records && res.records.length) all = all.concat(res.records);
    offset = res ? res.offset : null;
    pages++;
    if (offset) await sleep_Updater_(UPDATER_AIRTABLE_PAGE_DELAY_MS);
    if (pages >= 20) {
      log('Updater: Pagination capped for table ' + tableName + ' after ' + pages + ' pages');
      meta.pageCapHit = true;
      meta.partial = true;
      break;
    }
  } while (offset);
  UPDATER_AIRTABLE_QUERY_CACHE[stateKey + '::meta'] = meta;
  return all;
}

async function findImageRecordsForTrip_Updater_(tripRecordId, tripNumberOrWpId) {
  var table = getRawImagesTableName_Updater_();
  var candidates = ['SourceTrip', 'Trip'];
  var missing = [];

  var needles = [];
  var n1 = String(tripNumberOrWpId || '').trim();
  var n2 = String(tripRecordId || '').trim();
  if (n1) needles.push(n1);
  if (n2 && needles.indexOf(n2) === -1) needles.push(n2);
  var lookupTarget = tripRecordId || tripNumberOrWpId;
  var lookupState = {
    recordsCount: 0,
    formulaQuotaHit: false,
    cacheQuotaHit: false,
    pageCapHit: false,
    partial: false,
    usedFallback: false
  };
  if (!needles.length) {
    setLookupState_Updater_(table, 'SourceTrip|Trip', lookupTarget, 'image_lookup', lookupState);
    return [];
  }

  for (var i = 0; i < candidates.length; i++) {
    var field = candidates[i];
    var parts = [];
    for (var j = 0; j < needles.length; j++) {
      var needle = String(needles[j]).replace(/'/g, "\\'");
      parts.push("FIND('" + needle + "', ARRAYJOIN({" + field + "}))");
    }
    var formula = parts.length === 1 ? parts[0] : ("OR(" + parts.join(',') + ")");
    try {
      var recs = await airtableGetAllByFormula_Updater_(table, formula);
      var formulaMeta = UPDATER_AIRTABLE_QUERY_CACHE[String(table || '') + '::formula::' + String(formula || '') + '::meta'] || {};
      log('IMAGES LOOKUP FIELD USED: ' + field);
      if (recs && recs.length) {
        lookupState.pageCapHit = !!formulaMeta.pageCapHit;
        lookupState.partial = !!formulaMeta.partial;
        lookupState.formulaQuotaHit = !!formulaMeta.quotaHit;
        lookupState.recordsCount = recs.length;
        setLookupState_Updater_(table, 'SourceTrip|Trip', lookupTarget, 'image_lookup', lookupState);
        return recs;
      }
    } catch (e) {
      var msg = e && e.message ? String(e.message) : String(e);
      if (msg.indexOf('INVALID_FILTER_BY_FORMULA') !== -1 && msg.toLowerCase().indexOf('unknown field') !== -1) {
        missing.push(field);
        continue;
      }
      if (isQuotaLikeError_Updater_(e)) {
        lookupState.formulaQuotaHit = true;
        lookupState.partial = true;
        log('Updater: Image lookup aborted for table ' + table + ' due to quota/rate-limit on field ' + field + ': ' + msg);
        break;
      }
      throw e;
    }
  }

  log('IMAGES LOOKUP FIELD NOT FOUND (checked: ' + candidates.join(', ') + ')');
  setLookupState_Updater_(table, 'SourceTrip|Trip', lookupTarget, 'image_lookup', lookupState);
  return [];
}

function getImageRoleFromCaption_Updater_(caption) {
  var c = String(caption || '').toLowerCase().trim();
  if (!c) return '';
  if (c.indexOf('imported from trip featuredimage') !== -1) return 'featured';
  if (c.indexOf('imported from trip gallery') !== -1) return 'gallery';
  return '';
}

function getTypeNameFromAirtable_Updater_(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.name) return String(value.name);
  return String(value);
}

function normalizeUrlForMatch_Updater_(url) {
  var u = String(url || '').trim();
  if (!u) return '';
  var q = u.indexOf('?');
  if (q !== -1) u = u.substring(0, q);
  return u.toLowerCase();
}

function buildGalleryAttachmentMatchers_Updater_(tripFields) {
  var f = tripFields || {};
  var g = (f.Gallery && Array.isArray(f.Gallery)) ? f.Gallery : [];
  var urls = {};
  var names = {};
  for (var i = 0; i < g.length; i++) {
    var att = g[i];
    if (!att) continue;
    if (att.url) urls[normalizeUrlForMatch_Updater_(att.url)] = true;
    if (att.filename) names[String(att.filename).toLowerCase()] = true;
    if (att.id) names[String(att.id).toLowerCase()] = true;
  }
  return { urls: urls, names: names, hasAny: g.length > 0 };
}

async function getAllAirtableRecordsCached_Updater_(tableName) {
  var t = String(tableName || '');
  if (!t) return [];
  if (UPDATER_AIRTABLE_TABLE_CACHE.hasOwnProperty(t)) return UPDATER_AIRTABLE_TABLE_CACHE[t];

  var all = [];
  var offset = null;
  var pages = 0;
  var meta = {
    quotaHit: false,
    pageCapHit: false,
    partial: false
  };
  do {
    var params = { pageSize: UPDATER_AIRTABLE_PAGE_SIZE };
    if (offset) params.offset = offset;
    var res = null;
    try {
      res = await airtableGetCached_Updater_(t, params);
    } catch (e) {
      if (isQuotaLikeError_Updater_(e)) {
        meta.quotaHit = true;
        meta.partial = true;
        log('Updater: Full-table cache aborted for ' + t + ' due to quota/rate-limit: ' + (e && e.message ? e.message : String(e)));
        break;
      }
      throw e;
    }
    if (res && res.records && res.records.length) {
      all = all.concat(res.records);
    }
    offset = res ? res.offset : null;
    pages++;
    if (offset) await sleep_Updater_(UPDATER_AIRTABLE_PAGE_DELAY_MS);
    if (pages >= 20) {
      log('Updater: Full-table cache capped for ' + t + ' after ' + pages + ' pages');
      meta.pageCapHit = true;
      meta.partial = true;
      break;
    }
  } while (offset);

  UPDATER_AIRTABLE_TABLE_CACHE[t] = all;
  UPDATER_AIRTABLE_TABLE_CACHE_META[t] = meta;
  return all;
}

function parseDateSafe_Updater_(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  var s = String(v || '').trim();
  if (!s) return null;
  var d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  return null;
}

var UPDATER_LANGUAGE_ALIAS_MAP_ = null;
var UPDATER_SUPPORTED_LANGUAGE_CODES_ = null;

function getSupportedLanguageAliasMap_Updater_() {
  if (UPDATER_LANGUAGE_ALIAS_MAP_) return UPDATER_LANGUAGE_ALIAS_MAP_;

  var map = {
    'english': 'en', 'en': 'en', 'eng': 'en',
    'french': 'fr', 'français': 'fr', 'francais': 'fr', 'fr': 'fr',
    'german': 'de', 'deutsch': 'de', 'de': 'de',
    'spanish': 'es', 'español': 'es', 'espanol': 'es', 'es': 'es',
    'turkish': 'tr', 'türkçe': 'tr', 'turkce': 'tr', 'tr': 'tr',
    'russian': 'ru', 'русский': 'ru', 'ru': 'ru',
    'romanian': 'ro', 'română': 'ro', 'romana': 'ro', 'ro': 'ro',
    'chinese': 'zh-hans', 'chinese (simplified)': 'zh-hans', 'simplified chinese': 'zh-hans', '简体中文': 'zh-hans', 'zh': 'zh-hans', 'zh-hans': 'zh-hans',
    'ukrainian': 'uk', 'українська': 'uk', 'uk': 'uk',
    'portuguese': 'pt-br', 'português': 'pt-br', 'portugues': 'pt-br', 'pt': 'pt-br',
    'brazilian portuguese': 'pt-br',
    'portuguese (brazil)': 'pt-br',
    'portuguese brazil': 'pt-br',
    'português (brasil)': 'pt-br',
    'portugues (brasil)': 'pt-br',
    'pt-br': 'pt-br',
    'pt_br': 'pt-br',
    'polish': 'pl', 'polski': 'pl', 'pl': 'pl',
    'dutch': 'nl', 'nederlands': 'nl', 'nl': 'nl',
    'korean': 'ko', '한국어': 'ko', 'ko': 'ko',
    'japanese': 'ja', '日本語': 'ja', 'ja': 'ja',
    'italian': 'it', 'italiano': 'it', 'it': 'it',
    'hungarian': 'hu', 'magyar': 'hu', 'hu': 'hu',
    'czech': 'cs', 'čeština': 'cs', 'cestina': 'cs', 'cs': 'cs'
  };

  UPDATER_LANGUAGE_ALIAS_MAP_ = map;
  UPDATER_SUPPORTED_LANGUAGE_CODES_ = {
    'en': true, 'es': true, 'de': true, 'fr': true,
    'cs': true, 'hu': true, 'it': true, 'ja': true, 'ko': true, 'nl': true, 'pl': true,
    'pt-br': true, 'ro': true, 'ru': true, 'tr': true, 'uk': true, 'zh-hans': true
  };
  return UPDATER_LANGUAGE_ALIAS_MAP_;
}

function resolveLanguageCode_Updater_(input) {
  if (input === null || input === undefined) return null;
  var raw = String(input).trim();
  if (!raw) return null;

  var lowered = raw.toLowerCase();
  var supported = UPDATER_SUPPORTED_LANGUAGE_CODES_ || getSupportedLanguageAliasMap_Updater_() && UPDATER_SUPPORTED_LANGUAGE_CODES_;
  if (supported && supported[lowered]) return lowered;

  if (/^[a-z]{2}$/i.test(raw)) {
    var two = raw.toLowerCase();
    if (supported && supported[two]) return two;
  }

  if (/^[a-z]{2,3}(-[a-z0-9]+)+$/i.test(raw)) {
    var hy = raw.toLowerCase();
    if (supported && supported[hy]) return hy;
  }

  var map = getSupportedLanguageAliasMap_Updater_();
  var key = lowered;
  if (map[key]) return map[key];

  var cap = lowered ? (lowered.charAt(0).toUpperCase() + lowered.slice(1)) : lowered;
  if (map[cap.toLowerCase()]) return map[cap.toLowerCase()];

  return null;
}

function resolveWpLocale_Updater_(langCode) {
  var c = String(langCode || '').toLowerCase();
  if (!c) return '';
  var map = {
    'en': 'en_US',
    'de': 'de_DE',
    'fr': 'fr_FR',
    'es': 'es_ES',
    'tr': 'tr_TR',
    'ru': 'ru_RU',
    'ro': 'ro_RO',
    'pl': 'pl_PL',
    'pt-br': 'pt_BR',
    'nl': 'nl_NL',
    'it': 'it_IT',
    'cs': 'cs_CZ',
    'hu': 'hu_HU',
    'ja': 'ja',
    'ko': 'ko_KR',
    'uk': 'uk',
    'zh-hans': 'zh_CN'
  };
  return map[c] || '';
}

function isPreservationWorkflowActive_Updater_(status) {
  var s = String(status || '').trim().toLowerCase();
  return s === 'pending' || s === 'processing';
}

async function syncImagesToExistingTranslations_Updater_(tripId, primaryWpId, tripFields, languages, existingTranslations, sourceTripInfoFromWp) {
  var f = tripFields || {};
  if (!languages || languages.length <= 1) return;
  if (!sourceTripInfoFromWp) return;

  var imageTranslationMap = parseImageTranslationMap_Updater_(f.Image_Translation_Map);
  var ids = collectSourceTripImageIds_Updater_(sourceTripInfoFromWp);
  if (!ids) return;
  await ensureEnglishImageIdsInTranslationMap_Updater_(tripId, imageTranslationMap, ids.allIds);

  for (var i = 0; i < languages.length; i++) {
    var langCode = languages[i];
    if (!langCode || langCode === 'en') continue;
    var transId = existingTranslations && existingTranslations[langCode] ? String(existingTranslations[langCode]) : '';
    if (!transId) continue;

    try {
      var transTripInfo = null;
      try { transTripInfo = await getTripInfoFromWpCached_Updater_(transId); } catch (eT) {}
      var focusStr = '';
      if (transTripInfo && transTripInfo.meta && transTripInfo.meta.rank_math_focus_keyword) {
        focusStr = transTripInfo.meta.rank_math_focus_keyword;
      }
      var parsed = parseFocusKeywordsString_Updater_(focusStr);

      var attachmentIdMap = {};
      var featuredEntry = null;
      var featuredTranslated = null;
      if (ids.featuredId) {
        var fRes = await ensureTranslatedAttachmentWithStatus_Updater_(tripId, imageTranslationMap, ids.featuredId, langCode, 'featured');
        if (fRes && fRes.id) {
          featuredEntry = { src: String(ids.featuredId), id: String(fRes.id), status: fRes.status };
          featuredTranslated = String(fRes.id);
          attachmentIdMap[String(ids.featuredId)] = String(fRes.id);
        }
      }

      var galleryTranslatedIds = [];
      var galleryEntries = [];
      if (ids.galleryIds && ids.galleryIds.length) {
        for (var gi = 0; gi < ids.galleryIds.length; gi++) {
          var srcId = ids.galleryIds[gi];
          var gRes = await ensureTranslatedAttachmentWithStatus_Updater_(tripId, imageTranslationMap, srcId, langCode, 'gallery');
          if (gRes && gRes.id) {
            if (gRes.status === 'cache') log('GALLERY IMAGE CACHE HIT (' + langCode + '): ' + srcId + ' -> ' + gRes.id);
            else log('GALLERY IMAGE CACHE MISS (' + langCode + '): ' + srcId + ' -> ' + gRes.id);
            attachmentIdMap[String(srcId)] = String(gRes.id);
            galleryTranslatedIds.push(String(gRes.id));
            galleryEntries.push({ src: String(srcId), id: String(gRes.id), status: gRes.status });
            log('GALLERY IMAGE ADDED TO TRANSLATED PAYLOAD (' + langCode + '): ' + gRes.id);
          }
        }
      }

      log(formatImageMapSummary_Updater_(langCode, featuredEntry, galleryEntries));
      var imgPayload = buildTripImagesMetaPayloadFromAttachmentIds_Updater_(featuredTranslated, galleryTranslatedIds);
      await pushToWordPress_Updater_(transId, imgPayload);
      log(formatTranslatedImageSetSummary_Updater_(langCode, transId, featuredTranslated, galleryTranslatedIds.length));

      await localizeTripImagesMetadataForLang_Updater_(sourceTripInfoFromWp, langCode, {
        seoData: parsed,
        focusKeywordsString: focusStr,
        tripTitle: transTripInfo && transTripInfo.core && transTripInfo.core.title ? transTripInfo.core.title : '',
        tripInfo: transTripInfo,
        tripFields: tripFields,
        attachmentIdMap: attachmentIdMap
      });
    } catch (eImg) {
      log('Updater: Failed to sync translated images for ' + langCode + ': ' + eImg.message);
      throw eImg
    }
  }
}
async function runUpdaterBatch() {
  var locked = false;
  try {
    locked = await lock.tryLock(20000);
  } catch (e) {
    locked = true;
  }
  if (!locked) {
    log('runUpdaterBatch: lock busy, skipping');
    return;
  }

  try {
  clearUpdaterCaches_Updater_();
  log('Updater: Starting batch...');
  if (!UPDATER_DEBUG_VERBOSE) log('VERBOSE LOGGING DISABLED');
  log('SUPPORTED LANGUAGES MAP UPDATED');
  
  // 1. Find trips ready to publish
  // Criteria: AI_Status = 'Done' AND Publish_Status = 'Pending' (or 'Ready')
  // Adjust criteria as needed.
  var formula = "{" + UPDATER_PUBLISH_STATUS_FIELD + "}='Pending'";
  
  // Assuming airtableGet_ is a shared helper in another file (e.g. airtable.gs)
  var trips = await airtableGet_(UPDATER_TRIPS_TABLE, {
    filterByFormula: formula,
    maxRecords: UPDATER_BATCH_SIZE
  });
  
  if (!trips || !trips.records || !trips.records.length) {
    log('Updater: No trips found ready to publish.');
    return;
  }
  
  for (var tripIndex = 0; tripIndex < trips.records.length; tripIndex++) {
    var tripRec = trips.records[tripIndex];
    var tripId = tripRec.id;
    var f = tripRec.fields;
    var tripIDValue = f.TripID; // Could be WordPress ID or Migration ID (99xxxxx)
    
    try {
      if (isPreservationWorkflowActive_Updater_(f.Preservation_Workflow_Status)) {
        log('Updater: Skipping Trip ' + tripId + ' due to active preservation workflow: ' + f.Preservation_Workflow_Status);
        continue;
      }
      // Determine if this is a migrated trip (TripID starts with 99) or WordPress trip
      var isMigratedTrip = tripIDValue && String(tripIDValue).indexOf('99') === 0;
      var wpId = (UPDATER_ALWAYS_CREATE_NEW_TRIP || isMigratedTrip) ? null : tripIDValue; // force create when enabled
      
      log('Updater: Processing Trip ' + tripId + ' (TripID: ' + (tripIDValue || 'NONE') + ', Type: ' + (isMigratedTrip ? 'MIGRATED' : 'WORDPRESS') + ')');
      await updatePublishStatus_Updater_(tripId, 'Processing');
      
      var langField = f.Languages || ['English'];
      var languages = [];
      if (Array.isArray(langField)) {
        languages = langField;
      } else if (typeof langField === 'string') {
        languages = [langField];
      } else {
        languages = ['English'];
      }
      
      languages = languages.map(function(l) {
        var raw = String(l).trim();
        var resolved = resolveLanguageCode_Updater_(raw);
        if (!resolved) {
          log('UNKNOWN LANGUAGE IN AIRTABLE: ' + raw);
          return null;
        }
        log('LANGUAGE RESOLVED: ' + raw + ' -> ' + resolved);
        return resolved;
      }).filter(function(x) { return !!x; });
      
      // Remove duplicates
      languages = languages.filter(function(item, pos) {
        return languages.indexOf(item) == pos;
      });

      // Ensure English is always the primary language
      if (languages.indexOf('en') === -1) {
        languages.unshift('en');
      } else {
        // If present, move 'en' to start to ensure it is treated as primary
        languages.sort(function(a, b) {
            return (a === 'en') ? -1 : (b === 'en') ? 1 : 0;
        });
      }
      
      var primaryLang = languages[0];
      log('TRANSLATION LANGUAGES LIST: ' + JSON.stringify(languages));

      var wantsContent = true;
      var wantsImages = true;
      var wantsPackages = true;
      var wantsTranslations = true;

      var enhancedData = null;
      var payload = null;
      var seoValidationByLanguage = {};
      var translationUrlMap = parseTranslationUrlMap_Updater_(f.Translation_URL_Map)

      // 4. Push Primary to WordPress (create or update)
      var primaryWpId = null;
      var primaryTripInfoFromWp = null;
      try {
        if (wpId) primaryTripInfoFromWp = await getTripInfoFromWpCached_Updater_(wpId)
      } catch (eWpInfoPrimary) {}

      enhancedData = await fetchCompleteTripData_Updater_(tripId, f, { skipClassification: false, wpTripInfo: primaryTripInfoFromWp });
      payload = mapAirtableToWordPress_Updater_(enhancedData, f, primaryLang);
      payload.lang = primaryLang;
      payload.language = { code: primaryLang };

      if (destinationService) {
        await destinationService.applyDestinationsToPayload(payload, { lang: primaryLang, wpTripInfo: primaryTripInfoFromWp, tripFields: f, tripDetails: enhancedData.tripDetails || null })
        if (payload.destinations) log('Updater: Payload.destinations set to: ' + JSON.stringify(payload.destinations))
      }

      if (primaryTripInfoFromWp && primaryTripInfoFromWp.core && primaryTripInfoFromWp.core.slug) {
        var existingSlug = String(primaryTripInfoFromWp.core.slug).trim();
        if (existingSlug) {
          payload.core = payload.core || {};
          payload.core.slug = existingSlug;
          log('Updater: PRESERVING existing slug for primary trip: ' + existingSlug);
        }
      }

      payload = upd_applyFinalSeoSafetyBelt_Updater_(payload, enhancedData, f);

      if (!wpId) {
        log('Updater: Creating NEW trip on WordPress for Airtable Trip ' + tripId);
        payload.meta = payload.meta || {};
        var existingTripCode = payload.meta.trip_code ? String(payload.meta.trip_code).trim() : '';
        var airtableTripCode = '';
        if (f) {
          airtableTripCode = f.TripID || f['TripID'] || '';
          if (!airtableTripCode || /^99\d+/.test(String(airtableTripCode))) {
            airtableTripCode = f.TripCode || f['Trip Code'] || f.Trip_Code || f['Trip_Code'] || '';
          }
        }
        if (Array.isArray(airtableTripCode)) airtableTripCode = airtableTripCode.length ? airtableTripCode[0] : '';
        airtableTripCode = normalizeTripCode_Updater_(String(airtableTripCode || '').trim());
        if (!existingTripCode && !airtableTripCode) {
          var newTripCode = 'TRIP-' + getUuid().slice(0, 8).toUpperCase();
          payload.meta.trip_code = newTripCode;
          log('Updater: No TripCode found in Airtable. Generated new trip_code: ' + newTripCode);
        } else {
          log('Updater: Preserving TripCode for new trip. payload.meta.trip_code=' + (existingTripCode ? existingTripCode : '(empty)') + ', airtable=' + (airtableTripCode ? airtableTripCode : '(empty)'));
        }
        payload.core = payload.core || {};
        payload.core.status = 'publish';

        var newWpId = await createNewTripOnWordPress_Updater_(payload);
        await airtableUpdate_('Trips', tripId, { TripID: newWpId });
        log('Updater: Created new trip with WP ID: ' + newWpId + ' (replaced TripID: ' + tripIDValue + ')');

        primaryWpId = newWpId;
        wpId = newWpId;
      } else {
        log('Updater: Updating existing WordPress trip ' + wpId);
        await pushToWordPress_Updater_(wpId, payload);
        primaryWpId = wpId;
      }
      
      // 5. Publish Packages & Images (Primary)
      if (wantsPackages) {
        await runCriticalStage_Updater_('publish packages', async function() {
          await publishPackagesSafe_Updater_(tripId, primaryWpId);
        }, UPDATER_WP_HEAVY_STAGE_DELAY_MS);
      }
      if (wantsImages) {
        await runCriticalStage_Updater_('publish images', async function() {
          await publishImagesSafe_Updater_(tripId, primaryWpId, f);
        }, UPDATER_WP_HEAVY_STAGE_DELAY_MS);
      }

      try {
        var primaryTripInfoForSchema = await getTripInfoFromWpCached_Updater_(primaryWpId);
        var primarySchema = generateTripSchema_Updater_(primaryTripInfoForSchema, primaryLang, { airtableTripId: tripId })
        var primaryFaqSchema = null;
        try {
          primaryFaqSchema = generateFaqSchema_Updater_(enhancedData, primaryTripInfoForSchema, primaryLang);
        } catch (eFaqPrimary) {
          log('Updater: Warning - Failed to generate FAQ schema for primary: ' + eFaqPrimary.message);
        }
        var primaryMetaSchema = { schema_trip_data: JSON.stringify(primarySchema), trip_schema_data: JSON.stringify(primarySchema) };
        if (primaryFaqSchema) primaryMetaSchema.faq_schema_data = JSON.stringify(primaryFaqSchema);
        await pushToWordPress_Updater_(primaryWpId, { meta: primaryMetaSchema });
        log('TRIP SCHEMA GENERATED (' + primaryLang + ')');
      } catch (eSchemaPrimary) {
        log('Updater: Failed to generate schema for primary: ' + eSchemaPrimary.message);
        throw eSchemaPrimary;
      }

      try {
        var validationTripInfo = null
        try { validationTripInfo = await getTripInfoFromWpCached_Updater_(primaryWpId) } catch (eValInfo) {}
        var vRes = computeSeoValidationOutputs_Updater_(enhancedData, f, payload, validationTripInfo)
        await storeSeoValidationOutputs_Updater_(tripId, vRes)
        seoValidationByLanguage[primaryLang] = formatSeoValidationForLanguageMap_Updater_(vRes)
        await storeSeoValidationByLanguageMap_Updater_(tripId, seoValidationByLanguage)
      } catch (eVal) {
        log('Updater: Failed to compute/store SEO validation: ' + (eVal && eVal.message ? eVal.message : String(eVal)))
        throw eVal
      }

      try {
        var infoForUrl = null
        try { infoForUrl = await getTripInfoFromWpCached_Updater_(primaryWpId) } catch (eUrlPrimary) {}
        if (infoForUrl && infoForUrl.meta && infoForUrl.meta.translation_url_map) {
          translationUrlMap = mergeTranslationUrlMap_Updater_(translationUrlMap, parseTranslationUrlMap_Updater_(infoForUrl.meta.translation_url_map))
        }
        var pUrl = infoForUrl && infoForUrl.core ? (infoForUrl.core.permalink || infoForUrl.core.link || '') : ''
        translationUrlMap = upsertTranslationUrlMapEntry_Updater_(translationUrlMap, primaryLang, primaryWpId, pUrl)
        await storeTranslationUrlMap_Updater_(tripId, translationUrlMap)
        await pushTranslationUrlMapMetaToWordPress_Updater_(primaryWpId, translationUrlMap)
      } catch (eUrlStorePrimary) {
        log('Updater: Failed to store translation_url_map for primary: ' + (eUrlStorePrimary && eUrlStorePrimary.message ? eUrlStorePrimary.message : String(eUrlStorePrimary)))
        throw eUrlStorePrimary
      }
      
      // ----------------------------------------------------------
      // 🆕 MULTILINGUAL LOOP
      // Process other languages if any
      // ----------------------------------------------------------
      if (languages.length > 1) {
        log('Updater: Found additional languages: ' + languages.slice(1).join(', '));
        
        var translationErrors = [];
        var translationSkipped = [];
        var existingTranslations = {};
        var sourceTripInfoFromWp = null;
        
        try {
          if (f.Translation_Map) {
            var mapRaw = f.Translation_Map;
            if (Array.isArray(mapRaw)) mapRaw = mapRaw[0];
            if (typeof mapRaw === 'string') {
              var parsed = JSON.parse(mapRaw);
              if (parsed && typeof parsed === 'object') {
                for (var mk in parsed) {
                  existingTranslations[mk] = String(parsed[mk]);
                }
              }
            }
          }
        } catch (eParseMap) {}

        try {
          sourceTripInfoFromWp = await getTripInfoFromWpCached_Updater_(primaryWpId);
          if (sourceTripInfoFromWp && sourceTripInfoFromWp.language && sourceTripInfoFromWp.language.translations) {
             // Convert all IDs to strings to ensure consistent matching
             var rawTrans = sourceTripInfoFromWp.language.translations;
             for (var k in rawTrans) {
                 existingTranslations[k] = String(rawTrans[k]);
             }
             log('Updater: Found existing translations map: ' + JSON.stringify(existingTranslations));
          }
        } catch (eInfo) {
          log('Updater: Could not fetch existing translations info (First run?): ' + eInfo.message);
        }

        var imageTranslationMap = parseImageTranslationMap_Updater_(f.Image_Translation_Map);

        var requestedNonEn = languages.slice(1);
        var missingLanguages = requestedNonEn.filter(function(l) { return !existingTranslations[l]; });
        if (missingLanguages.length > 0) {
          log('NEW LANGUAGE DETECTED: ' + missingLanguages.join(', '));
        }

        // Store new translation IDs to link them later
        var newTranslationIds = {};

        var languagesToProcess = [];
        if (requestedNonEn.length > 0) languagesToProcess = requestedNonEn;
        var languagesToUpdate = languagesToProcess.filter(function(l) { return !!existingTranslations[l]; });
        var languagesToCreate = languagesToProcess.filter(function(l) { return !existingTranslations[l]; });
        log('Updater: languagesToUpdate=' + JSON.stringify(languagesToUpdate) + ' languagesToCreate=' + JSON.stringify(languagesToCreate));

        if (wantsTranslations) {
        if (!enhancedData) {
          enhancedData = await fetchCompleteTripData_Updater_(tripId, f, { skipClassification: false });
        }
        var specConstraints = extractSpecificityConstraintsFromEnglish_Updater_(enhancedData, f, sourceTripInfoFromWp);
        for (var i = 0; i < languagesToProcess.length; i++) {
          var targetLang = languagesToProcess[i];
          log('Updater: Processing translation for language: ' + targetLang);
          
          try {
            var providedForLang = await getMandatorySeoKeywordsForLang_Updater_(f, enhancedData, targetLang);
            if (providedForLang && providedForLang.primary) {
              log('MANDATORY SEO KEYWORDS (' + targetLang + '): ' + providedForLang.primary);
            }

            // Translate Content
            var translatedData = await translateTripData_Updater_(enhancedData, targetLang, providedForLang, specConstraints);

            var skipLang = false;
            var skipReason = '';

            var missingRequired = validateRequiredFieldsCompleteness_Updater_(enhancedData, translatedData);
            if (missingRequired && missingRequired.length) {
              var fixedCore = false;
              for (var cTry = 0; cTry < 2; cTry++) {
                if (await regenerateCoreFields_Updater_(enhancedData, translatedData, targetLang, providedForLang, specConstraints)) {
                  missingRequired = validateRequiredFieldsCompleteness_Updater_(enhancedData, translatedData);
                  if (!missingRequired.length) { fixedCore = true; break; }
                }
              }
              if (!fixedCore && missingRequired.length) {
                fillMissingRequiredFromEnglish_Updater_(enhancedData, translatedData);
                missingRequired = validateRequiredFieldsCompleteness_Updater_(enhancedData, translatedData);
                if (missingRequired && missingRequired.length) {
                  skipLang = true;
                  skipReason = 'required_fields_missing: ' + missingRequired.join(', ');
                } else {
                  log('Updater: Required fields filled from English fallback (' + targetLang + ')');
                }
              }
            }

            var parityFails = validateParityCounts_Updater_(enhancedData, translatedData);
            if (parityFails && parityFails.length) {
              log('Updater: Parity count mismatch detected (' + targetLang + '): ' + JSON.stringify(parityFails));
            }

            var sectionsToValidate = ['highlights', 'includes', 'excludes', 'faqs', 'itinerary'];
            var sectionsNeedingFix = {};
            if (!skipLang) {
              sectionsToValidate.forEach(function (secName) {
                if (hasEmptySectionItems_Updater_(enhancedData, translatedData, secName)) sectionsNeedingFix[secName] = 'empty_items';
                if (!sectionsNeedingFix[secName] && isSectionSuspiciousNotLocalized_Updater_(enhancedData, translatedData, secName)) {
                  sectionsNeedingFix[secName] = 'not_localized';
                }
              });
            }

            if (!skipLang) {
              for (var secName in sectionsNeedingFix) {
                if (!Object.prototype.hasOwnProperty.call(sectionsNeedingFix, secName)) continue;
                var ok = false;
                for (var rTry = 0; rTry < 1; rTry++) {
                  if (!await regenerateTripSection_Updater_(enhancedData, translatedData, targetLang, secName, specConstraints)) continue;
                  if (hasEmptySectionItems_Updater_(enhancedData, translatedData, secName)) continue;
                  if (sectionsNeedingFix[secName] === 'not_localized') {
                    if (isSectionSuspiciousNotLocalized_Updater_(enhancedData, translatedData, secName)) continue;
                  }
                  ok = true;
                  break;
                }
                if (!ok) {
                  if (sectionsNeedingFix[secName] === 'not_localized') {
                    skipLang = true;
                    skipReason = 'section_not_localized_' + secName;
                    break;
                  }
                  fillEmptySectionItemsFromEnglish_Updater_(enhancedData, translatedData, secName);
                  if (hasEmptySectionItems_Updater_(enhancedData, translatedData, secName)) {
                    skipLang = true;
                    skipReason = 'parity_failed_in_' + secName;
                    break;
                  } else {
                    log('Updater: Section filled from English fallback (' + targetLang + '): ' + secName);
                  }
                }
              }
            }

            var parityFailsAfter = validateParityCounts_Updater_(enhancedData, translatedData);
            if (!skipLang && parityFailsAfter && parityFailsAfter.length) {
              skipLang = true;
              skipReason = 'parity_count_failed: ' + JSON.stringify(parityFailsAfter);
            }

            if (skipLang) {
              log('Updater: SKIPPING LANGUAGE ' + targetLang + ' (pre-publish): ' + skipReason);
              translationSkipped.push({ lang: targetLang, message: skipReason });
              continue;
            }
            
            // Map to Payload
            var translatedPayload = mapAirtableToWordPress_Updater_(translatedData, f, targetLang);
            translatedPayload.lang = targetLang;
            // Ensure 'language' object is set for translation
            var wpLocale = resolveWpLocale_Updater_(targetLang);
            translatedPayload.language = wpLocale ? { code: targetLang, locale: wpLocale } : { code: targetLang };

            try {
              if (destinationService) {
                var transTripInfo = null
                if (existingTranslations[targetLang]) {
                  try { transTripInfo = await getTripInfoFromWpCached_Updater_(existingTranslations[targetLang]); } catch (eT2) {}
                }
                await destinationService.applyDestinationsToPayload(translatedPayload, { lang: targetLang, wpTripInfo: transTripInfo, tripFields: f, tripDetails: translatedData.tripDetails || enhancedData.tripDetails || null })
                if (translatedPayload.destinations) log('Updater: Translated payload.destinations (' + targetLang + ') set to: ' + JSON.stringify(translatedPayload.destinations))
              }
            } catch (eDestTrans) {
              log('Updater: Warning - failed to map destinations for ' + targetLang + ': ' + (eDestTrans && eDestTrans.message ? eDestTrans.message : String(eDestTrans)))
            }
            var imageSeoDataForLang = null;
            var imageFocusKeywordsStringForLang = '';
            var imageTripTitleForLang = (translatedPayload.core && translatedPayload.core.title) ? String(translatedPayload.core.title) : '';

            var attachmentIdMap = {};
            var featuredEntry = null;
            var featuredTranslated = null;
            var galleryTranslatedIds = [];
            var galleryEntries = [];
            if (wantsImages) {
              try {
                var idsPre = collectSourceTripImageIds_Updater_(sourceTripInfoFromWp);
                if (idsPre && idsPre.featuredId) {
                  var fResPre = await ensureTranslatedAttachmentWithStatus_Updater_(tripId, imageTranslationMap, idsPre.featuredId, targetLang, 'featured');
                  if (fResPre && fResPre.id) {
                    featuredEntry = { src: String(idsPre.featuredId), id: String(fResPre.id), status: fResPre.status };
                    featuredTranslated = String(fResPre.id);
                    attachmentIdMap[String(idsPre.featuredId)] = String(fResPre.id);
                  }
                }
                if (idsPre && idsPre.galleryIds && idsPre.galleryIds.length) {
                  for (var preGi = 0; preGi < idsPre.galleryIds.length; preGi++) {
                    var srcId = idsPre.galleryIds[preGi];
                    var gResPre = await ensureTranslatedAttachmentWithStatus_Updater_(tripId, imageTranslationMap, srcId, targetLang, 'gallery');
                    if (gResPre && gResPre.id) {
                      attachmentIdMap[String(srcId)] = String(gResPre.id);
                      galleryTranslatedIds.push(String(gResPre.id));
                      galleryEntries.push({ src: String(srcId), id: String(gResPre.id), status: gResPre.status });
                    }
                  }
                }
                log(formatImageMapSummary_Updater_(targetLang, featuredEntry, galleryEntries));
                var imgPayloadPre = buildTripImagesMetaPayloadFromAttachmentIds_Updater_(featuredTranslated, galleryTranslatedIds);
                if (imgPayloadPre && imgPayloadPre.meta) {
                  translatedPayload.meta = translatedPayload.meta || {};
                  if (imgPayloadPre.meta._thumbnail_id) translatedPayload.meta._thumbnail_id = imgPayloadPre.meta._thumbnail_id;
                  if (imgPayloadPre.meta.wpte_gallery_id) translatedPayload.meta.wpte_gallery_id = imgPayloadPre.meta.wpte_gallery_id;
                }
              } catch (eImgPre) {
                log('Updater: Warning - Failed to prepare translated image IDs for payload (' + targetLang + '): ' + eImgPre.message);
              }
            }
            mergeTranslationMetaFromSourceTrip_Updater_(translatedPayload, sourceTripInfoFromWp);
            
            // Link to Primary - IMPORTANT: We just send the parent ID here
            // The full linking happens in the FINAL step to avoid race conditions
            translatedPayload.translation_of = primaryWpId;

            var slugLocked = false;
            var updateOnly = false;
            var generatedSlugForCreate = (translatedPayload && translatedPayload.core && translatedPayload.core.slug) ? String(translatedPayload.core.slug).trim() : '';
            var existingTransId = existingTranslations[targetLang] ? String(existingTranslations[targetLang]) : '';
            var existingTransWpInfo = null;
            try {
              if (existingTransId) existingTransWpInfo = await getTripInfoFromWpCached_Updater_(existingTransId);
            } catch (eSlugCheck) {
              if (existingTransId && isWpNotFoundError_Updater_(eSlugCheck)) {
                existingTransWpInfo = null;
              } else if (existingTransId) {
                existingTransWpInfo = { _unverified: true };
              }
            }
            if (existingTransId && existingTransWpInfo) {
              if (existingTransWpInfo.core && existingTransWpInfo.core.slug) {
                var existingTransSlug = String(existingTransWpInfo.core.slug).trim();
                if (existingTransSlug) {
                  translatedPayload.core = translatedPayload.core || {};
                  translatedPayload.core.slug = existingTransSlug;
                  log('Updater: PRESERVING existing slug for ' + targetLang + ' translation: ' + existingTransSlug);
                }
              }
              updateOnly = true;
              slugLocked = true;
              log('TRANSLATION EXISTS - UPDATE ONLY - SLUG LOCKED (' + targetLang + ')');
              log('EXISTING PERMALINK PRESERVED (' + targetLang + ')');
            } else if (existingTransId && !existingTransWpInfo) {
              log('TRANSLATION NOT FOUND - CREATE WITH GENERATED SLUG (' + targetLang + ')');
            }

            imageSeoDataForLang = { primary: providedForLang ? (providedForLang.primary || '') : '', secondary: providedForLang ? (providedForLang.secondary || []) : [] };

            var assets = await generateLocalizedSEOAssets_Updater_(translatedData, targetLang, providedForLang, specConstraints, { strict: false });
            if (assets) log('SEO ASSETS GENERATED (' + targetLang + ')');

            var seoRes = await enforceSeoKeywordsOnPayload_Updater_(translatedPayload, translatedData, targetLang, providedForLang, { slugLocked: slugLocked, assets: assets, spec: specConstraints, seoOpts: { strict: false } });
            translatedPayload = seoRes.payload;
            assets = seoRes.assets;
            if (translatedPayload.meta && translatedPayload.meta.rank_math_focus_keyword) {
              imageFocusKeywordsStringForLang = String(translatedPayload.meta.rank_math_focus_keyword);
            }

            var kwCheck = validateKeywordEnforcement_Updater_(translatedPayload, targetLang, providedForLang, assets);
            if (!kwCheck.ok) {
              for (var sTry = 0; sTry < 1 && !kwCheck.ok; sTry++) {
                assets = await generateLocalizedSEOAssets_Updater_(translatedData, targetLang, providedForLang, specConstraints, { strict: false });
                var seoRes2 = await enforceSeoKeywordsOnPayload_Updater_(translatedPayload, translatedData, targetLang, providedForLang, { slugLocked: slugLocked, assets: assets, spec: specConstraints, seoOpts: { strict: false } });
                translatedPayload = seoRes2.payload;
                assets = seoRes2.assets;
                kwCheck = validateKeywordEnforcement_Updater_(translatedPayload, targetLang, providedForLang, assets);
              }
            }
            if (!kwCheck.ok) {
              translatedPayload = forcePrimaryKeywordFallbackOnSeo_Updater_(translatedPayload, providedForLang ? providedForLang.primary : '', payload, slugLocked);
              kwCheck = validateKeywordEnforcement_Updater_(translatedPayload, targetLang, providedForLang, assets);
            }
            if (!kwCheck.ok) {
              var reasonKw = 'keyword_validation_failed: ' + kwCheck.reasons.join(', ');
              log('Updater: SKIPPING LANGUAGE ' + targetLang + ' (SEO/keywords): ' + reasonKw);
              translationSkipped.push({ lang: targetLang, message: reasonKw });
              continue;
            }

            var specCheck = validateSeoSpecificity_Updater_(specConstraints, translatedPayload, targetLang, providedForLang, slugLocked);
            if (!specCheck.ok) {
              log('Updater: SEO SPECIFICITY FAILED (' + targetLang + '): ' + specCheck.reasons.join(', '));

              assets = await generateLocalizedSEOAssets_Updater_(translatedData, targetLang, providedForLang, specConstraints, { strict: true });
              seoRes = await enforceSeoKeywordsOnPayload_Updater_(translatedPayload, translatedData, targetLang, providedForLang, { slugLocked: slugLocked, assets: assets, spec: specConstraints, seoOpts: { strict: true } });
              translatedPayload = seoRes.payload;
              assets = seoRes.assets;

              kwCheck = validateKeywordEnforcement_Updater_(translatedPayload, targetLang, providedForLang, assets);
              if (!kwCheck.ok) {
                translatedPayload = forcePrimaryKeywordFallbackOnSeo_Updater_(translatedPayload, providedForLang ? providedForLang.primary : '', payload, slugLocked);
                kwCheck = validateKeywordEnforcement_Updater_(translatedPayload, targetLang, providedForLang, assets);
              }
              if (!kwCheck.ok) {
                var reasonKw2 = 'keyword_validation_failed: ' + kwCheck.reasons.join(', ');
                log('Updater: SKIPPING LANGUAGE ' + targetLang + ' (SEO/keywords): ' + reasonKw2);
                translationSkipped.push({ lang: targetLang, message: reasonKw2 });
                continue;
              }

              specCheck = validateSeoSpecificity_Updater_(specConstraints, translatedPayload, targetLang, providedForLang, slugLocked);
              if (!specCheck.ok) {
                translatedPayload = applySpecificityFallbackSeo_Updater_(translatedPayload, providedForLang, specConstraints, slugLocked);
                translatedPayload = forcePrimaryKeywordFallbackOnSeo_Updater_(translatedPayload, providedForLang ? providedForLang.primary : '', payload, slugLocked);
                kwCheck = validateKeywordEnforcement_Updater_(translatedPayload, targetLang, providedForLang, assets);
                specCheck = validateSeoSpecificity_Updater_(specConstraints, translatedPayload, targetLang, providedForLang, slugLocked);
              }

              if (!specCheck.ok) {
                var reasonSpec = 'seo_specificity_failed: ' + specCheck.reasons.join(', ');
                log('Updater: SKIPPING LANGUAGE ' + targetLang + ' (SEO/specificity): ' + reasonSpec);
                translationSkipped.push({ lang: targetLang, message: reasonSpec });
                continue;
              }
            }

            var mixCheck = validateNoEnglishGenericMixingInTitleSlug_Updater_(translatedPayload, targetLang, providedForLang, specConstraints);
            if (!mixCheck.ok) {
              log('Updater: TITLE/SLUG LOCALIZATION FAILED (' + targetLang + '): ' + (mixCheck.found || []).join(', '));

              var cleaned = cleanTitleSlugEnglishPhrasesInPlace_Updater_(translatedPayload, targetLang, providedForLang, specConstraints, slugLocked);
              translatedPayload = cleaned.payload;
              if (cleaned.changed) log('SLUG CLEANED AND ACCEPTED (' + targetLang + ')');
              mixCheck = validateNoEnglishGenericMixingInTitleSlug_Updater_(translatedPayload, targetLang, providedForLang, specConstraints);
              if (!mixCheck.ok) {
                var ts = await regenerateTitleSlugOnlyForLocalization_Updater_(translatedPayload, translatedData, targetLang, providedForLang, specConstraints, slugLocked, mixCheck);
                if (ts) {
                  if (ts.title) translatedPayload.meta.rank_math_title = ts.title;
                  if (!slugLocked && ts.slug) {
                    translatedPayload.core = translatedPayload.core || {};
                    translatedPayload.core.slug = finalizeTranslatedSlug_Updater_(ts.slug, { maxLen: 80, spec: specConstraints });
                  }
                }

                translatedPayload = forcePrimaryKeywordFallbackOnSeo_Updater_(translatedPayload, providedForLang ? providedForLang.primary : '', payload, slugLocked);
                kwCheck = validateKeywordEnforcement_Updater_(translatedPayload, targetLang, providedForLang, assets);
                if (!kwCheck.ok) {
                  var reasonM0 = 'keyword_validation_failed: ' + kwCheck.reasons.join(', ');
                  log('Updater: SKIPPING LANGUAGE ' + targetLang + ' (SEO/keywords): ' + reasonM0);
                  translationSkipped.push({ lang: targetLang, message: reasonM0 });
                  continue;
                }

                specCheck = validateSeoSpecificity_Updater_(specConstraints, translatedPayload, targetLang, providedForLang, slugLocked);
                mixCheck = validateNoEnglishGenericMixingInTitleSlug_Updater_(translatedPayload, targetLang, providedForLang, specConstraints);
                if (!mixCheck.ok) {
                  translatedPayload = applyTitleSlugFallbackNoEnglishMixing_Updater_(translatedPayload, targetLang, providedForLang, specConstraints, slugLocked);
                  translatedPayload = forcePrimaryKeywordFallbackOnSeo_Updater_(translatedPayload, providedForLang ? providedForLang.primary : '', payload, slugLocked);
                  kwCheck = validateKeywordEnforcement_Updater_(translatedPayload, targetLang, providedForLang, assets);
                  specCheck = validateSeoSpecificity_Updater_(specConstraints, translatedPayload, targetLang, providedForLang, slugLocked);
                  mixCheck = validateNoEnglishGenericMixingInTitleSlug_Updater_(translatedPayload, targetLang, providedForLang, specConstraints);
                }

                if (!mixCheck.ok && mixCheck.severity === 'soft' && specCheck.ok) {
                  log('LOCALIZATION IMPERFECT BUT ACCEPTED (' + targetLang + '): ' + (mixCheck.found || []).join(', '));
                } else if (!mixCheck.ok || !specCheck.ok) {
                  var reasonM = 'localization_failed: ' + (mixCheck.found || []).join(', ');
                  log('HARD FAIL: ' + reasonM + ' (' + targetLang + ')');
                  log('Updater: SKIPPING LANGUAGE ' + targetLang + ' (SEO/localization): ' + reasonM);
                  translationSkipped.push({ lang: targetLang, message: reasonM });
                  continue;
                }
              }
            }

            var lmCheck = validateLandmarkSpecificityPreservation_Updater_(specConstraints, translatedPayload, targetLang);
            if (!lmCheck.ok) {
              log('Updater: LANDMARK SPECIFICITY FAILED - attempting fix (' + targetLang + '): ' + lmCheck.reasons.join(', '));
              translatedPayload = applyLandmarkSpecificityFix_Updater_(translatedPayload, targetLang, providedForLang, specConstraints, slugLocked);
              translatedPayload = forcePrimaryKeywordFallbackOnSeo_Updater_(translatedPayload, providedForLang ? providedForLang.primary : '', payload, slugLocked);
              kwCheck = validateKeywordEnforcement_Updater_(translatedPayload, targetLang, providedForLang, assets);
              specCheck = validateSeoSpecificity_Updater_(specConstraints, translatedPayload, targetLang, providedForLang, slugLocked);
              lmCheck = validateLandmarkSpecificityPreservation_Updater_(specConstraints, translatedPayload, targetLang);
              if (kwCheck.ok && specCheck.ok && lmCheck.ok) {
                if ((lmCheck.primary_present || []).length) log('PRIMARY LANDMARKS PRESERVED (' + targetLang + ')');
                if ((lmCheck.secondary_missing || []).length) log('SECONDARY LANDMARKS MISSING BUT ACCEPTED (' + targetLang + '): ' + lmCheck.secondary_missing.join(', '));
                log('LANDMARK SPECIFICITY FIXED AND ACCEPTED (' + targetLang + ')');
              } else {
                var reasonL = 'landmark_specificity_failed: ' + lmCheck.reasons.join(', ');
                log('HARD FAIL: canonical primary landmark truly lost (' + targetLang + '): ' + lmCheck.reasons.join(', '));
                log('Updater: SKIPPING LANGUAGE ' + targetLang + ' (SEO/landmarks): ' + reasonL);
                translationSkipped.push({ lang: targetLang, message: reasonL });
                continue;
              }
            } else {
              if ((lmCheck.primary_present || []).length) log('PRIMARY LANDMARKS PRESERVED (' + targetLang + ')');
              if ((lmCheck.secondary_missing || []).length) log('SECONDARY LANDMARKS MISSING BUT ACCEPTED (' + targetLang + '): ' + lmCheck.secondary_missing.join(', '));
            }

            translatedPayload = enforceCanonicalMuseumFamilyFidelityInPayload_Updater_(translatedPayload, targetLang, specConstraints)
            translatedPayload = await hardenTranslatedSeoHeadFieldsQuality_Updater_(translatedPayload, targetLang, providedForLang, specConstraints, payload)
            if (!updateOnly) translatedPayload = ensureDescriptiveSlugForScript_Updater_(translatedPayload, targetLang, providedForLang, specConstraints, slugLocked)
            var purityCheck = validateSingleLanguagePurity_Updater_(targetLang, {
              page_title: translatedPayload && translatedPayload.core ? translatedPayload.core.title : '',
              seo_title: translatedPayload && translatedPayload.meta ? translatedPayload.meta.rank_math_title : '',
              meta_description: translatedPayload && translatedPayload.meta ? translatedPayload.meta.rank_math_description : ''
            })
            if (!purityCheck.ok) {
              log('LANGUAGE CONTAMINATION DETECTED (' + targetLang + '): ' + JSON.stringify(purityCheck.contaminated))
              log('REGENERATING CONTAMINATED FIELD (' + targetLang + '): seo_fields')
              translatedPayload = await regenerateContaminatedSeoFields_Updater_(translatedPayload, targetLang, providedForLang, specConstraints)
              translatedPayload = enforceCanonicalMuseumFamilyFidelityInPayload_Updater_(translatedPayload, targetLang, specConstraints)
              purityCheck = validateSingleLanguagePurity_Updater_(targetLang, {
                page_title: translatedPayload && translatedPayload.core ? translatedPayload.core.title : '',
                seo_title: translatedPayload && translatedPayload.meta ? translatedPayload.meta.rank_math_title : '',
                meta_description: translatedPayload && translatedPayload.meta ? translatedPayload.meta.rank_math_description : ''
              })
              if (purityCheck.ok) log('TARGET LANGUAGE PURITY PASSED (' + targetLang + '): seo_fields')
            } else {
              log('TARGET LANGUAGE PURITY PASSED (' + targetLang + '): seo_fields')
            }

            if (translatedPayload && translatedPayload.core && translatedPayload.core.content) {
              translatedPayload.core.content = harmonizeBodyHeadingWithCanonicalLandmark_Updater_(translatedPayload.core.content, targetLang, specConstraints, translatedPayload)
              translatedPayload.core.content = removeStandaloneKeywordParagraphs_Updater_(translatedPayload.core.content, providedForLang ? providedForLang.primary : '', targetLang)
              if (translatedPayload.meta && translatedPayload.meta.wp_travel_engine_setting && translatedPayload.meta.wp_travel_engine_setting.tab_content && translatedPayload.meta.wp_travel_engine_setting.tab_content['1_wpeditor']) {
                var tHtml = String(translatedPayload.meta.wp_travel_engine_setting.tab_content['1_wpeditor'] || '')
                tHtml = harmonizeBodyHeadingWithCanonicalLandmark_Updater_(tHtml, targetLang, specConstraints, translatedPayload)
                tHtml = removeStandaloneKeywordParagraphs_Updater_(tHtml, providedForLang ? providedForLang.primary : '', targetLang)
                translatedPayload.meta.wp_travel_engine_setting.tab_content['1_wpeditor'] = tHtml
              }

              var bodySample = stripHtmlForLiteralCheck_Updater_(translatedPayload.core.content)
              var bodyCheck = isLikelyLanguageContamination_Updater_(String(bodySample || '').substring(0, 600), targetLang)
              if (bodyCheck.contaminated) {
                log('LANGUAGE CONTAMINATION DETECTED (' + targetLang + '): body ' + bodyCheck.markers.join(', '))
                var langCodeBody = String(targetLang || '').toLowerCase()
                if ((langCodeBody === 'fr' || langCodeBody === 'de') && bodyCheck.markers.indexOf('turkish_chars') !== -1) {
                  log('BODY CONTAMINATION MARKERS (' + langCodeBody + '): ' + JSON.stringify(bodyCheck.markers))
                  log('BODY TURKISH CHARS FOUND (' + langCodeBody + '): ' + JSON.stringify(listTurkishCharMarkers_Updater_(String(bodySample || '').substring(0, 600))))
                }
                log('REGENERATING CONTAMINATED FIELD (' + targetLang + '): body_cleanup')
                translatedPayload.core.content = removeObviousCrossLanguageFragments_Updater_(translatedPayload.core.content, targetLang)
                var bodySample2 = stripHtmlForLiteralCheck_Updater_(translatedPayload.core.content)
                var bodyCheck2 = isLikelyLanguageContamination_Updater_(String(bodySample2 || '').substring(0, 600), targetLang)
                if (bodyCheck2.contaminated) {
                  var retrySucceeded = false
                  if ((langCodeBody === 'fr' || langCodeBody === 'de') && bodyCheck2.markers.indexOf('turkish_chars') !== -1) {
                    log('BODY CLEANUP NORMALIZED MARKERS (' + langCodeBody + '): ' + JSON.stringify(bodyCheck2.markers))
                    log('BODY TURKISH CHARS FOUND AFTER CLEANUP (' + langCodeBody + '): ' + JSON.stringify(listTurkishCharMarkers_Updater_(String(bodySample2 || '').substring(0, 600))))
                    log('REGENERATING CONTAMINATED FIELD (' + targetLang + '): body_regen_retry')
                    translatedPayload.core.content = await regenerateBodyHtmlOnly_Updater_(translatedPayload.core.content, targetLang)
                    var bodySample3 = stripHtmlForLiteralCheck_Updater_(translatedPayload.core.content)
                    var bodyCheck3 = isLikelyLanguageContamination_Updater_(String(bodySample3 || '').substring(0, 600), targetLang)
                    if (!bodyCheck3.contaminated) {
                      log('BODY REGENERATION RETRY SUCCEEDED (' + langCodeBody + ')')
                      log('TARGET LANGUAGE PURITY PASSED (' + targetLang + '): body_regen_retry')
                      retrySucceeded = true
                    }
                    if (!retrySucceeded) log('BODY CONTAMINATION PERSISTED AFTER RETRY (' + langCodeBody + '): ' + bodyCheck3.markers.join(', '))
                  }
                  if (!retrySucceeded) {
                    log('Updater: SKIPPING LANGUAGE ' + targetLang + ' (body contamination): ' + bodyCheck2.markers.join(', '))
                    translationSkipped.push({ lang: targetLang, message: 'body_contamination: ' + bodyCheck2.markers.join(', ') })
                    continue
                  }
                }
                log('TARGET LANGUAGE PURITY PASSED (' + targetLang + '): body_cleaned')
              } else {
                log('TARGET LANGUAGE PURITY PASSED (' + targetLang + '): body')
              }
            }
            
            var transWpId = null
            if (updateOnly && existingTransId) {
              transWpId = existingTransId
              log('UPDATING EXISTING TRANSLATION: ' + targetLang + ' -> ' + transWpId)
              try {
                if (translatedPayload.core) delete translatedPayload.core.slug
                if (translatedPayload.slug !== undefined) delete translatedPayload.slug
                translatedPayload = upd_applyFinalSeoSafetyBelt_Updater_(translatedPayload, translatedData, f)
                await pushToWordPress_Updater_(transWpId, translatedPayload)
                log('Updater: Successfully UPDATED translation ' + transWpId)
                log('EXISTING PERMALINK PRESERVED (' + targetLang + ')')
              } catch (eUpdateTrans) {
                if (isWpNotFoundError_Updater_(eUpdateTrans)) {
                  updateOnly = false
                  transWpId = null
                  log('TRANSLATION NOT FOUND - CREATE WITH GENERATED SLUG (' + targetLang + ')')
                  if (generatedSlugForCreate) {
                    translatedPayload.core = translatedPayload.core || {}
                    translatedPayload.core.slug = generatedSlugForCreate
                    translatedPayload.slug = generatedSlugForCreate
                  }
                } else {
                  log('Updater: Update failed for ' + targetLang + ' (WP ID ' + transWpId + '): ' + (eUpdateTrans && eUpdateTrans.message ? eUpdateTrans.message : String(eUpdateTrans)))
                  translationErrors.push({ lang: targetLang, message: String(eUpdateTrans && eUpdateTrans.message ? eUpdateTrans.message : eUpdateTrans) })
                  continue
                }
              }
            }

            if (!updateOnly) {
              log('CREATING TRANSLATION: ' + targetLang + ' (parent=' + primaryWpId + ')')
              translatedPayload.translation_of = primaryWpId
              translatedPayload.core = translatedPayload.core || {}

              var candidateSlug = finalizeTranslatedSlug_Updater_(translatedPayload.core.slug || translatedPayload.slug || '', { maxLen: 80, spec: specConstraints })
              var slugCheck = validateNewTranslationSlugSemanticCompleteness_Updater_(candidateSlug, targetLang, providedForLang, specConstraints)
              if (slugCheck.ok && slugCheck.accepted_as_good_enough && slugCheck.warnings && slugCheck.warnings.length) {
                log('SEMANTIC CHECK DOWNGRADED TO SOFT WARNING (' + targetLang + '): ' + slugCheck.warnings.join(', '))
                log('LOCALIZED SLUG ACCEPTED AS GOOD ENOUGH (' + targetLang + '): ' + candidateSlug)
              }
              if (!slugCheck.ok) {
                log('NEW SLUG REJECTED AS SEMANTICALLY WEAK (' + targetLang + '): ' + candidateSlug + ' | ' + slugCheck.reasons.join(', '))
                log('REGENERATING NEW TRANSLATION SLUG (' + targetLang + ')')
                try {
                  var regen = await regenerateTitleSlugOnlyForLocalization_Updater_(translatedPayload, translatedData, targetLang, providedForLang, specConstraints, false, { ok: false, found: ['semantic_slug_weak'], severity: 'hard' })
                  if (regen && regen.slug) {
                    var cand2 = finalizeTranslatedSlug_Updater_(regen.slug, { maxLen: 80, spec: specConstraints })
                    var check2 = validateNewTranslationSlugSemanticCompleteness_Updater_(cand2, targetLang, providedForLang, specConstraints)
                    if (check2.ok) {
                      candidateSlug = cand2
                      slugCheck = check2
                      if (slugCheck.accepted_as_good_enough && slugCheck.warnings && slugCheck.warnings.length) {
                        log('SEMANTIC CHECK DOWNGRADED TO SOFT WARNING (' + targetLang + '): ' + slugCheck.warnings.join(', '))
                        log('LOCALIZED SLUG ACCEPTED AS GOOD ENOUGH (' + targetLang + '): ' + candidateSlug)
                      }
                    } else {
                      log('NEW SLUG REJECTED AS SEMANTICALLY WEAK (' + targetLang + '): ' + cand2 + ' | ' + check2.reasons.join(', '))
                    }
                  }
                } catch (eRegenSlug) {}
              }
              if (!slugCheck.ok) {
                var fbSlug = buildDeterministicFallbackSlugForCreate_Updater_(targetLang, providedForLang, specConstraints, translatedPayload)
                log('DETERMINISTIC FALLBACK SLUG BUILT (' + targetLang + '): ' + fbSlug)
                if (fbSlug.indexOf('day-tours') === -1 && fbSlug.indexOf('day') === -1 && fbSlug.indexOf('tours') === -1) {
                  log('DETERMINISTIC FALLBACK SIMPLIFIED (' + targetLang + ')')
                }
                if (fbSlug && fbSlug.indexOf('nmec') !== -1) {
                  log('MULTILINGUAL FALLBACK REJECTED (' + targetLang + '): contains nmec')
                  fbSlug = ''
                }
                var fbCheck = validateNewTranslationSlugSemanticCompleteness_Updater_(fbSlug, targetLang, providedForLang, specConstraints)
                if (fbCheck.ok) {
                  candidateSlug = fbSlug
                  slugCheck = fbCheck
                  if (slugCheck.accepted_as_good_enough && slugCheck.warnings && slugCheck.warnings.length) {
                    log('SEMANTIC CHECK DOWNGRADED TO SOFT WARNING (' + targetLang + '): ' + slugCheck.warnings.join(', '))
                    log('LOCALIZED SLUG ACCEPTED AS GOOD ENOUGH (' + targetLang + '): ' + candidateSlug)
                  }
                } else {
                  if (fbCheck.reasons && fbCheck.reasons.join(',').indexOf('multilingual_hybrid') !== -1) {
                    log('MULTILINGUAL FALLBACK REJECTED (' + targetLang + '): ' + fbSlug)
                  }
                  log('NEW SLUG REJECTED AS SEMANTICALLY WEAK (' + targetLang + '): ' + fbSlug + ' | ' + fbCheck.reasons.join(', '))
                }
              }

              if (!slugCheck.ok) {
                var reasonSlug = 'new_slug_semantically_weak: ' + slugCheck.reasons.join(', ')
                log('Updater: SKIPPING LANGUAGE ' + targetLang + ' (new slug): ' + reasonSlug)
                translationSkipped.push({ lang: targetLang, message: reasonSlug })
                continue
              }

              log('FINAL NEW TRANSLATION SLUG ACCEPTED (' + targetLang + '): ' + candidateSlug)
              translatedPayload.core.slug = candidateSlug
              translatedPayload.slug = candidateSlug

              translatedPayload = upd_applyFinalSeoSafetyBelt_Updater_(translatedPayload, translatedData, f)
              transWpId = await createNewTripOnWordPress_Updater_(translatedPayload)
              log('Updater: Successfully CREATED translation ' + transWpId)
              if (translatedPayload && translatedPayload.core && translatedPayload.core.slug) {
                log('NEW TRANSLATION PERMALINK CREATED WITH FINAL GENERATED SLUG (' + targetLang + '): ' + String(translatedPayload.core.slug))
              }
            }
            
            if (transWpId) {
                newTranslationIds[targetLang] = String(transWpId);
            }

            if (wantsPackages) {
              await publishPackagesSafe_Updater_(tripId, transWpId, { lang: targetLang, skipAirtableSync: true, tripTitle: imageTripTitleForLang });
              log('Updater: Linked packages for translation (' + targetLang + ') Trip ' + transWpId);
            }

            var transTripInfoForSchema = null;
            try {
              transTripInfoForSchema = await getTripInfoFromWpCached_Updater_(transWpId);
              var transSchema = generateTripSchema_Updater_(transTripInfoForSchema, targetLang, { airtableTripId: tripId })
              var transFaqSchema = null;
              try {
                transFaqSchema = generateFaqSchema_Updater_(translatedData, transTripInfoForSchema, targetLang);
              } catch (eFaqTrans) {
                log('Updater: Warning - Failed to generate FAQ schema for ' + targetLang + ': ' + eFaqTrans.message);
              }
              var transMetaSchema = { schema_trip_data: JSON.stringify(transSchema), trip_schema_data: JSON.stringify(transSchema) };
              if (transFaqSchema) transMetaSchema.faq_schema_data = JSON.stringify(transFaqSchema);
              await pushToWordPress_Updater_(transWpId, { meta: transMetaSchema });
              log('TRIP SCHEMA GENERATED (' + targetLang + ')');
            } catch (eSchemaTrans) {
              log('Updater: Failed to generate schema for ' + targetLang + ': ' + eSchemaTrans.message);
              throw eSchemaTrans
            }

            try {
              var tUrl = transTripInfoForSchema && transTripInfoForSchema.core ? (transTripInfoForSchema.core.permalink || transTripInfoForSchema.core.link || '') : ''
              translationUrlMap = upsertTranslationUrlMapEntry_Updater_(translationUrlMap, targetLang, transWpId, tUrl)
              await storeTranslationUrlMap_Updater_(tripId, translationUrlMap)
              await pushTranslationUrlMapMetaToWordPress_Updater_(primaryWpId, translationUrlMap)
              await pushTranslationUrlMapMetaToWordPress_Updater_(transWpId, translationUrlMap)
            } catch (eTurl) {
              log('Updater: Failed to update translation_url_map (' + targetLang + '): ' + (eTurl && eTurl.message ? eTurl.message : String(eTurl)))
              throw eTurl
            }

            try {
              var wpForLangVal = transTripInfoForSchema || {}
              wpForLangVal.meta = wpForLangVal.meta || {}
              if (typeof transSchema !== 'undefined' && transSchema) {
                wpForLangVal.meta.trip_schema_data = JSON.stringify(transSchema)
                wpForLangVal.meta.schema_trip_data = JSON.stringify(transSchema)
              }
              if (typeof transFaqSchema !== 'undefined' && transFaqSchema) {
                wpForLangVal.meta.faq_schema_data = JSON.stringify(transFaqSchema)
              }
              var vResLang = computeSeoValidationOutputs_Updater_(translatedData, f, translatedPayload, wpForLangVal)
              seoValidationByLanguage[targetLang] = formatSeoValidationForLanguageMap_Updater_(vResLang)
              await storeSeoValidationByLanguageMap_Updater_(tripId, seoValidationByLanguage)
            } catch (eValLang) {
              log('Updater: Failed to compute/store per-language SEO validation (' + targetLang + '): ' + (eValLang && eValLang.message ? eValLang.message : String(eValLang)))
              throw eValLang
            }

            try {
              if (wantsImages) {
                log(formatTranslatedImageSetSummary_Updater_(targetLang, transWpId, featuredTranslated, galleryTranslatedIds.length));
                await localizeTripImagesMetadataForLang_Updater_(sourceTripInfoFromWp, targetLang, {
                  seoData: imageSeoDataForLang,
                  focusKeywordsString: imageFocusKeywordsStringForLang,
                  tripTitle: imageTripTitleForLang,
                  tripInfo: transTripInfoForSchema,
                  tripFields: f,
                  attachmentIdMap: attachmentIdMap,
                  specConstraints: specConstraints
                });
              }
            } catch (eImgMeta) {
              log('Updater: Failed to localize image metadata for ' + targetLang + ': ' + eImgMeta.message);
              throw eImgMeta
            }
            
          } catch (eLang) {
            log('Updater: Error processing language ' + targetLang + ': ' + eLang.message);
            translationErrors.push({ lang: targetLang, message: String(eLang && eLang.message ? eLang.message : eLang) });
          }
        }
        } else if (wantsImages) {
          await syncImagesToExistingTranslations_Updater_(tripId, primaryWpId, f, languages, existingTranslations, sourceTripInfoFromWp);
        }
        
        // 🆕 FINAL LINKING & AIRTABLE SYNC
        // Now that all translations are created/updated, we update the PRIMARY trip 
        // with the complete map of translations.
        // We also update Airtable with this map.
        if (wantsTranslations && languagesToProcess.length > 0 && Object.keys(newTranslationIds).length > 0) {
            log('Updater: Finalizing translation links on Primary Trip ' + primaryWpId);
            
            // 1. Construct Final Map (Merge Existing + New)
            for (var langKey in existingTranslations) {
                if (!newTranslationIds[langKey]) {
                    newTranslationIds[langKey] = existingTranslations[langKey];
                }
            }
            // Ensure primary is in the map
            newTranslationIds[primaryLang] = String(primaryWpId);
            
            logVerbose_Updater_('FINAL TRANSLATION MAP: ' + JSON.stringify(newTranslationIds, null, 2));
            verifyTranslationMapForHreflang_Updater_(newTranslationIds, primaryLang, languagesToProcess);
            
            // 2. Update WordPress
            var linkingPayload = {
                id: primaryWpId,
                language: {
                    code: primaryLang,
                    translations: newTranslationIds
                }
            };
            
            logVerbose_Updater_('FINAL LINK PAYLOAD: ' + JSON.stringify(linkingPayload, null, 2));
            
            await pushToWordPress_Updater_(primaryWpId, linkingPayload);
            log('Updater: Language map synced to WP: ' + JSON.stringify(newTranslationIds));
            
            // 3. Update Airtable (Translation_Map)
            try {
                var mapJson = JSON.stringify(newTranslationIds);
                var atUpdate = {
                    'Translation_Map': mapJson,
                    'Translation_URL_Map': JSON.stringify(translationUrlMap || {}),
                    'Translation_Status': 'Done'
                };
                
                await airtableUpdate_(UPDATER_TRIPS_TABLE, tripId, atUpdate);
                log('Updater: Updated Airtable Translation_Map.');
            } catch (eMap) {
                log('Updater: Warning - Failed to update Airtable map: ' + eMap.message);
            }
        }

        if (wantsTranslations && translationSkipped.length) {
          try {
            var msg = ('Skipped translations: ' + translationSkipped.map(function(x) { return x.lang + ': ' + x.message; }).join(' || ')).slice(0, 1000);
            await airtableUpdate_(UPDATER_TRIPS_TABLE, tripId, { Translation_Error: msg });
          } catch (eSkip) {}
          log('Updater: Skipped languages: ' + translationSkipped.map(function(x) { return x.lang; }).join(', '));
        }

        if (wantsTranslations && translationErrors.length) {
          try {
            await airtableUpdate_(UPDATER_TRIPS_TABLE, tripId, {
              Translation_Status: 'Error',
              Translation_Error: ('Translation failed for: ' + translationErrors.map(function(x){return x.lang;}).join(', ') + ' | ' + translationErrors.map(function(x){return x.lang + ': ' + x.message;}).join(' || ')).slice(0, 1000)
            });
          } catch (eTr) {}
          await updatePublishStatus_Updater_(tripId, 'Error: Translation failed for ' + translationErrors.map(function(x){return x.lang;}).join(', '));
          log('Updater: Trip ' + tripId + ' not marked Published due to translation failures');
          continue;
        }
      }

      // 6. Update Status
      await updatePublishStatus_Updater_(tripId, 'Published');
      log('Updater: Successfully published Trip ' + tripId);
      
    } catch (e) {
      log('Updater: Error publishing Trip ' + tripId + ': ' + e.message);
      await updatePublishStatus_Updater_(tripId, 'Error: ' + e.message);
    }
  }
  } finally {
    lock.releaseLock();
  }
}

async function updatePublishStatus_Updater_(tripId, status) {
  var fields = {};
  fields[UPDATER_PUBLISH_STATUS_FIELD] = status;
  await airtableUpdate_(UPDATER_TRIPS_TABLE, tripId, fields);
}

function verifyTranslationMapForHreflang_Updater_(mapObj, primaryLang, requestedLangs) {
  var map = mapObj || {}
  var primary = String(primaryLang || '').toLowerCase()
  var req = Array.isArray(requestedLangs) ? requestedLangs.map(function(x) { return String(x || '').toLowerCase() }) : []
  var issues = []
  if (!primary) issues.push('missing_primary_lang')
  if (primary && !map[primary]) issues.push('missing_primary_id')

  var seenIds = {}
  Object.keys(map).forEach(function(k) {
    var id = String(map[k] || '')
    if (!/^\d+$/.test(id)) issues.push('non_numeric_id:' + k)
    if (id) {
      if (seenIds[id] && seenIds[id] !== k) issues.push('duplicate_post_id:' + id + ':' + seenIds[id] + '+' + k)
      seenIds[id] = k
    }
  })

  req.forEach(function(l) {
    if (!l || l === primary) return
    if (!map[l]) issues.push('missing_translation:' + l)
  })

  if (issues.length) log('HREFLANG/TRANSLATION MAP WARNINGS: ' + issues.join(', '))
  else log('HREFLANG/TRANSLATION MAP VERIFIED: OK')
}

function computeSeoValidationOutputs_Updater_(enhancedData, tripFields, payload, wpTripInfo) {
  var data = enhancedData || {}
  var f = tripFields || {}
  var p = payload || {}
  var core = p.core || {}
  var meta = p.meta || {}
  var g = data.general || {}
  var wp = wpTripInfo || {}
  var wpMeta = wp && wp.meta ? wp.meta : {}

  function norm_(s) { return String(s || '').replace(/\s+/g, ' ').trim() }
  function hasText_(s) { return !!norm_(s) }
  function arrLen_(a) { return Array.isArray(a) ? a.length : 0 }
  function strIncludes_(hay, needle) { return String(hay || '').toLowerCase().indexOf(String(needle || '').toLowerCase()) !== -1 }

  var score = 100
  var flags = []
  var blockers = []

  function addFlag_(k) { if (flags.indexOf(k) === -1) flags.push(k) }
  function deduct_(pts) { score = Math.max(0, score - pts) }
  function requireBlocker_(flag, pts) { addFlag_(flag); deduct_(pts); if (blockers.indexOf(flag) === -1) blockers.push(flag) }
  function requireWarn_(flag, pts) { addFlag_(flag); deduct_(pts) }

  var seoTitle = norm_(meta.rank_math_title || g.AI_SEO_Title || (wpMeta ? wpMeta.rank_math_title : '') || '')
  var seoDesc = norm_(meta.rank_math_description || g.AI_SEO_Meta_Description || (wpMeta ? wpMeta.rank_math_description : '') || '')
  var slug = norm_(core.slug || g.AI_SEO_Permalink || f.Slug || f.slug || '')

  if (!hasText_(seoTitle)) requireBlocker_('missing_seo_title', 20)
  if (!hasText_(seoDesc)) requireBlocker_('missing_seo_meta_description', 15)
  if (!hasText_(slug)) requireBlocker_('missing_slug', 20)

  var tripSchema = meta.trip_schema_data || meta.schema_trip_data || (wpMeta ? (wpMeta.trip_schema_data || wpMeta.schema_trip_data) : null)
  if (!hasText_(tripSchema)) requireBlocker_('missing_trip_schema', 15)

  var faqsExist = arrLen_(data.faqs) > 0
  var faqSchema = meta.faq_schema_data || (wpMeta ? wpMeta.faq_schema_data : null)
  if (faqsExist && !hasText_(faqSchema)) requireWarn_('missing_faq_schema', 8)

  if (arrLen_(data.highlights) === 0) requireWarn_('missing_highlights', 8)
  if (arrLen_(data.itinerary) === 0) requireBlocker_('missing_itinerary', 15)

  if (arrLen_(data.includes) === 0) requireWarn_('missing_includes', 5)
  if (arrLen_(data.excludes) === 0) requireWarn_('missing_excludes', 5)

  if (arrLen_(data.facts) === 0) requireWarn_('missing_trip_facts', 8)

  var hasFeatured = !!(wp && wp.featured_image && wp.featured_image.url)
  if (!hasFeatured) requireBlocker_('missing_featured_image', 15)

  try {
    var spec = extractSpecificityConstraintsFromEnglish_Updater_(data, f, wp)
    if (spec && spec.landmark_source_inconsistent) {
      requireWarn_('landmark_source_inconsistent', 3)
    }
    if (spec && spec.landmark_source_ambiguous) {
      requireWarn_('landmark_source_ambiguous', 3)
    }
  } catch (eSpec) {}

  if (f.Translation_Error && strIncludes_(f.Translation_Error, 'contamination')) {
    requireWarn_('translation_language_contamination_detected', 5)
  }

  score = Math.max(0, Math.min(100, score))

  var seoStatus = 'PASS'
  if (blockers.length > 0 || score < 70) seoStatus = 'FAIL'
  else if (flags.length > 0 || score < 90) seoStatus = 'WARN'

  var publishStatus = 'READY'
  if (blockers.length > 0) publishStatus = 'BLOCKED'
  else if (seoStatus !== 'PASS' || score < 95) publishStatus = 'REVIEW'

  return {
    seo_status: seoStatus,
    seo_score: score,
    seo_flags: flags,
    publish_status: publishStatus
  }
}

async function storeSeoValidationOutputs_Updater_(tripId, vRes) {
  var r = vRes || {}
  var fields = {
    SEO_Validation_Status: String(r.seo_status || ''),
    SEO_Validation_Score: Number(r.seo_score || 0),
    SEO_Validation_Flags: JSON.stringify(r.seo_flags || []),
    Publish_Readiness_Status: String(r.publish_status || '')
  }
  try {
    await airtableUpdate_(UPDATER_TRIPS_TABLE, tripId, fields)
  } catch (e) {
    log('Updater: Warning - Failed to store SEO validation fields (Airtable may be missing columns): ' + (e && e.message ? e.message : String(e)))
  }
}

function formatSeoValidationForLanguageMap_Updater_(vRes) {
  var r = vRes || {}
  return {
    status: String(r.seo_status || ''),
    score: Number(r.seo_score || 0),
    flags: r.seo_flags || [],
    publish: String(r.publish_status || '')
  }
}

async function storeSeoValidationByLanguageMap_Updater_(tripId, mapObj) {
  var map = mapObj || {}
  try {
    await airtableUpdate_(UPDATER_TRIPS_TABLE, tripId, { SEO_Validation_By_Language: JSON.stringify(map) })
  } catch (e) {
    log('Updater: Warning - Failed to store SEO_Validation_By_Language (Airtable may be missing column): ' + (e && e.message ? e.message : String(e)))
  }
}

// ----------------------------------------------------------
// DATA FETCHING
// ----------------------------------------------------------

async function fetchCompleteTripData_Updater_(tripId, tripFields, opts) {
  var data = {};
  var o = opts || {};
  
  // Strategy: Client-Side Filtering by ID.
  // Formulas failed for ID (resolves to Name) and Name (character mismatches).
  // We will fetch records and find the match in JS. This is 100% robust.
  
  log('Updater: Fetching General Improvement using Client-Side ID Check: ' + tripId);
  
  var impRec = await findRecordByLinkedId_Updater_(UPDATER_IMPROVEMENT_TABLE, 'Trip', tripId);
  
  if (!impRec) {
    log('Updater: WARNING - No General Improvement record found for Trip ' + tripId);
  } else {
    log('Updater: Found General Improvement record: ' + impRec.id);
  }

  data.general = impRec ? impRec.fields : {};

  // 1b. TripDetails (One-to-One) - Critical for TourType
  var detailsRec = await findRecordByLinkedId_Updater_(UPDATER_TRIP_DETAILS_TABLE, 'Trip', tripId);
  data.tripDetails = detailsRec ? detailsRec.fields : {};
  if (detailsRec) {
    log('Updater: Found TripDetails record: ' + detailsRec.id);
  } else {
    log('Updater: WARNING - No TripDetails record found for Trip ' + tripId);
  }
  
  // 2. Highlights (One-to-Many)
  data.highlights = await findRecordsByLinkedId_Updater_(UPDATER_HIGHLIGHTS_IMPROVEMENT_TABLE, 'Trip', tripId, 'Order');
  
  // 3. Itinerary (One-to-Many)
  data.itinerary = await findRecordsByLinkedId_Updater_(UPDATER_ITINERARY_IMPROVEMENT_TABLE, 'Trip', tripId, 'StepOrder');
  
  // 4. FAQs (One-to-Many)
  data.faqs = await findRecordsByLinkedId_Updater_(UPDATER_FAQS_IMPROVEMENT_TABLE, 'Trip', tripId);
  
  // 5. Includes/Excludes (One-to-Many)
  data.includes = await findRecordsByLinkedId_Updater_(UPDATER_TRIP_INCLUDES_IMPROVEMENT_TABLE, 'Trip', tripId);
  data.excludes = await findRecordsByLinkedId_Updater_(UPDATER_TRIP_EXCLUDES_IMPROVEMENT_TABLE, 'Trip', tripId);
  
  // 6. Facts (One-to-Many)
  try {
    data.facts = await findRecordsByLinkedId_Updater_(UPDATER_TRIP_FACTS_IMPROVEMENT_TABLE, 'Trip', tripId);
  } catch (e) {
    log('Updater: Warning - Failed to fetch Trip Facts: ' + e.message);
    data.facts = [];
  }
  
  // 7. AddOns (One-to-Many)
  try {
    data.addons = await findRecordsByLinkedId_Updater_(UPDATER_ADDONS_IMPROVEMENT_TABLE, 'Trip', tripId);
  } catch (e) {
     log('Updater: Warning - Failed to fetch AddOns: ' + e.message);
     data.addons = [];
  }

  abortIfIncompleteLookup_Updater_(tripId, [
    { label: 'General Improvement', tableName: UPDATER_IMPROVEMENT_TABLE, linkFieldName: 'Trip', mode: 'single' },
    { label: 'TripDetails', tableName: UPDATER_TRIP_DETAILS_TABLE, linkFieldName: 'Trip', mode: 'single' },
    { label: 'Highlights', tableName: UPDATER_HIGHLIGHTS_IMPROVEMENT_TABLE, linkFieldName: 'Trip', mode: 'multi' },
    { label: 'Itinerary', tableName: UPDATER_ITINERARY_IMPROVEMENT_TABLE, linkFieldName: 'Trip', mode: 'multi' },
    { label: 'FAQs', tableName: UPDATER_FAQS_IMPROVEMENT_TABLE, linkFieldName: 'Trip', mode: 'multi' },
    { label: 'TripIncludes', tableName: UPDATER_TRIP_INCLUDES_IMPROVEMENT_TABLE, linkFieldName: 'Trip', mode: 'multi' },
    { label: 'TripExcludes', tableName: UPDATER_TRIP_EXCLUDES_IMPROVEMENT_TABLE, linkFieldName: 'Trip', mode: 'multi' },
    { label: 'TripFacts', tableName: UPDATER_TRIP_FACTS_IMPROVEMENT_TABLE, linkFieldName: 'Trip', mode: 'multi' },
    { label: 'AddOns', tableName: UPDATER_ADDONS_IMPROVEMENT_TABLE, linkFieldName: 'Trip', mode: 'multi' }
  ]);

  // 8. AI Activities Classification (New Feature)
  // We classify activities based on trip content using AI, matching the REFERENCE_ACTIVITIES_LIST
  // This is done on-the-fly during the update process to ensure latest data is used.
  var generalFields = data.general || {}; // Ensure g is defined from data.general
  
  if (o.skipClassification) {
    log('SKIP ACTIVITY/TRIPTYPE CLASSIFICATION');
    data.aiActivities = [];
    data.aiTripTypes = [];
  } else if (generalFields.AI_Trip_Description || tripFields.Trip_Description) {
    try {
       // Classify Activities
       data.aiActivities = await classifyTripActivities_Updater_(tripId, tripFields, generalFields);
       
       // Classify Trip Types
       data.aiTripTypes = await classifyTripTypes_Updater_(tripId, tripFields, generalFields);
       
    } catch (e) {
       log('Updater: Warning - Failed to classify Activities/TripTypes: ' + e.message);
       data.aiActivities = [];
       data.aiTripTypes = [];
    }
  } else {
     data.aiActivities = [];
     data.aiTripTypes = [];
  }
  
  logVerbose_Updater_('Updater: Full Enhanced Data for ' + tripId + ': ' + JSON.stringify(data));
  
  return data;
}

// ----------------------------------------------------------
// AI ACTIVITIES CLASSIFICATION
// ----------------------------------------------------------

/**
 * Classifies trip activities using AI based on trip content.
 * Matches against a strict reference list of allowed activities.
 */
async function classifyTripActivities_Updater_(tripId, tripFields, aiImprovementFields) {
  log('Updater: Starting AI classification for Activities...');
  
  // 1. Prepare Context
  var title = aiImprovementFields.AI_SEO_Title || tripFields.Title || '';
  var description = aiImprovementFields.AI_Trip_Description || tripFields.Trip_Description || '';
  var highlights = aiImprovementFields.AI_Trip_Highlights_Section_Title || ''; // Just title for context
  
  // Combine text for AI analysis
  var contextText = "Title: " + title + "\n" +
                    "Description: " + description;

  // 2. Define Reference List (Hardcoded from user request)
  // This ensures we only pick from valid WP Travel Engine activities
  var VALID_ACTIVITIES = [
    { id: 390, name: "Boat Cruises", slug: "boat-cruises" },
    { id: 397, name: "Camel Riding", slug: "camel-ride" },
    { id: 400, name: "City Tours", slug: "city-tours" },
    { id: 394, name: "Desert Safaris", slug: "desert-safari" },
    { id: 392, name: "Diving", slug: "scuba-diving" },
    { id: 393, name: "Dolphin Swims", slug: "dolphin-watching" },
    { id: 401, name: "For Kids", slug: "family-activities" },
    { id: 396, name: "Horse Riding", slug: "horse-riding" },
    { id: 402, name: "Massages", slug: "spa-massage" },
    { id: 399, name: "Pyramids & History", slug: "historical-tours" },
    { id: 395, name: "Quads & ATVs", slug: "quad-bike-safari" },
    { id: 391, name: "Snorkeling", slug: "snorkeling" },
    { id: 398, name: "Stargazing", slug: "stargazing-excursions" },
    { id: 403, name: "Wellness & Spas", slug: "wellness-spa" },
    { id: 404, name: "Wheelchair Accessible", slug: "accessible-tours" }
  ];
  
  var validNames = VALID_ACTIVITIES.map(function(a) { return a.name; }).join(", ");

  // 3. Construct Prompt
  var prompt = 
    "You are an expert travel categorizer. Analyze the following trip details and select the most appropriate activities from the ALLOWED LIST below.\n\n" +
    "TRIP DETAILS:\n" + contextText + "\n\n" +
    "ALLOWED ACTIVITIES LIST (Select strictly from this list):\n" +
    "[" + validNames + "]\n\n" +
    "INSTRUCTIONS:\n" +
    "- Select 1 to 3 categories that best fit the trip.\n" +
    "- Return ONLY a JSON array of strings. Example: [\"City Tours\", \"Pyramids & History\"]\n" +
    "- Do NOT invent new categories.\n" +
    "- If it involves a boat/sea, include 'Boat Cruises' or 'Dolphin Swims' or 'Snorkeling' as appropriate.\n" +
    "- If it involves desert/jeep, include 'Desert Safaris' or 'Quads & ATVs'.\n" +
    "- If it visits museums, citadels, markets, or historic neighborhoods, include 'City Tours'.\n" +
    "- Use 'Pyramids & History' ONLY if pyramids/Giza/Sphinx are clearly mentioned.";

  // 4. Call AI (using existing helper)
  // We reuse callAi_ from ai_enhancer.gs or similar if available globally, 
  // OR we implement a simple version here if not exposed.
  // Assuming callAi_ is available in the project (it usually is in `utils_ai.gs`).
  var aiResponse = await callDeepseekJson_(prompt); 
  
  // 5. Parse Response
  var selectedNames = [];
  if (aiResponse && typeof aiResponse === 'object') {
     // If AI returns object with keys, try to find array
     if (Array.isArray(aiResponse)) selectedNames = aiResponse;
     else if (aiResponse.activities && Array.isArray(aiResponse.activities)) selectedNames = aiResponse.activities;
     else if (aiResponse.categories && Array.isArray(aiResponse.categories)) selectedNames = aiResponse.categories;
  } else if (Array.isArray(aiResponse)) {
     selectedNames = aiResponse;
  }
  
  log('Updater: AI suggested activities: ' + JSON.stringify(selectedNames));

  (function() {
    if (!Array.isArray(selectedNames) || !selectedNames.length) return
    var hay = (String(title || '') + ' ' + String(description || '')).toLowerCase()
    var hasPyramids = (/\bpyramids?\b/.test(hay)) || (hay.indexOf('giza plateau') !== -1) || ((/\bgiza\b/.test(hay)) && (/\bpyramids?\b/.test(hay) || /\bsphinx\b/.test(hay))) || (/\bsphinx\b/.test(hay) && /\bpyramids?\b/.test(hay))
    if (hasPyramids) return
    var before = selectedNames.slice(0)
    selectedNames = selectedNames.filter(function(nm) { return String(nm || '').toLowerCase() !== 'pyramids & history' })
    if (before.length !== selectedNames.length) log('Updater: Removed Pyramids & History (no explicit pyramids signal)')
  })()
  
  // 6. Map back to ID/Slug structure
  var finalActivities = [];
  
  if (Array.isArray(selectedNames)) {
    selectedNames.forEach(function(name) {
       var match = VALID_ACTIVITIES.filter(function(v) { 
          return v.name.toLowerCase() === String(name).toLowerCase(); 
       })[0];
       
       if (match) {
         finalActivities.push({
           id: match.id,
           name: match.name,
           slug: match.slug
         });
       }
    });
  }
  
  // Default fallback if nothing matches
  if (finalActivities.length === 0) {
     // Maybe add 'City Tours' as safe default?
     finalActivities.push({ id: 400, name: "City Tours", slug: "city-tours" });
  }
  
  return finalActivities;
}

/**
 * Classifies trip types using AI based on trip content.
 * Matches against a strict reference list of allowed trip types.
 */
async function classifyTripTypes_Updater_(tripId, tripFields, aiImprovementFields) {
  log('Updater: Starting AI classification for Trip Types...');
  
  // 1. Prepare Context (reuse context logic)
  var title = aiImprovementFields.AI_SEO_Title || tripFields.Title || '';
  var description = aiImprovementFields.AI_Trip_Description || tripFields.Trip_Description || '';
  
  var contextText = "Title: " + title + "\n" +
                    "Description: " + description;

  // 2. Define Reference List (Hardcoded from user request)
  var VALID_TRIP_TYPES = [
    { id: 406, name: "Adventures", slug: "adventure-excursions" },
    { id: 407, name: "Day Trips", slug: "day-trips" },
    { id: 411, name: "Entry Tickets", slug: "attraction-tickets" },
    { id: 408, name: "Guided Tours", slug: "guided-tours" },
    { id: 409, name: "Multi-day Trips", slug: "multi-day-trips" },
    { id: 410, name: "Other Experiences", slug: "things-to-do" },
    { id: 412, name: "Private Tours", slug: "private-tours" },
    { id: 413, name: "Transfers", slug: "airport-transfers" },
    { id: 405, name: "Water Activities", slug: "water-sports" }
  ];
  
  var validNames = VALID_TRIP_TYPES.map(function(a) { return a.name; }).join(", ");

  // 3. Construct Prompt
  var prompt = 
    "You are an expert travel categorizer. Analyze the following trip details and select the most appropriate Trip Types from the ALLOWED LIST below.\n\n" +
    "TRIP DETAILS:\n" + contextText + "\n\n" +
    "ALLOWED TRIP TYPES LIST (Select strictly from this list):\n" +
    "[" + validNames + "]\n\n" +
    "INSTRUCTIONS:\n" +
    "- Select 1 to 2 types that best fit the trip.\n" +
    "- Return ONLY a JSON array of strings. Example: [\"Day Trips\", \"Private Tours\"]\n" +
    "- Do NOT invent new types.\n" +
    "- 'Transfers' is ONLY for airport/hotel transfers, not tours.\n" +
    "- 'Entry Tickets' is ONLY for tickets without a guide.\n" +
    "- 'Multi-day Trips' is for trips > 1 day.";

  // 4. Call AI
  var aiResponse = await callDeepseekJson_(prompt); 
  
  // 5. Parse Response
  var selectedNames = [];
  if (aiResponse && typeof aiResponse === 'object') {
     if (Array.isArray(aiResponse)) selectedNames = aiResponse;
     else if (aiResponse.types && Array.isArray(aiResponse.types)) selectedNames = aiResponse.types;
     else if (aiResponse.categories && Array.isArray(aiResponse.categories)) selectedNames = aiResponse.categories;
  } else if (Array.isArray(aiResponse)) {
     selectedNames = aiResponse;
  }
  
  log('Updater: AI suggested trip types: ' + JSON.stringify(selectedNames));
  
  // 6. Map back to ID/Slug structure
  var finalTypes = [];
  
  if (Array.isArray(selectedNames)) {
    selectedNames.forEach(function(name) {
       var match = VALID_TRIP_TYPES.filter(function(v) { 
          return v.name.toLowerCase() === String(name).toLowerCase(); 
       })[0];
       
       if (match) {
         finalTypes.push({
           id: match.id,
           name: match.name,
           slug: match.slug
         });
       }
    });
  }
  
  // Default fallback
  if (finalTypes.length === 0) {
     finalTypes.push({ id: 408, name: "Guided Tours", slug: "guided-tours" });
  }
  
  return finalTypes;
}


// Helper: Find SINGLE record by Linked Record ID (Client-Side) with Pagination
async function findRecordByLinkedId_Updater_(tableName, linkFieldName, targetId) {
  var state = {
    lookupMode: 'single',
    recordsCount: 0,
    formulaQuotaHit: false,
    cacheQuotaHit: false,
    pageCapHit: false,
    partial: false,
    usedFallback: false
  };
  var formula = "FIND('" + String(targetId).replace(/'/g, "\\'") + "', ARRAYJOIN({" + linkFieldName + "}))";
  var offset = null;
  do {
    var params = { pageSize: 100, filterByFormula: formula };
    if (offset) params.offset = offset;
    var res = null;
    try {
      res = await airtableGet_(tableName, params);
    } catch (e) {
      var msg = e && e.message ? String(e.message) : String(e);
      if (msg.indexOf('INVALID_FILTER_BY_FORMULA') !== -1 && msg.toLowerCase().indexOf('unknown field') !== -1) {
        log('Updater: Airtable lookup skipped invalid filterByFormula for table ' + tableName + ' field ' + linkFieldName);
        break;
      }
      if (isQuotaLikeError_Updater_(e)) {
        state.formulaQuotaHit = true;
        state.partial = true;
        log('Updater: Linked lookup aborted for ' + tableName + ' due to quota/rate-limit: ' + msg);
        setLookupState_Updater_(tableName, linkFieldName, targetId, 'single', state);
        return null;
      }
      throw e;
    }
    var records = (res && res.records) ? res.records : [];
    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      var links = rec.fields[linkFieldName];
      if (Array.isArray(links)) {
        if (links.indexOf(targetId) !== -1) {
          state.recordsCount = 1;
          setLookupState_Updater_(tableName, linkFieldName, targetId, 'single', state);
          return rec;
        }
      } else if (typeof links === 'string') {
        if (links === targetId) {
          state.recordsCount = 1;
          setLookupState_Updater_(tableName, linkFieldName, targetId, 'single', state);
          return rec;
        }
      }
    }
    offset = res ? res.offset : null;
    if (offset) await sleep(50);
  } while (offset);

  var cached = await getAllAirtableRecordsCached_Updater_(tableName);
  var cacheMeta = UPDATER_AIRTABLE_TABLE_CACHE_META[String(tableName || '')] || {};
  state.usedFallback = true;
  state.cacheQuotaHit = !!cacheMeta.quotaHit;
  state.pageCapHit = !!cacheMeta.pageCapHit;
  state.partial = !!(state.partial || cacheMeta.partial);
  for (var j = 0; j < cached.length; j++) {
    var rec2 = cached[j];
    if (!rec2 || !rec2.fields) continue;
    var links2 = rec2.fields[linkFieldName];
    if (Array.isArray(links2)) {
      if (links2.indexOf(targetId) !== -1) {
        state.recordsCount = 1;
        setLookupState_Updater_(tableName, linkFieldName, targetId, 'single', state);
        return rec2;
      }
    } else if (typeof links2 === 'string') {
      if (links2 === targetId) {
        state.recordsCount = 1;
        setLookupState_Updater_(tableName, linkFieldName, targetId, 'single', state);
        return rec2;
      }
    }
  }
  setLookupState_Updater_(tableName, linkFieldName, targetId, 'single', state);
  return null;
}

// Helper: Find MULTIPLE records by Linked Record ID (Client-Side)
// Modified to support PAGINATION to ensure we scan all records, not just the first page.
async function findRecordsByLinkedId_Updater_(tableName, linkFieldName, targetId, sortField) {
  var matches = [];
  var state = {
    lookupMode: 'multi',
    recordsCount: 0,
    formulaQuotaHit: false,
    cacheQuotaHit: false,
    pageCapHit: false,
    partial: false,
    usedFallback: false
  };
  var formula = "FIND('" + String(targetId).replace(/'/g, "\\'") + "', ARRAYJOIN({" + linkFieldName + "}))";
  var offset = null;
  do {
    var params = { pageSize: 100, filterByFormula: formula };
    if (offset) params.offset = offset;
    var res = null;
    try {
      res = await airtableGet_(tableName, params);
    } catch (e) {
      var msg = e && e.message ? String(e.message) : String(e);
      if (msg.indexOf('INVALID_FILTER_BY_FORMULA') !== -1 && msg.toLowerCase().indexOf('unknown field') !== -1) {
        log('Updater: Airtable lookup skipped invalid filterByFormula for table ' + tableName + ' field ' + linkFieldName);
        break;
      }
      if (isQuotaLikeError_Updater_(e)) {
        state.formulaQuotaHit = true;
        state.partial = true;
        log('Updater: Linked lookup aborted for ' + tableName + ' due to quota/rate-limit: ' + msg);
        setLookupState_Updater_(tableName, linkFieldName, targetId, 'multi', state);
        return matches;
      }
      throw e;
    }
    if (res && res.records) {
      for (var i = 0; i < res.records.length; i++) {
        var rec = res.records[i];
        var links = rec.fields[linkFieldName];
        if (links && Array.isArray(links) && links.indexOf(targetId) !== -1) {
          matches.push(rec);
        }
      }
    }
    offset = res ? res.offset : null;
    if (offset) await sleep(50);
  } while (offset);

  if (matches.length === 0) {
    var cached = await getAllAirtableRecordsCached_Updater_(tableName);
    var cacheMeta2 = UPDATER_AIRTABLE_TABLE_CACHE_META[String(tableName || '')] || {};
    state.usedFallback = true;
    state.cacheQuotaHit = !!cacheMeta2.quotaHit;
    state.pageCapHit = !!cacheMeta2.pageCapHit;
    state.partial = !!(state.partial || cacheMeta2.partial);
    for (var j = 0; j < cached.length; j++) {
      var rec2 = cached[j];
      if (!rec2 || !rec2.fields) continue;
      var links2 = rec2.fields[linkFieldName];
      if (links2 && Array.isArray(links2) && links2.indexOf(targetId) !== -1) {
        matches.push(rec2);
      }
    }
  }
  
  // Sort if needed
  if (sortField && matches.length > 0) {
    matches.sort(function(a, b) {
      var valA = a.fields[sortField];
      var valB = b.fields[sortField];
      if (typeof valA === 'number' && typeof valB === 'number') return valA - valB;
      if (typeof valA === 'string' && typeof valB === 'string') return valA.localeCompare(valB);
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;
      return 0;
    });
  }
  
  state.recordsCount = matches.length;
  setLookupState_Updater_(tableName, linkFieldName, targetId, 'multi', state);
  return matches;
}

// ----------------------------------------------------------
// GOLDEN TEMPLATE: TRIP FACTS
// ----------------------------------------------------------

/**
 * Load the golden template for trip_facts structure
 * This ensures 100% WordPress compatibility by using the exact format
 * that WordPress expects for WP Travel Engine trip facts.
 * 
 * Based on successful manual data entry in WordPress (Trip 16215)
 * 
 * @return {Object} Template with structure and mapping
 */
function loadTripFactsTemplate_Updater_() {
  return {
    // Complete WordPress-compatible structure - 6 core fields
    "structure": {
      "12647846": {
        "12647846": "English"
      },
      "35550118": {
        "35550118": "As per itinerary"
      },
      "90730383": {
        "90730383": "Private Tour"
      },
      "97932390": {
        "97932390": "6 hours"
      },
      "97943192": {
        "97943192": "Daily"
      },
      "97950890": {
        "97950890": "Available"
      },
      "field_id": {
        "12647846": "Language",
        "35550118": "Transportation",
        "90730383": "Tour Type",
        "97932390": "Duration",
        "97943192": "Tour Availability",
        "97950890": "Pickup & Drop Off"
      },
      "field_type": {
        "12647846": "text",
        "35550118": "text",
        "90730383": "text",
        "97932390": "text",
        "97943192": "text",
        "97950890": "text"
      }
    },
    
    // Label to FactID mapping (for easy lookup from Airtable data)
    "mapping": {
      "Language": "12647846",
      "Transportation": "35550118",
      "Tour Type": "90730383",
      "Duration": "97932390",
      "Tour Availability": "97943192",
      "Pickup & Drop Off": "97950890",
      "Meals": "69801669",
      "Guiding method": "97927509",
      "Group Size": "93988162",
      "Accomodation": "28890066",
      "Maximum Altitude": "89526429",
      "Fitness level": "69738162",
      "Arrival on": "12660073",
      "Departure from": "32070658",
      "Best season": "33257212",
      "Permits": "31652972",
      "Tour Location": "97941245"
    }
  };
}

// ----------------------------------------------------------
// MAPPING
// ----------------------------------------------------------

function mapAirtableToWordPress_Updater_(data, tripFields, overrideLang) {
  var g = data.general; // General improvement fields
  
  var payload = {
    core: {},
    meta: {
      wp_travel_engine_setting: {
        cost: {},
        faq: {},
        itinerary: {}
      }
    }
  };

  // --- General Duration Logic (Direct Mapping) ---
  // MODIFIED: Prefer values from Improvement With AI (data.general) if available
  // Also check for space-separated field names (common Airtable issue)
  var dUnit = g.Duration_Unit || g['Duration Unit'] || tripFields.Duration_Unit || tripFields['Duration Unit'] || '';
  var dHours = Number(g.Duration_Hours || g['Duration Hours'] || tripFields.Duration_Hours || tripFields['Duration Hours'] || 0);
  var dMinutes = Number(g.Duration_Minutes || g['Duration Minutes'] || tripFields.Duration_Minutes || tripFields['Duration Minutes'] || 0);
  
  // Prioritize TourType from TripDetails as requested
  var tourType = '';
  if (data.tripDetails && data.tripDetails.TourType) {
    tourType = data.tripDetails.TourType;
  } else {
    tourType = tripFields.TourType || '';
  }

  log('Updater: Direct Mapping - dUnit: ' + dUnit + ', dHours: ' + dHours + ', dMinutes: ' + dMinutes + ', tourType: ' + tourType + ', Title: ' + (g.AI_SEO_Title || 'No Title'));

  var tripIdForCode = tripFields.TripID || tripFields['TripID'] || '';
  if (Array.isArray(tripIdForCode)) tripIdForCode = tripIdForCode.length ? tripIdForCode[0] : '';
  tripIdForCode = String(tripIdForCode || '').trim();

  var tripCodeRaw = tripIdForCode;
  if (!tripCodeRaw || /^99\d+/.test(tripCodeRaw)) {
    tripCodeRaw = tripFields.TripCode || tripFields['Trip Code'] || tripFields.Trip_Code || tripFields['Trip_Code'] || '';
  }
  if (Array.isArray(tripCodeRaw)) tripCodeRaw = tripCodeRaw.length ? tripCodeRaw[0] : '';
  tripCodeRaw = String(tripCodeRaw || '').trim();
  var tripCode = normalizeTripCode_Updater_(tripCodeRaw);

  log('Updater: trip_code resolved: ' + (tripCode ? tripCode : '(empty)'));

  payload.general = {
    trip_code: tripCode,
    duration_type: dUnit,
    duration: {
      hours: dHours,
      minutes: dMinutes
    }
  };

  // Map TourType to meta.trip_type
  payload.meta.trip_type = tourType;
  
  // 🆕 LANGUAGE SUPPORT (Polylang / WPML)
  if (overrideLang) {
      // Use the provided language code directly
      payload.lang = overrideLang;
      payload.language = { code: overrideLang };
  } else {
      // If 'Language' field exists in Airtable (e.g. 'en', 'fr', 'de'), map it.
      // Assuming the field name in Airtable is 'Language' or 'Lang'.
      var langCode = tripFields.Language || tripFields.Lang || 'en'; 
      
      // Handle array (Multi-select) - take first value
      if (Array.isArray(langCode)) {
          langCode = langCode.length > 0 ? langCode[0] : 'en';
      }
      
      // Ensure string before lowercasing
      langCode = String(langCode);

      var resolved = resolveLanguageCode_Updater_(langCode);
      if (!resolved) {
        log('UNKNOWN LANGUAGE IN AIRTABLE: ' + langCode);
        resolved = 'en';
      } else {
        log('LANGUAGE RESOLVED: ' + langCode + ' -> ' + resolved);
      }
      payload.lang = resolved;
      payload.language = { code: payload.lang };
  }
  
  log('Updater: Language set to: ' + payload.lang);

  // 🆕 Map AI Classified Activities to 'activities' taxonomy
  // This corresponds to the "Activities" taxonomy in WP Travel Engine
  if (data.aiActivities && data.aiActivities.length > 0) {
    log('Updater: Found ' + data.aiActivities.length + ' AI Activities. Mapping to payload...');
    // We send IDs if we know them, or names if the API supports creating/finding by name.
    // Based on the user's JSON example, it expects an array of objects with id, name, slug.
    // However, usually WP REST API expects an array of IDs for terms.
    // Let's assume we pass the array of IDs.
    
    // Extract IDs
    var activityIds = data.aiActivities.map(function(a) { return a.id; });
    
    // Assign to payload. The field name in WP Travel Engine REST API for activities 
    // is often 'trip_activities' or just 'activities' in the taxonomy map.
    // Checking standard WP pattern:
    payload.activities = activityIds; 
    log('Updater: Payload.activities set to: ' + JSON.stringify(payload.activities));
    
    // Also add full object to meta for debugging/display if needed, 
    // or if you have a custom handler on WP side that uses this meta.
    payload.meta.ai_classified_activities = data.aiActivities;
  } else {
    log('Updater: No AI Activities found in data object (or empty array).');
  }
  
  // 🆕 Map AI Classified Trip Types to 'trip_types' taxonomy
  if (data.aiTripTypes && data.aiTripTypes.length > 0) {
    log('Updater: Found ' + data.aiTripTypes.length + ' AI Trip Types. Mapping to payload...');
    var typeIds = data.aiTripTypes.map(function(t) { return t.id; });
    payload.trip_types = typeIds;
    log('Updater: Payload.trip_types set to: ' + JSON.stringify(payload.trip_types));
    payload.meta.ai_classified_trip_types = data.aiTripTypes;
  } else {
    log('Updater: No AI Trip Types found in data object (or empty array).');
  }


  
  // --- Core Fields ---
  // Only update if AI generated a new title/slug, otherwise keep original?
  // Usually we want to use the AI SEO Title if available, or fallback to existing.
  if (g.AI_SEO_Title) payload.core.title = g.AI_SEO_Title;
  
  var englishSlug = tripFields.Slug ? sanitizeTranslatedSlug_(tripFields.Slug) : '';
  if (payload.lang === 'en') {
    if (tripFields.Slug) {
      payload.core.slug = tripFields.Slug;
    } else if (g.AI_SEO_Permalink) {
      payload.core.slug = g.AI_SEO_Permalink;
    }
  } else {
    var translatedSlug = g.AI_SEO_Permalink ? sanitizeTranslatedSlug_(g.AI_SEO_Permalink) : '';
    if (!translatedSlug && payload.core.title) {
      translatedSlug = sanitizeTranslatedSlug_(payload.core.title);
    }
    if (translatedSlug && englishSlug && translatedSlug === englishSlug && payload.core.title) {
      translatedSlug = sanitizeTranslatedSlug_(payload.core.title);
    }
    if (translatedSlug) {
      payload.core.slug = translatedSlug;
      log('TRANSLATED SLUG GENERATED: ' + translatedSlug);
    }
  }
  
  // 🆕 Use StatusWorkflow from Trips table (for migrated trips)
  if (tripFields.StatusWorkflow) {
    payload.core.status = tripFields.StatusWorkflow;
  }
  
  // 🆕 Use AI_Excerpt for WordPress Excerpt if available
  if (g.AI_Excerpt) {
    payload.core.excerpt = g.AI_Excerpt;
  } else if (g.AI_Short_Summary) {
    payload.core.excerpt = g.AI_Short_Summary;
  } else if (g.AI_Trip_Description) {
    var excerptCandidate = stripHtmlToText_Updater_(g.AI_Trip_Description);
    if (excerptCandidate && excerptCandidate.length > 160) {
      excerptCandidate = excerptCandidate.substring(0, 157).trim() + '...';
    }
    if (excerptCandidate) payload.core.excerpt = excerptCandidate;
  }

  if (payload.core.title) payload.title = payload.core.title;
  if (payload.core.slug) payload.slug = payload.core.slug;
  if (payload.core.excerpt) payload.excerpt = payload.core.excerpt;
  
  // --- RankMath SEO ---
  if (g.AI_SEO_Title) payload.meta.rank_math_title = g.AI_SEO_Title;
  if (g.AI_SEO_Meta_Description) payload.meta.rank_math_description = g.AI_SEO_Meta_Description;

  try {
    var seoFlags = upd_buildStrictFlags_Updater_(data, tripFields);
    if (payload.lang === 'en') {
      var storedH1 = String(g.AI_Titel_H1 || g.AI_Title_H1 || g['AI Title H1'] || g['AI Titel H1'] || '').trim();
      var usingStoredH1 = false;
      if (storedH1) {
        var safeH1 = upd_truncateAtWordBoundary_Updater_(upd_removeUnsupportedHighRiskParts_Updater_(storedH1, seoFlags), 90);
        if (safeH1) {
          payload.core.title = safeH1;
          usingStoredH1 = true;
        }
      }
      var baseTitleCandidate = String(g.AI_SEO_Title || payload.core.title || tripFields.Title || '').trim();
      var baseMetaCandidate = String(g.AI_SEO_Meta_Description || payload.meta.rank_math_description || '').trim();
      var snippet = upd_applySeoSnippetPolicy_Updater_(baseTitleCandidate, baseMetaCandidate, tripFields, seoFlags);
      if (!usingStoredH1 && snippet && snippet.h1) payload.core.title = snippet.h1;
      if (snippet && snippet.seo_title) payload.meta.rank_math_title = snippet.seo_title;
      if (snippet && snippet.meta_description) payload.meta.rank_math_description = snippet.meta_description;
      if (snippet && snippet.primary_keyword && (!payload.meta.rank_math_focus_keyword || !String(payload.meta.rank_math_focus_keyword).trim())) {
        payload.meta.rank_math_focus_keyword = snippet.primary_keyword;
      }
    }
    var civCtx = upd_isCivilizationMuseumContext_Updater_(
      payload.meta && payload.meta.rank_math_title ? payload.meta.rank_math_title : (payload.core ? payload.core.title : ''),
      (payload.core && payload.core.slug) ? payload.core.slug : (tripFields.Slug || g.AI_SEO_Permalink || ''),
      payload.meta && payload.meta.rank_math_description ? payload.meta.rank_math_description : ''
    );
    if (payload.core && Object.prototype.hasOwnProperty.call(payload.core, 'title') && payload.core.title) {
      var safeCoreTitle = upd_removeUnsupportedHighRiskParts_Updater_(payload.core.title, seoFlags);
      safeCoreTitle = String(safeCoreTitle || '').trim();
      safeCoreTitle = upd_normalizeMuseumEntityText_Updater_(safeCoreTitle, civCtx);
      if (safeCoreTitle) payload.core.title = safeCoreTitle; else delete payload.core.title;
    }
    if (payload.core && Object.prototype.hasOwnProperty.call(payload.core, 'excerpt') && payload.core.excerpt) {
      var safeExcerpt = upd_removeUnsupportedHighRiskParts_Updater_(payload.core.excerpt, seoFlags);
      safeExcerpt = upd_truncateText_Updater_(safeExcerpt, 240);
      if (safeExcerpt) payload.core.excerpt = safeExcerpt; else delete payload.core.excerpt;
    }
    if (payload.meta && Object.prototype.hasOwnProperty.call(payload.meta, 'rank_math_title') && payload.meta.rank_math_title) {
      var safeRmTitle = upd_removeUnsupportedHighRiskParts_Updater_(payload.meta.rank_math_title, seoFlags);
      safeRmTitle = String(safeRmTitle || '').trim();
      safeRmTitle = upd_normalizeMuseumEntityText_Updater_(safeRmTitle, civCtx);
      if (safeRmTitle) payload.meta.rank_math_title = safeRmTitle; else delete payload.meta.rank_math_title;
    }
    if (payload.meta && Object.prototype.hasOwnProperty.call(payload.meta, 'rank_math_description') && payload.meta.rank_math_description) {
      var safeRmDesc = upd_removeUnsupportedHighRiskParts_Updater_(payload.meta.rank_math_description, seoFlags);
      safeRmDesc = upd_finalizeSeoMetaDescription_Updater_(safeRmDesc, 160);
      safeRmDesc = upd_normalizeMuseumEntityText_Updater_(safeRmDesc, civCtx);
      if (safeRmDesc) payload.meta.rank_math_description = safeRmDesc; else delete payload.meta.rank_math_description;
    }
    if (payload.core && payload.core.title) payload.title = payload.core.title; else if (payload.title !== undefined) delete payload.title;
    if (payload.core && payload.core.excerpt) payload.excerpt = payload.core.excerpt; else if (payload.excerpt !== undefined) delete payload.excerpt;
  } catch (eSeoBeltMap) {}
  
  // Combine Focus Keyword and Keywords List (comma-separated) for RankMath
  var allKeywords = [];
  if (g.AI_SEO_FocusKeywords) allKeywords.push(g.AI_SEO_FocusKeywords);
  
  if (g.AI_SEO_FocusKeywords_List) {
    var list = g.AI_SEO_FocusKeywords_List;
    if (typeof list === 'string') {
        // If string, split and trim
        var parts = list.split(',').map(function(s){ return s.trim(); });
        parts.forEach(function(p){ if(p && allKeywords.indexOf(p) === -1) allKeywords.push(p); });
    } else if (Array.isArray(list)) {
        // If array, add unique items
        list.forEach(function(p){ 
           var s = String(p).trim();
           if(s && allKeywords.indexOf(s) === -1) allKeywords.push(s); 
        });
    }
  }
  
  if (allKeywords.length > 0) {
      payload.meta.rank_math_focus_keyword = allKeywords.join(', ');
  }
  
  // 🆕 TripCode for migrated trips
  if (tripCode) {
    payload.meta.trip_code = tripCode;
    if (payload.meta && payload.meta.wp_travel_engine_setting) {
      payload.meta.wp_travel_engine_setting.trip_code = tripCode;
    }
  }

  // 🆕 Force trip_duration_minutes in root meta to override WP calc
  if (dMinutes) {
    payload.meta.trip_duration_minutes = dMinutes;
    payload.meta.trip_duration_minute = dMinutes; // Fallback variant
  } else {
    // Explicitly set to 0 if no minutes to prevent ghost values
    payload.meta.trip_duration_minutes = 0;
    payload.meta.trip_duration_minute = 0;
  }
  
  // --- WP Travel Engine Settings ---
  var wte = payload.meta.wp_travel_engine_setting;

  // --- Duration Mapping (Direct) ---
  wte.trip_duration = dHours;
  wte.trip_duration_unit = dUnit;
  // Map explicit fields for safety
  wte.trip_duration_hours = dHours;
  wte.trip_duration_hour = dHours;
  wte.trip_duration_minutes = dMinutes;
  wte.trip_duration_minute = dMinutes;

  // --- CRITICAL AVAILABILITY FIX ---
  // Ensure the trip is bookable by default.
  // "No Fixed Departure Available" error appears if trip_fixed_dates is enabled but no dates exist.
  // We force it to 'no' (Open Availability) unless we actually have fixed dates.
  wte.trip_fixed_dates = 'no'; 
  wte.trip_cut_off_time = '0'; // No cutoff time
  wte.trip_min_pax = '1';
  wte.trip_max_pax = '100';
  wte.trip_price_display = 'from'; // Show "From $XXX"

  // Overview
  if (g.AI_Overview_Section_Title) wte.overview_section_title = g.AI_Overview_Section_Title;
  
  // Tab Content (Overview & Why People Love)
  wte.tab_content = {};
  if (g.AI_Trip_Description) wte.tab_content['1_wpeditor'] = dedupeRepeatedSectionIntroFromHtml_Updater_(g.AI_Overview_Section_Title || 'Overview', g.AI_Trip_Description); // Assuming 1 is Overview
  
  if (g.AI_Why_People_Love_This_Trip_Section_Title) wte.tab_8_title = g.AI_Why_People_Love_This_Trip_Section_Title;
  if (g.AI_Tab_Content) wte.tab_content['8_wpeditor'] = dedupeRepeatedSectionIntroFromHtml_Updater_(g.AI_Why_People_Love_This_Trip_Section_Title || 'Why People Love This Trip', g.AI_Tab_Content); // Assuming 8 is "Why People Love"

  var overviewHtml = (wte.tab_content && wte.tab_content['1_wpeditor']) ? wte.tab_content['1_wpeditor'] : '';
  if (overviewHtml) {
    payload.core.content = overviewHtml;
    payload.content = overviewHtml;
  }
  
  // Highlights
  if (g.AI_Trip_Highlights_Section_Title) wte.trip_highlights_title = g.AI_Trip_Highlights_Section_Title;
  if (data.highlights.length > 0) {
    wte.trip_highlights = data.highlights.map(function(rec) {
      return { highlight_text: rec.fields.AI_Highlight };
    });
  }
  
  // Cost (Includes/Excludes)
  if (g.AI_Cost_Section_Title) wte.cost.cost_section_title = g.AI_Cost_Section_Title;
  if (g.AI_Cost_Includes_Title) wte.cost.includes_title = g.AI_Cost_Includes_Title;
  if (g.AI_Cost_Excludes_Title) wte.cost.excludes_title = g.AI_Cost_Excludes_Title;
  
  if (data.includes.length > 0) {
    // WPTE expects a newline-separated string or array? 
    // JSON example shows: "Professional driver...\nHigh-quality..." (String with newlines)
    var addonNorms = (data.addons || []).map(function (r) {
      return r && r.fields ? String(r.fields.AI_AddOn_Title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
    }).filter(Boolean)
    var excludesLc = (data.excludes || []).map(function (r) {
      return r && r.fields ? String(r.fields.ExcludeItem || '').toLowerCase().replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
    }).join(' | ')
    var entranceExcluded = /\b(entrance fee|entrance fees|tickets?|admission)\b/.test(excludesLc)
    var evidenceLc = [
      String(g.AI_Trip_Description || ''),
      String(g.AI_Itinerary_Description || ''),
      (data.highlights || []).map(function (r) { return r && r.fields ? String(r.fields.AI_Highlight || '') : '' }).join(' | '),
      (data.itinerary || []).map(function (r) { return r && r.fields ? String(r.fields.AI_Step_Title || '') + ' ' + String(r.fields.AI_Step_Description || '') : '' }).join(' | ')
    ].join(' | ').toLowerCase()

    var safeIncludes = data.includes
      .map(function (r) { return r && r.fields ? String(r.fields.IncludeItem || '') : '' })
      .map(function (t) { return String(t || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() })
      .filter(function (t) {
        if (!t) return false
        var lc = t.toLowerCase()
        if (/^optional[:\s-]/i.test(t)) return false
        if (/\bif selected\b/.test(lc)) return false
        if (/\boptional add-?on\b/.test(lc)) return false
        if (/\[\s*optional\b/.test(lc)) return false
        if (entranceExcluded && /\b(entrance|admission|ticket|tickets|entrance fee|entrance fees)\b/.test(lc)) return false
        if (/\bnile\b/.test(lc) && evidenceLc.indexOf('nile') === -1) return false
        if (/\b(felucca|faluka)\b/.test(lc) && !/\b(felucca|faluka)\b/.test(evidenceLc)) return false
        if (/\bboat\b/.test(lc) && evidenceLc.indexOf('boat') === -1) return false
        if (/\bcruise\b/.test(lc) && evidenceLc.indexOf('cruise') === -1) return false
        if (upd_hasUnsupportedHighRiskClaims_Updater_(t, seoFlags)) return false
        if (addonNorms.length) {
          var k = lc.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
          for (var i = 0; i < addonNorms.length; i++) {
            var a = addonNorms[i]
            if (!a) continue
            if (k === a) return false
            if (k.indexOf(a) !== -1 || a.indexOf(k) !== -1) return false
          }
        }
        return true
      })

    wte.cost.cost_includes = safeIncludes.join('\n');
    wte.cost_includes = wte.cost.cost_includes;
  }
  if (data.excludes.length > 0) {
    wte.cost.cost_excludes = data.excludes.map(function(r){ return r.fields.ExcludeItem; }).join('\n');
    wte.cost_excludes = wte.cost.cost_excludes;
  }
  
  // FAQs
  if (g.AI_FAQ_Section_Title) wte.faq_section_title = g.AI_FAQ_Section_Title;
  if (data.faqs.length > 0) {
    wte.faq.faq_title = [];
    wte.faq.faq_content = [];
    wte.faq_title = [];
    wte.faq_content = [];
    data.faqs.forEach(function(rec) {
      var q0 = rec && rec.fields ? String(rec.fields.AI_Question || '').trim() : '';
      var a0 = rec && rec.fields ? String(rec.fields.AI_Answer || '') : '';
      a0 = upd_fixBrokenFaqText_Updater_(a0);
      a0 = upd_finalizeEntranceFeesFaqAnswer_Updater_(q0, a0, wte.cost.cost_includes || '', wte.cost.cost_excludes || '');
      wte.faq.faq_title.push(q0);
      wte.faq.faq_content.push(a0);
      wte.faq_title.push(q0);
      wte.faq_content.push(a0);
    });
  }
  
  // Itinerary
  // Note: JSON shows `trip_itinerary_title` (section title) vs `itinerary_title` (object of day titles)
  if (g.AI_Itinerary_Section_Title) wte.trip_itinerary_title = g.AI_Itinerary_Section_Title; 
  if (g.AI_Itinerary_Description) wte.trip_itinerary_description = dedupeRepeatedSectionIntroFromHtml_Updater_(g.AI_Itinerary_Section_Title || 'Itinerary', g.AI_Itinerary_Description);
  
  if (data.itinerary.length > 0) {
    wte.itinerary.itinerary_title = {};
    wte.itinerary.itinerary_days_label = {};
    wte.itinerary.itinerary_content = {};
    // wte.itinerary.itinerary_duration = {}; // If supported
    wte.trip_itinerary = [];
    
    data.itinerary.forEach(function(rec, index) {
      // WPTE usually uses 0-based or 1-based index keys. JSON example uses "1", "2".
      // Let's assume 1-based index matching the day number or step order.
      var key = String(index + 1); 
      
      wte.itinerary.itinerary_title[key] = rec.fields.AI_Step_Title;
      wte.itinerary.itinerary_days_label[key] = rec.fields.AI_Step_Label || ('Day ' + key);
      wte.itinerary.itinerary_content[key] = rec.fields.AI_Step_Description;
      wte.trip_itinerary.push({
        title: rec.fields.AI_Step_Title || '',
        content: rec.fields.AI_Step_Description || ''
      });
    });
  }
  
  // Trip Facts - Use Golden Template Structure
  if (g.AI_Trip_Facts_Section_Title) wte.trip_facts_title = g.AI_Trip_Facts_Section_Title;
  
  // Load the golden template structure (WordPress-compatible format)
  var template = loadTripFactsTemplate_Updater_();
  
  // Start with empty structure (populate strictly from Airtable to avoid merging duplicates)
  wte.trip_facts = {
    field_id: {},
    field_type: {}
  };
  
  // Update values from Airtable enhanced data
  if (data.facts.length > 0) {
    data.facts.forEach(function(rec) {
      var factLabel = rec.fields.AI_Fact_Label;
      var factLabelForDisplay = rec.fields.AI_Fact_Label_Localized || factLabel;
      var factValue = rec.fields.AI_Fact_Value;
      var airtableFactId = rec.fields.AI_Fact_ID; // WordPress FactID stored in Airtable
      
      if (factLabel && factValue) {
        // Find the FactID from label mapping
        var factId = template.mapping[factLabel];
        
        // If we have AI_Fact_ID from Airtable, use it (more reliable)
        if (airtableFactId) {
          factId = airtableFactId;
          log('Updater: Using AI_Fact_ID from Airtable: ' + airtableFactId + ' for "' + factLabel + '"');
        }
        
        if (factId && wte.trip_facts[factId]) {
          // Update the value in template structure
          wte.trip_facts[factId][factId] = factValue;
          log('Updater: Mapped fact "' + factLabel + '" (' + factId + ') = "' + factValue + '"');
        } else if (factId) {
          // FactID not in template - add it dynamically
          log('Updater: Adding new fact "' + factLabel + '" (' + factId + ') to template');
          wte.trip_facts[factId] = {};
          wte.trip_facts[factId][factId] = factValue;
          wte.trip_facts.field_id[factId] = factLabelForDisplay;
          wte.trip_facts.field_type[factId] = 'text';
        } else {
          log('Updater: WARNING - Unknown fact label "' + factLabel + '" - skipping');
        }
      } else {
        log('Updater: WARNING - Fact missing label or value: ' + JSON.stringify(rec.fields));
      }
    });
  }
  
  log('Updater: Trip Facts structure ready with ' + Object.keys(wte.trip_facts).length + ' fields');
  
  // AddOns (Extra Services)
  if (data.addons.length > 0) {
    var serviceIds = [];
    wte.trip_extra_services = data.addons.map(function(rec) {
      var price = rec.fields.AI_AddOn_Price || 0;
      var desc = rec.fields.AI_AddOn_Description || "";
      
      var addon = {
        label: rec.fields.AI_AddOn_Title,
        type: "Default",
        prices: [ price ], // Simple array: [10]
        descriptions: [ desc ], // Simple array: ["text"]
        options: [""] 
      };
      
      if (rec.fields.AddOnID) {
        addon.id = rec.fields.AddOnID;
        serviceIds.push(addon.id);
      }
      
      return addon;
    });
    
    // Set the comma-separated string of active service IDs
    if (serviceIds.length > 0) {
      wte.wte_services_ids = serviceIds.join(',');
    }
  }
  
  // --- Advanced Itinerary (Duration, Meals) ---
  // This is a separate meta field: wte_advanced_itinerary
  if (data.itinerary.length > 0) {
    payload.meta.wte_advanced_itinerary = {
      advanced_itinerary: {
        itinerary_duration: {},
        itinerary_duration_type: {},
        meals_included: []
      }
    };
    
    var advItinerary = payload.meta.wte_advanced_itinerary.advanced_itinerary;
    
    // Build meals_included object (keyed by day number)
    var mealsIncluded = {};
    
    data.itinerary.forEach(function(rec, index) {
      var key = String(index + 1);
      
      // Duration Value (e.g., "4", "8")
      if (rec.fields.AI_Duration_Value) {
        advItinerary.itinerary_duration[key] = String(rec.fields.AI_Duration_Value);
      }
      
      // Duration Type (e.g., "hours", "days", "minutes")
      if (rec.fields.AI_Duration_Unit) {
        // Convert plural to singular if needed (WordPress uses singular)
        var unit = rec.fields.AI_Duration_Unit.toLowerCase();
        if (unit === 'hours') unit = 'hour';
        if (unit === 'days') unit = 'day';
        if (unit === 'minutes') unit = 'minute';
        advItinerary.itinerary_duration_type[key] = unit;
      }
      
      // Meals Included
      // AI_Meals_Included can be:
      // - Multiple Select (array): ["Breakfast", "Lunch"]
      // - Single Line Text: "Breakfast, Lunch"
      // - Single Select: "Breakfast"
      if (rec.fields.AI_Meals_Included) {
        var meals = rec.fields.AI_Meals_Included;
        
        // If it's a string, split by comma
        if (typeof meals === 'string') {
          meals = meals.split(',').map(function(m) { return m.trim(); });
        }
        
        // If it's already an array, convert to lowercase
        if (Array.isArray(meals) && meals.length > 0) {
          // WordPress expects lowercase keys: breakfast, lunch, dinner
          mealsIncluded[key] = meals.map(function(m) { 
            return m.toLowerCase(); 
          });
        }
      }
    });
    
    // Set meals_included (WordPress expects object keyed by day, or array)
    // Based on the JSON structure, it seems to be an object
    advItinerary.meals_included = mealsIncluded;
  }
  
  try {
    payload.meta = payload.meta || {};
    var langNow = String(payload && payload.lang ? payload.lang : '').toLowerCase()
    var isEn = (!langNow || langNow === 'en')
    function pickScalar_(v) {
      if (!v) return ''
      if (Array.isArray(v)) return v[0] != null ? String(v[0]) : ''
      if (typeof v === 'object') return String(v)
      return String(v)
    }
    function cleanText_(s) { return String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() }

    var tripTitle = String(payload.core && payload.core.title ? payload.core.title : '').trim()
    var strict = upd_buildStrictFlags_Updater_(data, null)
    var schemaSeoTitleRaw = tripTitle || pickScalar_(g.AI_SEO_Title) || pickScalar_(payload.meta.rank_math_title)
    var schemaSeoDescRaw =
      pickScalar_(g.AI_Short_Summary) ||
      pickScalar_(g.AI_Excerpt) ||
      pickScalar_(g.AI_Trip_Description) ||
      pickScalar_(g.AI_SEO_Meta_Description) ||
      pickScalar_(payload.meta.rank_math_description) ||
      ''
    var slugNow = String((payload.core && payload.core.slug) ? payload.core.slug : (g && (g.Slug || g.slug) ? (g.Slug || g.slug) : '')).trim()
    var civCtx = upd_isCivilizationMuseumContext_Updater_(schemaSeoTitleRaw, slugNow, schemaSeoDescRaw)

    var schemaSeoTitle = upd_normalizeMuseumEntityText_Updater_(cleanText_(schemaSeoTitleRaw), civCtx)
    var schemaSeoDesc = upd_normalizeMuseumEntityText_Updater_(cleanText_(schemaSeoDescRaw), civCtx)
    schemaSeoDesc = upd_removeUnsupportedHighRiskParts_Updater_(schemaSeoDesc, strict)
    if (schemaSeoDesc) schemaSeoDesc = upd_finalizeSeoMetaDescription_Updater_(schemaSeoDesc, 240)

    if (isEn) {
      var titleSrc = tripTitle ? 'core.title' : (g.AI_SEO_Title ? 'AI_SEO_Title' : (payload.meta.rank_math_title ? 'rank_math_title' : 'missing'))
      var descSrc =
        g.AI_Short_Summary ? 'AI_Short_Summary' :
        (g.AI_Excerpt ? 'AI_Excerpt' :
        (g.AI_Trip_Description ? 'AI_Trip_Description' :
        (g.AI_SEO_Meta_Description ? 'AI_SEO_Meta_Description' :
        (payload.meta.rank_math_description ? 'rank_math_description' : 'missing'))))
      log('SCHEMA SOURCE RESOLVED (en, TouristTrip meta): title=' + titleSrc + ' desc=' + descSrc)
      if (payload.meta.rank_math_description && (g.AI_Short_Summary || g.AI_Excerpt || g.AI_Trip_Description)) log('SCHEMA BYPASSED STALE FALLBACK (en, TouristTrip)')
    }

    var existingTripSchemaRaw = pickScalar_(payload.meta.trip_schema_data || payload.meta.schema_trip_data)
    var tripSchemaObj = null
    if (existingTripSchemaRaw) {
      try { tripSchemaObj = JSON.parse(existingTripSchemaRaw) } catch (e) {}
    }
    if (!tripSchemaObj || typeof tripSchemaObj !== 'object') {
      tripSchemaObj = { "@context": "https://schema.org", "@type": "TouristTrip" }
    }
    if (schemaSeoTitle) tripSchemaObj.name = schemaSeoTitle
    if (schemaSeoDesc) tripSchemaObj.description = schemaSeoDesc
    try {
      if (strict && strict.has_nile === false) {
        tripSchemaObj = upd_removeDisallowedPlacesFromTripSchema_Updater_(tripSchemaObj, ['Nile'])
      }
    } catch {}
    Object.keys(tripSchemaObj).forEach(function(k) { if (tripSchemaObj[k] === undefined) delete tripSchemaObj[k]; })
    payload.meta.trip_schema_data = JSON.stringify(tripSchemaObj)
    payload.meta.schema_trip_data = payload.meta.trip_schema_data

    if (!payload.meta.faq_schema_data && data.faqs && data.faqs.length) {
      var mainEntity = [];
      var costIncText = (wte && wte.cost && wte.cost.cost_includes) ? String(wte.cost.cost_includes) : '';
      var costExcText = (wte && wte.cost && wte.cost.cost_excludes) ? String(wte.cost.cost_excludes) : '';
      data.faqs.forEach(function(rec) {
        var q = String(rec && rec.fields && rec.fields.AI_Question ? rec.fields.AI_Question : '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        var a = String(rec && rec.fields && rec.fields.AI_Answer ? rec.fields.AI_Answer : '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (!q || !a) return;
        var qaLc = (q + ' ' + a).toLowerCase()
        if (/\b(cancel|cancellation|refund|refundable)\b/.test(qaLc)) return;
        q = upd_normalizeMuseumEntityText_Updater_(q, civCtx)
        a = upd_normalizeMuseumEntityText_Updater_(a, civCtx)
        a = upd_fixBrokenFaqText_Updater_(a)
        a = upd_finalizeEntranceFeesFaqAnswer_Updater_(q, a, costIncText, costExcText)
        a = upd_removeUnsupportedHighRiskParts_Updater_(a, strict)
        if (!q || !a) return;
        mainEntity.push({ "@type": "Question", "name": q, "acceptedAnswer": { "@type": "Answer", "text": a } });
      });
      if (mainEntity.length) {
        var faqSchema = {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": mainEntity,
          "name": schemaSeoTitle || undefined,
          "description": schemaSeoDesc || undefined
        };
        Object.keys(faqSchema).forEach(function(k) { if (faqSchema[k] === undefined) delete faqSchema[k]; });
        payload.meta.faq_schema_data = JSON.stringify(faqSchema);
        if (isEn) log('SCHEMA SOURCE RESOLVED (en, FAQPage meta): title=' + (payload.meta.rank_math_title ? 'rank_math_title' : (g.AI_SEO_Title ? 'AI_SEO_Title' : 'missing')) + ' desc=' + (payload.meta.rank_math_description ? 'rank_math_description' : (g.AI_SEO_Meta_Description ? 'AI_SEO_Meta_Description' : 'missing')))
      }
    }
  } catch (eSchema) {}

  return payload;
}

function upd_removeDisallowedPlacesFromTripSchema_Updater_(schemaObj, disallowedNames) {
  var o = schemaObj
  if (!o || typeof o !== 'object') return o
  var dis = {}
  if (Array.isArray(disallowedNames)) {
    disallowedNames.forEach(function(n) {
      var k = String(n || '').trim().toLowerCase()
      if (k) dis[k] = true
    })
  }
  if (!Object.keys(dis).length) return o

  function isDisallowedName_(name) {
    var k = String(name || '').trim().toLowerCase()
    return !!(k && dis[k])
  }

  function getPlaceName_(node) {
    if (!node) return ''
    if (typeof node === 'string') return node
    if (typeof node !== 'object') return ''
    if (node.name) return String(node.name)
    if (node.item && node.item.name) return String(node.item.name)
    return ''
  }

  var it = o.itinerary
  if (!it) return o

  if (typeof it === 'object' && it['@type'] === 'Place') {
    var nm0 = getPlaceName_(it)
    if (isDisallowedName_(nm0)) delete o.itinerary
    return o
  }

  if (typeof it === 'object' && it['@type'] === 'ItemList' && Array.isArray(it.itemListElement)) {
    var kept = []
    for (var i = 0; i < it.itemListElement.length; i++) {
      var el = it.itemListElement[i]
      var nm = getPlaceName_(el && el.item ? el.item : el)
      if (isDisallowedName_(nm)) continue
      kept.push(el)
    }
    if (!kept.length) {
      delete o.itinerary
      return o
    }
    for (var j = 0; j < kept.length; j++) {
      if (kept[j] && typeof kept[j] === 'object') kept[j].position = j + 1
    }
    o.itinerary.itemListElement = kept
    return o
  }

  return o
}

function upd_buildStrictFlags_Updater_(data, tripFields) {
  var d = data || {};
  var tf = tripFields || {};
  function norm_(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function stripHtml_(s) { return norm_(String(s || '').replace(/<[^>]*>/g, ' ')); }
  var parts = [];
  parts.push(stripHtml_(tf.Title || ''));
  if (d.tripDetails && d.tripDetails.TourType) parts.push(stripHtml_(d.tripDetails.TourType));
  if (Array.isArray(d.highlights)) {
    d.highlights.forEach(function(rec) {
      var t = rec && rec.fields ? rec.fields.AI_Highlight : '';
      t = stripHtml_(t);
      if (t) parts.push(t);
    });
  }
  if (Array.isArray(d.itinerary)) {
    d.itinerary.forEach(function(rec) {
      var f = (rec && rec.fields) ? rec.fields : {};
      var t = stripHtml_(f.AI_Step_Title || '');
      var x = stripHtml_(f.AI_Step_Description || '');
      var l = stripHtml_(f.AI_Step_Label || '');
      if (t) parts.push(t);
      if (l) parts.push(l);
      if (x) parts.push(x);
    });
  }
  if (Array.isArray(d.includes)) {
    d.includes.forEach(function(rec) {
      var t = rec && rec.fields ? rec.fields.IncludeItem : '';
      t = stripHtml_(t);
      if (t) parts.push(t);
    });
  }
  if (Array.isArray(d.excludes)) {
    d.excludes.forEach(function(rec) {
      var t = rec && rec.fields ? rec.fields.ExcludeItem : '';
      t = stripHtml_(t);
      if (t) parts.push(t);
    });
  }
  var lc = norm_(parts.filter(Boolean).join(' | ')).toLowerCase();
  return {
    has_nile: /\bnile\b/.test(lc),
    has_felucca: /\b(felucca|faluka)\b/.test(lc),
    has_boat: /\bboat\b/.test(lc),
    has_cruise: /\bcruise\b/.test(lc),
    has_flights: /\b(flight|flights|airfare|air ticket|air tickets)\b/.test(lc),
    has_snorkel: /\b(snorkel|snorkeling|diving)\b/.test(lc),
    has_safari: /\b(safari|quad|atv)\b/.test(lc),
    has_private: /\bprivate\b/.test(lc),
    has_tickets: /\b(ticket|tickets|admission|entrance fee|entrance fees)\b/.test(lc),
    has_lunch: /\blunch\b/.test(lc),
    has_pickup: /\b(pick-?up|hotel pick-?up|pickup)\b/.test(lc)
  };
}

function upd_hasUnsupportedHighRiskClaims_Updater_(text, flags) {
  var t = String(text || '').toLowerCase();
  var f = (flags && typeof flags === 'object') ? flags : {};
  if (!f.has_nile && /\bnile\b/.test(t)) return true;
  if (!f.has_felucca && /\b(felucca|faluka)\b/.test(t)) return true;
  if (!f.has_boat && /\bboat\b/.test(t)) return true;
  if (!f.has_cruise && /\bcruise\b/.test(t)) return true;
  if (!f.has_flights && /\b(flight|flights|airfare|air ticket|air tickets)\b/.test(t)) return true;
  if (!f.has_snorkel && /\b(snorkel|snorkeling|diving)\b/.test(t)) return true;
  if (!f.has_safari && /\b(safari|quad|atv)\b/.test(t)) return true;
  if (!f.has_private && /\bprivate\b/.test(t)) return true;
  if (!f.has_tickets && /\b(ticket|tickets|admission|entrance fee|entrance fees)\b/.test(t)) return true;
  if (!f.has_lunch && /\blunch\b/.test(t)) return true;
  if (!f.has_pickup && /\b(pick-?up|hotel pick-?up|pickup)\b/.test(t)) return true;
  return false;
}

function upd_fixBrokenFaqText_Updater_(text) {
  var s = String(text || '');
  if (!s.trim()) return '';
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/,\s*a,\s*(and\s+)?/gi, ', ');
  s = s.replace(/,\s*,+/g, ', ');
  s = s.replace(/\s+,/g, ',');
  s = s.replace(/,\s+and\s+,/gi, ' and ');
  s = s.replace(/,\s*and\s*([.?!;:])/g, '$1');
  s = s.replace(/\(\s*\)/g, '');
  s = s.replace(/\s+([.?!;:])/g, '$1');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function upd_finalizeEntranceFeesFaqAnswer_Updater_(question, answer, includesText, excludesText) {
  var qRaw = String(question || '');
  var q = qRaw.toLowerCase();
  var a = String(answer || '').trim();
  if (!a) return '';
  var inc = String(includesText || '').toLowerCase();
  var exc = String(excludesText || '').toLowerCase();
  var incHas = /\b(entrance|admission|ticket|tickets|entrance fee|entrance fees)\b/.test(inc) && !/\b(not included|excluded)\b/.test(inc);
  var excHas = /\b(entrance|admission|ticket|tickets|entrance fee|entrance fees)\b/.test(exc);
  var mentionsEntranceInQ = /\b(entrance fee|entrance fees|admission|ticket|tickets)\b/.test(q);
  if (!mentionsEntranceInQ) return a;
  var isDecision = /\b(included|not included|cover|covered|pay|pay for|need to pay|extra charge|additional cost)\b/.test(q);
  if (/\b(cash|money|bring|what to bring|tips?|gratuities|extras)\b/.test(q)) isDecision = false;
  if (isDecision) {
    if (excHas && !incHas) return "No. Attraction entrance fees are not included as listed in What's Excluded.";
    if (incHas && !excHas) return "Yes. Attraction entrance fees are included as listed in What's Included.";
    return "Please refer to the What's Included/Excluded section for whether attraction entrance fees are covered for your selected option.";
  }
  if (excHas && !incHas) {
    return a
      .replace(/\b(all\s+)?entrance\s+(tickets|fees)\s+are\s+included\b/ig, "entrance fees are not included")
      .replace(/\b(admission|tickets?)\s+are\s+included\b/ig, "$1 are not included")
      .trim();
  }
  if (incHas && !excHas) {
    return a
      .replace(/\b(entrance\s+(tickets|fees)|admission|tickets?)\s+are\s+not\s+included\b/ig, "entrance fees are included")
      .trim();
  }
  return a;
}

function upd_isWeakMetaEnding_Updater_(s) {
  var t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return true;
  t = t.replace(/[.!?]+$/g, '').trim();
  if (!t) return true;
  var lc = t.toLowerCase();
  if (/\b(with|and|or|but|for|to|from|of|in|on|at|by|a|an|the)\b\s*$/.test(lc)) return true;
  if (/\bwith\s+(?:a|an|the|your|our)\b\s*$/.test(lc)) return true;
  return false;
}

function upd_trimToLastSentence_Updater_(s, maxLen) {
  var t = String(s || '').replace(/\s+/g, ' ').trim();
  var n = Number(maxLen || 0);
  if (!t) return '';
  if (n > 0 && t.length > n) t = t.substring(0, n + 1);
  var last = Math.max(t.lastIndexOf('.'), t.lastIndexOf('!'), t.lastIndexOf('?'));
  if (last < 0) return '';
  return t.substring(0, last + 1).trim();
}

function upd_finalizeSeoMetaDescription_Updater_(s, maxLen) {
  var t = String(s || '').replace(/\s+/g, ' ').trim();
  var n = Number(maxLen || 0);
  if (!t) return '';
  if (n > 0 && t.length > n) t = upd_truncateAtWordBoundary_Updater_(t, n);
  t = t.replace(/\s+([,.;!?])/g, '$1');
  t = t.replace(/,\s*([.!?])/g, '$1');
  t = t.replace(/([.!?])\s*,/g, '$1');
  t = t.replace(/\.{2,}/g, '.').replace(/!{2,}/g, '!').replace(/\?{2,}/g, '?');
  t = t.replace(/\s*\.\s*\./g, '.').replace(/\s*,\s*,/g, ',');
  t = t.replace(/\s+,/g, ',');
  t = t.replace(/\s*[|—–\-:;,]+\s*$/g, '').trim();
  var guard = 0;
  while (guard < 6 && upd_isWeakMetaEnding_Updater_(t)) {
    t = t.replace(/\s*[|—–\-:;,]+\s*$/g, '').trim();
    t = t.replace(/\b(?:and|or|but|with|for|to|from|of|in|on|at|by|a|an|the)\b[\s.]*$/i, '').trim();
    guard++;
  }
  if (upd_isWeakMetaEnding_Updater_(t)) {
    var sentence = upd_trimToLastSentence_Updater_(s, n);
    if (sentence) t = sentence;
  }
  if (n > 0 && t.length > n) t = upd_truncateAtWordBoundary_Updater_(t, n);
  if (t && !/[.!?]$/.test(t) && (!n || t.length <= (n - 1))) t = (t + '.').trim();
  if (n > 0 && t.length > n) t = upd_truncateAtWordBoundary_Updater_(t, n);
  return t;
}

function upd_isCivilizationMuseumContext_Updater_(title, slug, meta) {
  var s = String(slug || '').toLowerCase();
  var t = String(title || '').toLowerCase();
  var m = String(meta || '').toLowerCase();
  if (s && s.indexOf('civilization') !== -1 && s.indexOf('museum') !== -1) return true;
  if (t.indexOf('civilization museum') !== -1 || /\bnmec\b/.test(t)) return true;
  if (m.indexOf('civilization museum') !== -1) return true;
  if (m.indexOf('national museum of egyptian civilization') !== -1) return true;
  return false;
}

function upd_normalizeMuseumEntityText_Updater_(text, isCivilizationContext) {
  var s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (!isCivilizationContext) return s;
  if (/egyptian civilization museum/i.test(s)) return s;
  if (/museum of egyptian civilization/i.test(s)) return s;
  if (/\bnmec\b/i.test(s)) return s;
  if (/\bcivilization museum\b/i.test(s) && !/\begyptian\b/i.test(s)) {
    s = s.replace(/\bCivilization Museum\b/gi, 'Egyptian Civilization Museum');
  }
  return s.replace(/\bEgyptian Museum\b/gi, 'Egyptian Civilization Museum');
}

function upd_truncateText_Updater_(s, maxLen) {
  var t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (!maxLen || t.length <= maxLen) return t;
  var cut = t.slice(0, maxLen);
  var lastSpace = cut.lastIndexOf(' ');
  if (lastSpace >= 80) return cut.slice(0, lastSpace).trim().replace(/[,\-–—:;]\s*$/g, '');
  return cut.trim().replace(/[,\-–—:;]\s*$/g, '');
}

function upd_removeUnsupportedHighRiskParts_Updater_(text, flags) {
  var t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (!upd_hasUnsupportedHighRiskClaims_Updater_(t, flags)) return t;
  var parts = t
    .split(/[|•]|(?:\s+[–—-]\s+)|(?:\s*;\s*)|[.!?]\s+/)
    .map(function(x) { return String(x || '').trim(); })
    .filter(Boolean);
  var kept = [];
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if (upd_hasUnsupportedHighRiskClaims_Updater_(p, flags)) continue;
    kept.push(p);
  }
  var out = kept.join('. ').replace(/\s+/g, ' ').trim();
  out = out.replace(/^(and|with|including|plus|also)\b\s*/i, '');
  out = out.replace(/[,\-–—:;]\s*$/g, '').trim();
  return out;
}

function upd_truncateAtWordBoundary_Updater_(s, maxLen) {
  var t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (!maxLen || t.length <= maxLen) return t;
  var cut = t.slice(0, maxLen);
  var lastSpace = cut.lastIndexOf(' ');
  if (lastSpace >= Math.floor(maxLen * 0.6)) return cut.slice(0, lastSpace).trim().replace(/[,\-–—:;]\s*$/g, '');
  return cut.trim().replace(/[,\-–—:;]\s*$/g, '');
}

function upd_joinListWithAmp_Updater_(items) {
  var xs = (Array.isArray(items) ? items : []).map(function(x) { return String(x || '').trim(); }).filter(Boolean);
  if (xs.length <= 1) return xs.join('');
  if (xs.length === 2) return xs[0] + ' & ' + xs[1];
  return xs.slice(0, xs.length - 1).join(', ') + ' & ' + xs[xs.length - 1];
}

function upd_extractPrimaryKeywordFromTitle_Updater_(title) {
  var t = String(title || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  var candidates = [];
  if (t.indexOf(':') !== -1) candidates.push(String(t.split(':')[0] || '').trim());
  if (t.indexOf(' - ') !== -1) candidates.push(String(t.split(' - ')[0] || '').trim());
  if (t.indexOf(' | ') !== -1) candidates.push(String(t.split(' | ')[0] || '').trim());
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    if (!c) continue;
    if (/\b(tour|trip|cruise|package)\b/i.test(c) && c.length >= 8 && c.length <= 40) return c;
  }
  return '';
}

function upd_extractAttractionsFromTitle_Updater_(title) {
  var t = String(title || '').replace(/\s+/g, ' ').trim();
  if (!t) return [];
  var rhs = t;
  if (t.indexOf(':') !== -1) rhs = String(t.split(':').slice(1).join(':') || '').trim();
  rhs = rhs.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  rhs = rhs.replace(/\s*&\s*/g, ', ').replace(/\s+and\s+/gi, ', ');
  rhs = rhs.replace(/\s*\+\s*/g, ' ').replace(/\s+/g, ' ').trim();
  var parts = rhs.split(',').map(function(x) { return String(x || '').trim(); }).filter(Boolean);
  var seen = {};
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if (!p) continue;
    if (p.length > 48) continue;
    if (/\blunch\b/i.test(p)) continue;
    if (/\bhotel\s+pick\s*-?\s*up\b/i.test(p)) continue;
    if (/\bpick\s*-?\s*up\b/i.test(p)) continue;
    if (/\bpickup\b/i.test(p)) continue;
    var key = p.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    out.push(p);
    if (out.length >= 3) break;
  }
  return out;
}

function upd_shortenAttractionForSeoTitle_Updater_(s) {
  var t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (/\b(nmec|egyptian civilization museum|museum of egyptian civilization|national museum of egyptian civilization|civilization museum)\b/i.test(t)) {
    return 'Egyptian Civilization Museum';
  }
  t = t.replace(/\b(egyptian|national)\b/ig, '').replace(/\s+/g, ' ').trim();
  t = t.replace(/\bmuseum of\b/ig, 'Museum').replace(/\s+/g, ' ').trim();
  if (t.length > 26) t = upd_truncateAtWordBoundary_Updater_(t, 26);
  return t;
}

function upd_buildUspText_Updater_(flags) {
  var f = (flags && typeof flags === 'object') ? flags : {};
  if (f.has_lunch && f.has_pickup) return 'Lunch & Hotel Pickup Included';
  if (f.has_lunch) return 'Lunch Included';
  if (f.has_pickup) return 'Hotel Pickup Included';
  if (f.has_private) return 'Private Tour';
  if (f.has_tickets) return 'Entry Fees Included';
  return '';
}

function upd_buildUspShort_Updater_(flags) {
  var f = (flags && typeof flags === 'object') ? flags : {};
  if (f.has_lunch) return 'Lunch';
  if (f.has_pickup) return 'Pickup';
  if (f.has_private) return 'Private';
  if (f.has_tickets) return 'Tickets';
  return '';
}

function upd_formatFromPrice_Updater_(tripFields) {
  var f = (tripFields && typeof tripFields === 'object') ? tripFields : {};
  var raw = f.Price_From || f.PriceFrom || f.price_from || f['Price From'] || '';
  var n = Number(raw);
  if (!isFinite(n) || n <= 0) return '';
  var currency = String(f.Currency || f.currency || f.Currency_Code || f['Currency Code'] || '').trim().toUpperCase();
  var symbol = '';
  if (currency === 'USD') symbol = '$';
  else if (currency === 'EUR') symbol = '€';
  else if (currency === 'GBP') symbol = '£';
  else if (currency === 'AED') symbol = 'AED ';
  else if (currency) symbol = currency + ' ';
  var v = Math.round(n) === n ? String(Math.round(n)) : String(n.toFixed(2)).replace(/\.00$/g, '');
  return symbol + v;
}

function upd_applySeoSnippetPolicy_Updater_(baseTitle, baseMeta, tripFields, seoFlags) {
  var title = upd_removeUnsupportedHighRiskParts_Updater_(String(baseTitle || '').replace(/\s+/g, ' ').trim(), seoFlags);
  var primary = upd_extractPrimaryKeywordFromTitle_Updater_(title) || title;
  var attractions = upd_extractAttractionsFromTitle_Updater_(title);
  var usp = upd_buildUspText_Updater_(seoFlags);
  var uspShort = upd_buildUspShort_Updater_(seoFlags);
  var price = upd_formatFromPrice_Updater_(tripFields);

  var h1Attractions = attractions.slice(0, 3);
  var h1 = primary;
  if (h1Attractions.length) h1 = primary + ': ' + upd_joinListWithAmp_Updater_(h1Attractions);
  if (usp) {
    var withUsp = h1 + ' (' + usp + ')';
    if (withUsp.length <= 90) h1 = withUsp;
  }
  if (h1.length > 90) h1 = upd_truncateAtWordBoundary_Updater_(h1, 90);

  var seoTitle = primary;
  var seoAtts = attractions.slice(0, 2).map(upd_shortenAttractionForSeoTitle_Updater_).filter(Boolean);
  if (seoAtts.length) seoTitle = primary + ': ' + upd_joinListWithAmp_Updater_(seoAtts);
  if (uspShort) seoTitle = seoTitle + ' + ' + uspShort;
  seoTitle = upd_truncateAtWordBoundary_Updater_(seoTitle, 60);

  var metaRaw = String(baseMeta || '').replace(/\s+/g, ' ').trim();
  if (metaRaw && upd_isWeakMetaEnding_Updater_(metaRaw) && !/[.!?]/.test(metaRaw)) metaRaw = '';
  var meta = '';
  if (metaRaw) {
    meta = upd_finalizeSeoMetaDescription_Updater_(upd_removeUnsupportedHighRiskParts_Updater_(metaRaw, seoFlags), 155);
  } else {
    var metaAtts = attractions.slice(0, 3);
    var s1 = primary + (metaAtts.length ? ': ' + upd_joinListWithAmp_Updater_(metaAtts) + '.' : '.');
    var s2 = usp ? (usp + '.') : '';
    var s3 = 'Plan your day easily.';
    var s4 = price ? ('From ' + price + '.') : '';
    var s5 = 'Reserve now.';
    meta = [s1, s2, s3, s4, s5].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (meta.length > 155) {
      s3 = '';
      meta = [s1, s2, s4, s5].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    }
    if (meta.length > 155) {
      metaAtts = attractions.slice(0, 2);
      s1 = primary + (metaAtts.length ? ': ' + upd_joinListWithAmp_Updater_(metaAtts) + '.' : '.');
      meta = [s1, s2, s4, s5].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    }
    if (meta.length > 155) {
      s2 = '';
      meta = [s1, s4, s5].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    }
    if (meta.length > 155) meta = upd_truncateAtWordBoundary_Updater_(meta, 155);
    if (meta.length < 140) {
      var pad = 'Book online in minutes.';
      var meta2 = (meta + ' ' + pad).replace(/\s+/g, ' ').trim();
      if (meta2.length <= 155) meta = meta2;
    }
    meta = upd_finalizeSeoMetaDescription_Updater_(meta, 155);
  }

  return {
    h1: h1,
    seo_title: seoTitle,
    meta_description: meta,
    primary_keyword: primary
  };
}

function upd_applyFinalSeoSafetyBelt_Updater_(payload, data, tripFields) {
  if (!payload || typeof payload !== 'object') return payload;
  var flags = upd_buildStrictFlags_Updater_(data, tripFields);
  var safeTitle = '';
  var safeDesc = '';

  try {
    if (payload.core && Object.prototype.hasOwnProperty.call(payload.core, 'title') && payload.core.title) {
      safeTitle = String(upd_removeUnsupportedHighRiskParts_Updater_(payload.core.title, flags) || '').trim();
      if (safeTitle) payload.core.title = safeTitle; else delete payload.core.title;
    }
    if (payload.meta && Object.prototype.hasOwnProperty.call(payload.meta, 'rank_math_title') && payload.meta.rank_math_title) {
      var t1 = String(upd_removeUnsupportedHighRiskParts_Updater_(payload.meta.rank_math_title, flags) || '').trim();
      if (t1) payload.meta.rank_math_title = t1; else delete payload.meta.rank_math_title;
      if (!safeTitle && t1) safeTitle = t1;
    }
    if (payload.title !== undefined) {
      var t2 = String(upd_removeUnsupportedHighRiskParts_Updater_(payload.title, flags) || '').trim();
      if (t2) payload.title = t2; else delete payload.title;
      if (!safeTitle && t2) safeTitle = t2;
    }

    if (payload.meta && Object.prototype.hasOwnProperty.call(payload.meta, 'rank_math_description') && payload.meta.rank_math_description) {
      var civCtx = upd_isCivilizationMuseumContext_Updater_(
        (payload.meta && payload.meta.rank_math_title) ? payload.meta.rank_math_title : safeTitle,
        (payload.core && payload.core.slug) ? payload.core.slug : (payload.slug || ''),
        payload.meta.rank_math_description
      );
      safeDesc = upd_finalizeSeoMetaDescription_Updater_(upd_removeUnsupportedHighRiskParts_Updater_(payload.meta.rank_math_description, flags), 160);
      safeDesc = upd_normalizeMuseumEntityText_Updater_(safeDesc, civCtx);
      if (safeDesc) payload.meta.rank_math_description = safeDesc; else delete payload.meta.rank_math_description;
    }
    if (payload.core && Object.prototype.hasOwnProperty.call(payload.core, 'excerpt') && payload.core.excerpt) {
      var ex = upd_truncateText_Updater_(upd_removeUnsupportedHighRiskParts_Updater_(payload.core.excerpt, flags), 240);
      if (ex) payload.core.excerpt = ex; else delete payload.core.excerpt;
    }
    if (payload.excerpt !== undefined) {
      var ex2 = upd_truncateText_Updater_(upd_removeUnsupportedHighRiskParts_Updater_(payload.excerpt, flags), 240);
      if (ex2) payload.excerpt = ex2; else delete payload.excerpt;
    }

    if (payload.meta) {
      if (payload.meta.trip_schema_data && typeof payload.meta.trip_schema_data === 'string') {
        try {
          var ts = JSON.parse(payload.meta.trip_schema_data);
          if (ts && typeof ts === 'object') {
            if (safeTitle) ts.name = safeTitle;
            if (safeDesc) ts.description = safeDesc;
            payload.meta.trip_schema_data = JSON.stringify(ts);
            payload.meta.schema_trip_data = payload.meta.trip_schema_data;
          }
        } catch (eTs) {}
      }
      if (payload.meta.faq_schema_data && typeof payload.meta.faq_schema_data === 'string') {
        try {
          var fs = JSON.parse(payload.meta.faq_schema_data);
          if (fs && typeof fs === 'object') {
            if (safeTitle) fs.name = safeTitle;
            if (safeDesc) fs.description = safeDesc;
            payload.meta.faq_schema_data = JSON.stringify(fs);
          }
        } catch (eFs) {}
      }
    }
  } catch (eBelt) {}

  return payload;
}

// ----------------------------------------------------------
// API TRANSMISSION
// ----------------------------------------------------------

async function pushToWordPress_Updater_(wpId, payload) {
  // Handle base URL that might end in /trips (as seen in config.gs)
  var baseUrl = CONFIG.WP_API_BASE;
  if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
  if (baseUrl.endsWith('/trips')) baseUrl = baseUrl.slice(0, -6); // Remove '/trips' suffix
  
  var url = baseUrl + '/trip/' + wpId; // Construct singular endpoint: .../fts/v1/trip/{id}
  
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: {
      'Authorization': 'Basic ' + base64Encode(CONFIG.WP_API_USER + ':' + CONFIG.WP_API_PASS)
    },
    muteHttpExceptions: true
  };
  
  var response = await fetchUrl(url, options);
  var code = response.getResponseCode();
  var text = response.getContentText();
  
  if (code !== 200) {
    throw new Error('WP API Error (' + code + '): ' + text);
  }
  
  var json = JSON.parse(text);
  logVerbose_Updater_('Updater: API Response for ' + wpId + ': ' + JSON.stringify(json));
  
  // Log detailed debug information if available
  if (json.debug_update_core !== undefined) {
    logVerbose_Updater_('Updater: DEBUG - Core fields updated: ' + json.debug_update_core);
    logVerbose_Updater_('Updater: DEBUG - Core update result: ' + json.debug_core_result);
  }
  if (json.debug_meta_keys_updated) {
    logVerbose_Updater_('Updater: DEBUG - Meta keys updated: ' + JSON.stringify(json.debug_meta_keys_updated));
  }
  if (json.debug_wte_setting_updated) {
    logVerbose_Updater_('Updater: DEBUG - WTE Setting updated: ' + json.debug_wte_setting_updated);
    logVerbose_Updater_('Updater: DEBUG - WTE Setting keys: ' + JSON.stringify(json.debug_wte_setting_keys));
  }
  
  // The PHP endpoint returns the full trip object on success (with 'core', 'meta', etc.)
  // It does NOT return {success: true}.
  // If we got here (HTTP 200), and we have a valid object, it's a success.
  if (!json || (!json.core && !json.success)) {
    // Fallback: if it somehow returns the old format or an error without HTTP error code
    throw new Error('WP API returned unexpected response: ' + text.substring(0, 200) + '...');
  }
}

function isWpNotFoundError_Updater_(e) {
  var msg = e && e.message ? String(e.message) : String(e || '')
  return msg.indexOf('(404)') !== -1 || msg.indexOf(' 404') !== -1 || msg.indexOf('Error (404)') !== -1
}

// ----------------------------------------------------------
// CREATE NEW TRIP ON WORDPRESS
// ----------------------------------------------------------

/**
 * Create a new trip on WordPress
 * @param {Object} payload - Trip data payload
 * @return {string} - WordPress Post ID of the created trip
 */
async function createNewTripOnWordPress_Updater_(payload) {
  // Handle base URL
  var baseUrl = CONFIG.WP_API_BASE;
  if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
  if (baseUrl.endsWith('/trips')) baseUrl = baseUrl.slice(0, -6);
  
  // Use /trips endpoint (plural) for creating new trips
  var url = baseUrl + '/trips'; // Plural = create new
  
  // Prepare payload for creation
  // The endpoint expects: title, content, status, meta
  var createPayload = {
    title: payload.core.title || 'New Trip',
    slug: payload.core.slug || '', // ✅ Ensure Slug is sent on creation
    content: payload.core.content || '',
    status: payload.core.status || 'draft',
    excerpt: payload.core.excerpt || '', // ✅ Add excerpt
    meta: payload.meta || {}
  };
  
  // ✅ Support Multilingual Creation
  if (payload.lang) {
    createPayload.lang = payload.lang;
  }
  if (payload.language) {
    createPayload.language = payload.language;
  }
  if (payload.translation_of) {
    createPayload.translation_of = payload.translation_of;
  }
  
  // ✅ Support Taxonomy Creation (Activities & Trip Types)
  if (payload.activities) {
    createPayload.activities = payload.activities;
  }
  if (payload.trip_types) {
    createPayload.trip_types = payload.trip_types;
  }
  if (payload.destinations) {
    createPayload.destinations = payload.destinations;
  }
  
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(createPayload),
    headers: {
      'Authorization': 'Basic ' + base64Encode(CONFIG.WP_API_USER + ':' + CONFIG.WP_API_PASS)
    },
    muteHttpExceptions: true
  };
  
  var response = await fetchUrl(url, options);
  var code = response.getResponseCode();
  var text = response.getContentText();
  
  if (code !== 200 && code !== 201) {
    throw new Error('WP API Create Error (' + code + '): ' + text);
  }
  
  var json = JSON.parse(text);
  log('Updater: Create API Response: ' + JSON.stringify(json));
  
  // Extract the WordPress Post ID from response
  // The fts_format_trip response has: { core: { id: ... } }
  if (json.core && json.core.id) {
    return String(json.core.id);
  } else if (json.id) {
    return String(json.id);
  } else if (json.post_id) {
    return String(json.post_id);
  } else {
    throw new Error('Could not extract WordPress Post ID from create response');
  }
}

// ----------------------------------------------------------
// 🆕 HELPER: FETCH TRIP INFO (INCLUDING TRANSLATIONS)
// ----------------------------------------------------------
async function getTripInfoFromWp_(wpId) {
  var baseUrl = CONFIG.WP_API_BASE;
  if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
  if (baseUrl.endsWith('/trips')) baseUrl = baseUrl.slice(0, -6);
  
  var url = baseUrl + '/trip/' + wpId;
  
  var options = {
    method: 'get',
    headers: {
      'Authorization': 'Basic ' + base64Encode(CONFIG.WP_API_USER + ':' + CONFIG.WP_API_PASS)
    },
    muteHttpExceptions: true
  };
  
  var response = await fetchUrl(url, options);
  if (response.getResponseCode() !== 200) {
    throw new Error('Failed to fetch trip info from WP: ' + response.getResponseCode());
  }
  
  return JSON.parse(response.getContentText());
}

function computeMd5Base64_Updater_(text) {
  return md5Base64(String(text || ''));
}

function extractProvidedSeoKeywords_Updater_(enhancedData, tripFields) {
  var data = enhancedData || {};
  var g = data.general || {};
  var f = tripFields || {};

  var raw = '';
  if (g.AI_SEO_FocusKeywords) raw += String(g.AI_SEO_FocusKeywords) + ',';
  if (g.AI_SEO_FocusKeywords_List) raw += String(g.AI_SEO_FocusKeywords_List) + ',';
  if (f.AI_SEO_FocusKeywords) raw += String(f.AI_SEO_FocusKeywords) + ',';
  if (f.FocusKeywords) raw += String(f.FocusKeywords) + ',';
  if (f.SEO_Keywords) raw += String(f.SEO_Keywords) + ',';
  if (f.SEO_FocusKeywords_List) raw += String(f.SEO_FocusKeywords_List) + ',';
  if (f.Keywords) raw += String(f.Keywords) + ',';

  var list = [];
  if (g.AI_SEO_FocusKeywords_List) {
    if (Array.isArray(g.AI_SEO_FocusKeywords_List)) {
      g.AI_SEO_FocusKeywords_List.forEach(function(x) { list.push(String(x || '')); });
    } else if (typeof g.AI_SEO_FocusKeywords_List === 'string') {
      list = list.concat(g.AI_SEO_FocusKeywords_List.split(','));
    }
  }
  if (f.SEO_FocusKeywords_List) {
    if (Array.isArray(f.SEO_FocusKeywords_List)) {
      f.SEO_FocusKeywords_List.forEach(function(x) { list.push(String(x || '')); });
    } else if (typeof f.SEO_FocusKeywords_List === 'string') {
      list = list.concat(f.SEO_FocusKeywords_List.split(','));
    }
  }

  var parts = raw.split(/[,;\n]+/).concat(list).map(function(s) { return String(s || '').trim(); }).filter(function(s) { return !!s; });
  var seen = {};
  var uniq = [];
  parts.forEach(function(s) {
    var key = s.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    uniq.push(s);
  });

  return {
    primary: uniq.length ? uniq[0] : '',
    secondary: uniq.length > 1 ? uniq.slice(1, 4) : [],
    all: uniq
  };
}

function extractSeoKeywordsListFromTripsField_Updater_(tripFields, enhancedData) {
  var f = tripFields || {};
  var g = (enhancedData && enhancedData.general) ? enhancedData.general : {};
  var list = [];

  var v1 = f.SEO_FocusKeywords_List;
  if (v1) {
    if (Array.isArray(v1)) list = list.concat(v1.map(function(x) { return String(x || '').trim(); }));
    else list = list.concat(String(v1).split(/[,;\n]+/).map(function(x) { return String(x || '').trim(); }));
  }

  var v2 = g.AI_SEO_FocusKeywords_List;
  if (v2) {
    if (Array.isArray(v2)) list = list.concat(v2.map(function(x) { return String(x || '').trim(); }));
    else list = list.concat(String(v2).split(/[,;\n]+/).map(function(x) { return String(x || '').trim(); }));
  }

  list = list.filter(function(s) { return !!s; });

  var seen = {};
  var uniq = [];
  list.forEach(function(s) {
    var key = s.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    uniq.push(s);
  });
  return uniq;
}

function parseKeywordWithLangPrefix_Updater_(s) {
  var raw = String(s || '').trim();
  if (!raw) return null;
  var m = raw.match(/^\s*(?:\[([a-z]{2}(?:-[a-z]{2})?)\]|\(([a-z]{2}(?:-[a-z]{2})?)\)|([a-z]{2}(?:-[a-z]{2})?))\s*[:\-–]\s*(.+)\s*$/i);
  if (m) {
    var code = (m[1] || m[2] || m[3] || '').toLowerCase();
    var phrase = String(m[4] || '').trim();
    if (code && phrase) return { lang: code, phrase: phrase };
  }
  return null;
}

function detectLangHeuristicForKeyword_Updater_(s) {
  var t = String(s || '');
  if (!t) return '';
  if (/[\u0400-\u04FF]/.test(t)) return 'ru';
  if (/[\u4E00-\u9FFF]/.test(t)) return 'zh-hans';
  if (/[äöüßÄÖÜ]/.test(t)) return 'de';
  if (/[À-ÖØ-öø-ÿ]/.test(t)) return 'fr';
  var lower = t.toLowerCase();
  if (/\b(wuestensafari|wüstensafari|ausflug|ausfluege|ausflüge|sehenswuerdigkeiten|sehenswürdigkeiten|aktivitaet|aktivität|aktivitäten|ausfluge)\b/.test(lower)) return 'de';
  if (/\b(excursion|etoiles|étoiles|egypte|égypte|voyage|visite)\b/.test(lower)) return 'fr';
  if (/\b(excursiones|turismo|que hacer|precios)\b/.test(lower)) return 'es';
  if (/\b(excursões|excursao|turismo|o que fazer|preços)\b/.test(lower)) return 'pt-br';
  return '';
}

function normalizeKeywordPhrasesInput_Updater_(keywordsField) {
  var rawList = []
  if (keywordsField) {
    if (Array.isArray(keywordsField)) {
      rawList = rawList.concat(keywordsField.map(function (x) { return String(x == null ? '' : x) }))
    } else {
      rawList = rawList.concat(String(keywordsField).split(','))
    }
  }

  var out = []
  var seen = {}
  for (var i = 0; i < rawList.length; i++) {
    var original = String(rawList[i] == null ? '' : rawList[i])
    var collapsed = original.replace(/\s+/g, ' ').trim()
    if (!collapsed) continue
    var key = collapsed.toLowerCase()
    if (seen[key]) continue
    seen[key] = true
    out.push({ raw: collapsed, key: key })
  }
  log('KEYWORD PHRASES NORMALIZED: total=' + String(out.length))
  return out
}

function detectKeywordScript_Updater_(phrase) {
  var s = String(phrase || '')
  if (!s) return ''
  if (/[\u0400-\u04FF]/.test(s)) return 'cyrillic'
  if (/[\uAC00-\uD7AF]/.test(s)) return 'hangul'
  if (/[\u3040-\u30FF]/.test(s)) return 'japanese'
  if (/[\u4E00-\u9FFF]/.test(s)) return 'han'
  return ''
}

function normalizeKeywordForScoring_Updater_(phrase) {
  var s = String(phrase || '').toLowerCase()
  s = s.replace(/[\u2010-\u2015]/g, '-')
  s = s.replace(/[^a-z0-9\u00C0-\u024F\u0400-\u04FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\s'\-]/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

function foldKeywordLatinDiacritics_Updater_(s) {
  var t = String(s == null ? '' : s)
  if (!t) return t
  var map = {
    'á': 'a', 'à': 'a', 'â': 'a', 'ä': 'a', 'ã': 'a', 'å': 'a',
    'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
    'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
    'ó': 'o', 'ò': 'o', 'ô': 'o', 'ö': 'o', 'õ': 'o',
    'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
    'ý': 'y', 'ÿ': 'y',
    'ç': 'c',
    'ñ': 'n',
    'ő': 'o', 'ű': 'u',
    'ă': 'a', 'î': 'i', 'ș': 's', 'ş': 's', 'ț': 't', 'ţ': 't',
    'ě': 'e', 'š': 's', 'č': 'c', 'ř': 'r', 'ž': 'z', 'ů': 'u', 'ď': 'd', 'ť': 't', 'ň': 'n',
    'ł': 'l', 'ń': 'n', 'ś': 's', 'ź': 'z', 'ż': 'z', 'ą': 'a', 'ę': 'e'
  }
  return t.replace(/[^\u0000-\u007E]/g, function (ch) {
    var c = String(ch || '').toLowerCase()
    return map[c] ? map[c] : ch
  })
}

function tokenizeKeywordPhrase_Updater_(phrase) {
  var raw = String(phrase || '')
  var re = /[A-Za-z0-9\u00C0-\u024F\u0400-\u04FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]+/g
  var out = []
  var m
  while ((m = re.exec(raw)) !== null) {
    var t = String(m[0] || '')
    if (!t) continue
    out.push({ raw: t, lower: t.toLowerCase() })
  }
  return out
}

function containsTokenSequence_Updater_(tokens, seqLower) {
  if (!tokens || !tokens.length || !seqLower || !seqLower.length) return false
  for (var i = 0; i <= tokens.length - seqLower.length; i++) {
    var ok = true
    for (var j = 0; j < seqLower.length; j++) {
      if (String(tokens[i + j].lower || '') !== String(seqLower[j])) { ok = false; break }
    }
    if (ok) return true
  }
  return false
}

function detectCityFormSignals_Updater_(phrase, opts) {
  opts = opts || {}
  var raw = String(phrase || '').replace(/\s+/g, ' ').trim()
  if (!raw) return []
  var tokens = tokenizeKeywordPhrase_Updater_(raw)
  var lowers = tokens.map(function (t) { return String(t.lower || '') })
  var signals = []

  function add_(lang, token, weight) {
    if (!lang || !token) return
    if (opts.log) log('CITY FORM EXACT MATCH: "' + token + '" -> ' + lang)
    signals.push({ lang: lang, token: token, w: Number(weight || 0) })
  }

  if (containsTokenSequence_Updater_(tokens, ['le', 'caire'])) add_('fr', 'Le Caire', 4)

  if (lowers.indexOf('kairó') !== -1) {
    add_('hu', 'Kairó', 4)
    if (opts.log) log('CITY FORM REJECTED (substring only): "Kair" inside "Kairó"')
  } else if (lowers.indexOf('kairo') !== -1) {
    add_('de', 'Kairo', 4)
  } else if (lowers.indexOf('kair') !== -1) {
    add_('pl', 'Kair', 3)
  }

  if (lowers.indexOf('káhira') !== -1) add_('cs', 'Káhira', 4)
  else if (lowers.indexOf('kahira') !== -1) add_('cs', 'Kahira', 3)

  if (lowers.indexOf('каїр') !== -1) add_('uk', 'Каїр', 5)
  else if (lowers.indexOf('каир') !== -1) add_('ru', 'Каир', 4)

  if (lowers.indexOf('cairo') !== -1) {
    add_('en', 'Cairo', 1)
    add_('es', 'Cairo', 1)
    add_('it', 'Cairo', 1)
    add_('pt-br', 'Cairo', 1)
    add_('ro', 'Cairo', 1)
    add_('nl', 'Cairo', 1)
  }

  return signals
}

function applyExactKeywordPhraseRule_Updater_(phrase) {
  var raw = String(phrase || '').replace(/\s+/g, ' ').trim()
  if (!raw) return null
  var norm = normalizeKeywordForScoring_Updater_(raw)
  var folded = foldKeywordLatinDiacritics_Updater_(norm).toLowerCase()
  var key = norm.toLowerCase()

  var exact = {
    'piramidy w gizie': { lang: 'pl', type: 'phrase' },
    'piramides de giza': { lang: 'es', type: 'phrase' },
    'piramidele din giza': { lang: 'ro', type: 'phrase' },
    'pyramidy v gize': { lang: 'cs', type: 'phrase' },
    'cidadela de saladino': { lang: 'pt-br', type: 'phrase' },
    'piramidi di giza': { lang: 'it', type: 'phrase' },
    'cittadella di saladino': { lang: 'it', type: 'phrase' },
    'citadel van saladin': { lang: 'nl', type: 'phrase' },
    'egyptisch museum cairo': { lang: 'nl', type: 'phrase' }
  }
  if (exact[folded]) return exact[folded]
  if (exact[key]) return exact[key]

  if (folded === 'gizai piramisok') return { lang: 'hu', type: 'phrase' }
  if (folded === 'egyiptomi muzeum kairo') return { lang: 'hu', type: 'phrase' }

  if (/^(?:каир\s+достопримечательности|достопримечательности\s+каир)$/i.test(key)) return { lang: 'ru', type: 'pattern' }
  if (/(?:египетск\w*\s+музе\w*\s+каир|музе\w*\s+каир\s+египетск\w*)/i.test(key)) return { lang: 'ru', type: 'pattern' }
  if (/(?:цитадел\w*\s+саладин\w*\s+каир)/i.test(key)) return { lang: 'ru', type: 'pattern' }

  return null
}

function applyAuthoritativeSeoPhraseOverride_Updater_(phrase) {
  var raw = String(phrase || '').replace(/\s+/g, ' ').trim()
  if (!raw) return null

  var tokens = tokenizeKeywordPhrase_Updater_(raw)
  var lowers = tokens.map(function (t) { return String(t.lower || '') })
  var normalized = normalizeKeywordForScoring_Updater_(raw)
  var folded = foldKeywordLatinDiacritics_Updater_(normalized).toLowerCase()

  function seq_(arr) { return containsTokenSequence_Updater_(tokens, arr) }
  function has_(t) { return lowers.indexOf(String(t || '').toLowerCase()) !== -1 }

  if (/[\u0400-\u04FF]/.test(raw)) {
    if (seq_(['что', 'посмотреть', 'в', 'каире']) || seq_(['что', 'посмотреть', 'каир'])) return { lang: 'ru', type: 'authoritative_pattern', id: 'ru_what_to_see_in_cairo' }
    if ((has_('цитадель') || has_('цитадели')) && has_('саладина') && (has_('каир') || has_('каире'))) {
      return { lang: 'ru', type: 'authoritative_audit_fix', id: 'ru_citadel_saladina_cairo' }
    }
  }
  if (/[іїєґ]/i.test(raw) || has_('каїр') || has_('каїре')) {
    if (seq_(['піраміди', 'гізи']) || seq_(['піраміди', 'гiзи'])) return { lang: 'uk', type: 'authoritative_phrase', id: 'uk_giza_pyramids' }
    if (seq_(['цитадель', 'саладіна'])) return { lang: 'uk', type: 'authoritative_phrase', id: 'uk_citadel_saladina' }
  }

  if (seq_(['pyramids', 'cairo', 'tour'])) return { lang: 'en', type: 'authoritative_phrase', id: 'en_pyramids_cairo_tour' }
  if (seq_(['egyptian', 'museum', 'cairo'])) return { lang: 'en', type: 'authoritative_phrase', id: 'en_egyptian_museum_cairo' }
  if (seq_(['cairo', 'day', 'tours'])) return { lang: 'en', type: 'authoritative_phrase', id: 'en_cairo_day_tours' }
  if (seq_(['cairo', 'egypt', 'day', 'tours'])) return { lang: 'en', type: 'authoritative_phrase', id: 'en_cairo_egypt_day_tours' }
  if (seq_(['day', 'tours', 'from', 'cairo'])) return { lang: 'en', type: 'authoritative_phrase', id: 'en_day_tours_from_cairo' }
  if (seq_(['coptic', 'cairo', 'tour'])) return { lang: 'en', type: 'authoritative_phrase', id: 'en_coptic_cairo_tour' }
  if (seq_(['el', 'khalili', 'cairo'])) return { lang: 'en', type: 'domain_specific_phrase', id: 'en_el_khalili_cairo' }

  if (folded === 'piramides van gizeh' || (has_('van') && has_('gizeh') && has_('piramides'))) return { lang: 'nl', type: 'authoritative_phrase', id: 'nl_pyramids_van_gizeh' }

  return null
}

function detectMorphologyOverrideLang_Updater_(phrase, scriptHint) {
  var raw = String(phrase || '').replace(/\s+/g, ' ').trim()
  if (!raw) return null
  if (scriptHint && scriptHint !== '' && scriptHint !== 'cyrillic') return null

  var tokens = tokenizeKeywordPhrase_Updater_(raw)
  var lowers = tokens.map(function (t) { return String(t.lower || '') })
  function has_(t) { return lowers.indexOf(String(t || '').toLowerCase()) !== -1 }
  function seq_(arr) { return containsTokenSequence_Updater_(tokens, arr) }

  if (seq_(['wat', 'te', 'doen']) || has_('bezienswaardigheden') || (has_('van') && has_('gizeh'))) return { lang: 'nl', reason: 'nl_morph', id: 'nl_family' }
  if (seq_(['o', 'que', 'fazer']) || has_('excursao') || has_('excursão') || (has_('pontos') && (has_('turisticos') || has_('turísticos')))) return { lang: 'pt-br', reason: 'ptbr_morph', id: 'ptbr_family' }
  if ((has_('cidadela') && has_('saladino') && has_('de')) || seq_(['cidadela', 'de', 'saladino'])) return { lang: 'pt-br', reason: 'ptbr_saladino', id: 'ptbr_cidadela_de_saladino' }
  if ((has_('din') && has_('giza')) || has_('piramidele') || has_('muzeul') || has_('excursii')) return { lang: 'ro', reason: 'ro_morph', id: 'ro_family' }
  if ((has_('di') && has_('giza') && (has_('piramidi') || has_('cittadella'))) || seq_(['cittadella', 'di', 'saladino'])) return { lang: 'it', reason: 'it_morph', id: 'it_family' }
  if (seq_(['que', 'ver']) || seq_(['barrio', 'copto']) || has_('ciudadela') || seq_(['museo', 'egipcio'])) return { lang: 'es', reason: 'es_morph', id: 'es_family' }

  return null
}

function getKeywordLanguageProfiles_Updater_() {
  return {
    de: [
      { w: 9, strong: true, p: "\\b(ausflug|ausflüge|ausfluege|sehenswürdigkeiten|sehenswuerdigkeiten|ägyptisches|aegyptisches|altstadt|zitadelle)\\b" },
      { w: 7, strong: true, p: "\\b(kairo\\s+ausflug)\\b" },
      { w: 4, p: "\\b(ausflug|ausflüge|ausfluege|sehenswürdigkeiten|sehenswuerdigkeiten|altstadt|zitadelle|ägyptisches|aegyptisches|kairo)\\b" },
      { w: 2, p: "\\b(museum|pyramiden|nil|tagesausflug|stadtführung|stadtfuhrung)\\b" },
      { w: 2, p: "[äöüß]" }
    ],
    fr: [
      { w: 9, strong: true, p: "\\b(le caire|visiter|tourisme|musée|musee)\\b" },
      { w: 7, strong: true, p: "\\b(le\\s+caire)\\b" },
      { w: 4, p: "\\b(excursion|le caire|visiter|tourisme|musée|musee)\\b" },
      { w: 2, p: "\\b(à voir|que faire|pyramides|citadelle|vieux caire|egypte|égypte)\\b" },
      { w: 2, p: "[àâçéèêëîïôûùüÿœ]" }
    ],
    es: [
      { w: 9, strong: true, p: "\\b(que ver|visitar|museo egipcio|barrio copto|ciudadela)\\b" },
      { w: 7, strong: true, p: "\\b(que\\s+ver|el\\s+cairo)\\b" },
      { w: 4, p: "\\b(que ver|visitar|museo|ciudadela|barrio copto|el cairo)\\b" },
      { w: 2, p: "\\b(excursiones|turismo|precios|egipto)\\b" },
      { w: 2, p: "[áéíóúñ¿¡]" }
    ],
    tr: [
      { w: 9, strong: true, p: "\\b(turları|mısır|müzesi|gezilecek|kalesi)\\b" },
      { w: 7, strong: true, p: "\\b(kahire\\s+turu)\\b" },
      { w: 4, p: "\\b(kahire|turu|turları|müzesi|gezilecek)\\b" },
      { w: 2, p: "\\b(gezi|tur|müze|piramit|kale)\\b" },
      { w: 2, p: "[ğşıçöüİ]" }
    ],
    ro: [
      { w: 8, strong: true, p: "\\b(excursii|muzeul|vizita|vechi)\\b" },
      { w: 9, strong: true, p: "\\b(piramidele|din\\s+giza|citadela|egiptologie)\\b" },
      { w: 4, p: "\\b(excursie|excursii|vizita|vechi|muzeul)\\b" },
      { w: 2, p: "\\b(ce să vezi|ce sa vezi|tur|cairo)\\b" },
      { w: 2, p: "[ăâîșț]" }
    ],
    pl: [
      { w: 10, strong: true, p: "\\b(wycieczka|zwiedzanie|stary kair|w kairze|saladyna)\\b" },
      { w: 9, strong: true, p: "\\b(co warto zobaczyć|co warto zobaczyc)\\b" },
      { w: 9, strong: true, p: "\\b(piramidy|gizie|cytadela|egipskie|kair)\\b" },
      { w: 5, p: "\\b(wycieczka|zwiedzanie|co warto zobaczyć|co warto zobaczyc|w kairze|stary kair|muzeum)\\b" },
      { w: 2, p: "\\b(piramidy|cytadela|saladyna)\\b" },
      { w: 3, p: "[ąćęłńóśźż]" }
    ],
    nl: [
      { w: 9, strong: true, p: "\\b(wat te doen|bezienswaardigheden|oud cairo)\\b" },
      { w: 9, strong: true, p: "\\b(van\\s+gizeh|egyptisch|citadel\\s+van\\s+saladin)\\b" },
      { w: 4, p: "\\b(wat te doen|bezienswaardigheden|oud cairo)\\b" },
      { w: 2, p: "\\b(museum|piramides|citadel)\\b" }
    ],
    it: [
      { w: 9, strong: true, p: "\\b(escursioni|cosa vedere|museo egizio|vecchio cairo)\\b" },
      { w: 9, strong: true, p: "\\b(piramidi|di\\s+giza|cittadella|visitare)\\b" },
      { w: 4, p: "\\b(escursioni|cosa vedere|museo egizio|vecchio cairo)\\b" },
      { w: 2, p: "\\b(museo|piramidi|citadella)\\b" }
    ],
    'pt-br': [
      { w: 9, strong: true, p: "\\b(excursão|excursao|o que fazer|pirâmides|piramides|museu|antigo|pontos turísticos|pontos turisticos)\\b" },
      { w: 9, strong: true, p: "\\b(cidadela|de\\s+saladino)\\b" },
      { w: 4, p: "\\b(excursão|excursao|o que fazer|pirâmides|piramides|museu|antigo|pontos turísticos|pontos turisticos)\\b" },
      { w: 2, p: "\\b(turismo|visitar|cairo)\\b" },
      { w: 2, p: "[ãõçáéíóúâêôà]" }
    ],
    hu: [
      { w: 9, strong: true, p: "\\b(kairó|kirándulás|kirandulas|látnivalók|latnivalok|ókairó|okairo|városnézés|varosnezes)\\b" },
      { w: 9, strong: true, p: "\\b(gízai|gizai|piramisok|egyiptomi|múzeum|muzeum|szaladin)\\b" },
      { w: 4, p: "\\b(kairó|kirándulás|kirandulas|látnivalók|latnivalok|ókairó|okairo|városnézés|varosnezes)\\b" },
      { w: 2, p: "\\b(múzeum|muzeum|piramis|citadella)\\b" },
      { w: 2, p: "[őűáéíóöü]" }
    ],
    cs: [
      { w: 9, strong: true, p: "\\b(výlet|vylet|co vidět|co videt|stará káhira|stara kahira|památky|pamatky)\\b" },
      { w: 9, strong: true, p: "\\b(egyptské|egyptske|káhira|kahira|muzeum|památky|pamatky)\\b" },
      { w: 4, p: "\\b(výlet|vylet|co vidět|co videt|stará káhira|stara kahira|památky|pamatky)\\b" },
      { w: 2, p: "\\b(mužeum|muzeum|pyramidy|citadela)\\b" },
      { w: 2, p: "[ěščřžýáíéůúóďťň]" }
    ],
    en: [
      { w: 9, strong: true, p: "\\b(day tour|things to do|sightseeing|old cairo tour)\\b" },
      { w: 4, p: "\\b(cairo day tour|things to do|sightseeing|cairo museum|old cairo)\\b" },
      { w: 2, p: "\\b(tour|tours|trip|excursion|museum|pyramids)\\b" }
    ],
    ru: [
      { w: 10, strong: true, p: "\\b(экскурсия|достопримечательности|старый каир)\\b" },
      { w: 9, strong: true, p: "\\b(каир|египетск\\w*|музе\\w*|цитадел\\w*|саладин\\w*|что\\s+посмотреть)\\b" },
      { w: 6, p: "\\b(экскурсия|достопримечательности|старый каир|музей|пирамиды)\\b" },
      { w: 2, p: "[ёыэ]" }
    ],
    uk: [
      { w: 10, strong: true, p: "\\b(екскурсія|пам'ятки|памятки|старий каїр)\\b" },
      { w: 9, strong: true, p: "\\b(каїр|єгипетськ\\w*|музе\\w*|цитадел\\w*|саладін\\w*|що\\s+подивитися)\\b" },
      { w: 6, p: "\\b(екскурсія|пам'ятки|памятки|старий каїр|музей|піраміди)\\b" },
      { w: 3, p: "[їєґ]" }
    ],
    'zh-hans': [
      { w: 6, p: "[\\u4E00-\\u9FFF]" },
      { w: 2, p: "(开罗|旅游|景点|博物馆|老城)" }
    ],
    ko: [
      { w: 6, p: "[\\uAC00-\\uD7AF]" },
      { w: 2, p: "(카이로|투어|박물관|성채)" }
    ],
    ja: [
      { w: 6, p: "[\\u3040-\\u30FF]" },
      { w: 2, p: "(カイロ|観光|ツアー|博物館|オールド\\s*カイロ)" }
    ]
  }
}

function detectCityFormExactLang_Updater_(phrase) {
  var raw = String(phrase || '').replace(/\s+/g, ' ').trim()
  if (!raw) return ''
  var tokens = tokenizeKeywordPhrase_Updater_(raw)
  var lowers = tokens.map(function (t) { return String(t.lower || '') })

  if (containsTokenSequence_Updater_(tokens, ['le', 'caire'])) return 'fr'
  if (lowers.indexOf('kairó') !== -1) return 'hu'
  if (lowers.indexOf('kairo') !== -1) return 'de'
  if (lowers.indexOf('káhira') !== -1 || lowers.indexOf('kahira') !== -1) return 'cs'
  if (lowers.indexOf('kair') !== -1) return 'pl'
  if (lowers.indexOf('каїр') !== -1 || lowers.indexOf('каїре') !== -1) return 'uk'
  if (lowers.indexOf('каир') !== -1 || lowers.indexOf('каире') !== -1) return 'ru'

  return ''
}

function detectStrongMarkerLang_Updater_(phrase, scriptHint) {
  var raw = String(phrase || '').replace(/\s+/g, ' ').trim()
  if (!raw) return ''
  var tokens = tokenizeKeywordPhrase_Updater_(raw)
  var lowers = tokens.map(function (t) { return String(t.lower || '') })
  var foldedNorm = foldKeywordLatinDiacritics_Updater_(normalizeKeywordForScoring_Updater_(raw)).toLowerCase()

  function has_(t) { return lowers.indexOf(String(t || '').toLowerCase()) !== -1 }
  function seq_(arr) { return containsTokenSequence_Updater_(tokens, arr) }
  function hasFold_(s) { return (' ' + foldedNorm + ' ').indexOf(' ' + String(s || '').toLowerCase() + ' ') !== -1 }

  if (scriptHint === 'cyrillic') {
    if (/[іїєґ]/i.test(raw) || has_('екскурсія') || has_("пам'ятки") || has_('каїр') || has_('каїре')) return 'uk'
    if (has_('экскурсия') || has_('достопримечательности') || has_('каир') || has_('каире') || seq_(['что', 'посмотреть'])) return 'ru'
    return ''
  }

  if (hasFold_('ausflug') || hasFold_('sehenswuerdigkeiten') || (' ' + foldedNorm + ' ').indexOf(' sehenswürdigkeiten ') !== -1 || hasFold_('altstadt') || hasFold_('zitadelle') || hasFold_('aegyptisches') || (' ' + foldedNorm + ' ').indexOf(' ägyptisches ') !== -1) return 'de'
  if (seq_(['le', 'caire']) || hasFold_('visiter') || (' ' + foldedNorm + ' ').indexOf(' musée ') !== -1 || hasFold_('tourisme')) return 'fr'
  if (seq_(['que', 'ver']) || hasFold_('visitar') || seq_(['barrio', 'copto']) || seq_(['museo', 'egipcio']) || hasFold_('ciudadela')) return 'es'
  if (seq_(['kahire', 'turu']) || hasFold_('turları') || hasFold_('muzesi') || (' ' + foldedNorm + ' ').indexOf(' müzesi ') !== -1 || hasFold_('gezilecek')) return 'tr'
  if (hasFold_('excursii') || hasFold_('muzeul') || hasFold_('piramidele') || (hasFold_('din') && hasFold_('giza'))) return 'ro'
  if (hasFold_('wycieczka') || hasFold_('zwiedzanie') || seq_(['co', 'warto', 'zobaczyc']) || seq_(['co', 'warto', 'zobaczyć']) || hasFold_('saladyna')) return 'pl'
  if (seq_(['wat', 'te', 'doen']) || hasFold_('bezienswaardigheden') || (hasFold_('van') && hasFold_('gizeh'))) return 'nl'
  if (hasFold_('escursioni') || seq_(['cosa', 'vedere']) || seq_(['museo', 'egizio']) || hasFold_('cittadella') || hasFold_('visitare')) return 'it'
  if (seq_(['o', 'que', 'fazer']) || hasFold_('excursao') || (' ' + foldedNorm + ' ').indexOf(' excursão ') !== -1 || (hasFold_('pontos') && (hasFold_('turisticos') || (' ' + foldedNorm + ' ').indexOf(' turísticos ') !== -1)) || hasFold_('museu')) return 'pt-br'
  if (hasFold_('kirandulas') || (' ' + foldedNorm + ' ').indexOf(' kirándulás ') !== -1 || hasFold_('latnivalok') || (' ' + foldedNorm + ' ').indexOf(' látnivalók ') !== -1 || hasFold_('varosnezes') || (' ' + foldedNorm + ' ').indexOf(' városnézés ') !== -1) return 'hu'
  if (hasFold_('vylet') || (' ' + foldedNorm + ' ').indexOf(' výlet ') !== -1 || seq_(['co', 'videt']) || (' ' + foldedNorm + ' ').indexOf(' co vidět ') !== -1 || hasFold_('pamatky') || (' ' + foldedNorm + ' ').indexOf(' památky ') !== -1) return 'cs'

  return ''
}

function classifyKeywordPhraseLang_Updater_(phrase) {
  var raw = String(phrase || '').replace(/\s+/g, ' ').trim()
  if (!raw) return { lang: 'unknown', reason: 'empty' }

  var script = detectKeywordScript_Updater_(raw)
  if (script === 'han') return { lang: 'zh-hans', reason: 'script' }
  if (script === 'hangul') return { lang: 'ko', reason: 'script' }
  if (script === 'japanese') return { lang: 'ja', reason: 'script' }
  if (script === 'cyrillic') {
    var strongCyr = detectStrongMarkerLang_Updater_(raw, 'cyrillic')
    if (strongCyr) return { lang: strongCyr, reason: 'script' }
    if (/[іїєґ]/i.test(raw) || /\bкаїр\b/i.test(raw)) return { lang: 'uk', reason: 'script' }
    return { lang: 'ru', reason: 'script' }
  }

  var city = detectCityFormExactLang_Updater_(raw)
  if (city) return { lang: city, reason: 'city_form' }

  var strong = detectStrongMarkerLang_Updater_(raw, script)
  if (strong) return { lang: strong, reason: 'strong_marker' }

  var ex1 = applyExactKeywordPhraseRule_Updater_(raw)
  if (ex1 && ex1.lang) return { lang: String(ex1.lang), reason: 'exact_phrase' }
  var ex2 = applyAuthoritativeSeoPhraseOverride_Updater_(raw)
  if (ex2 && ex2.lang) return { lang: String(ex2.lang), reason: 'exact_phrase' }

  var morph = detectMorphologyOverrideLang_Updater_(raw, script)
  if (morph && morph.lang) return { lang: String(morph.lang), reason: 'family' }

  var minimal = minimalDisambiguationForKeywordPhrase_Updater_(raw, script)
  if (minimal) return { lang: minimal, reason: 'minimal' }

  return { lang: 'unknown', reason: 'ambiguous' }
}

function minimalDisambiguationForKeywordPhrase_Updater_(phrase, scriptHint) {
  var raw = String(phrase || '').replace(/\s+/g, ' ').trim()
  if (!raw) return ''
  if (scriptHint && scriptHint !== '') return ''

  var tokens = tokenizeKeywordPhrase_Updater_(raw)
  var lowers = tokens.map(function (t) { return String(t.lower || '') })
  var norm = normalizeKeywordForScoring_Updater_(raw)
  var folded = foldKeywordLatinDiacritics_Updater_(norm).toLowerCase()
  var padded = ' ' + folded + ' '
  function has_(t) { return lowers.indexOf(String(t || '').toLowerCase()) !== -1 }
  function hasFold_(t) { return padded.indexOf(' ' + String(t || '').toLowerCase() + ' ') !== -1 }
  function seqFold_(s) { return padded.indexOf(' ' + String(s || '').toLowerCase() + ' ') !== -1 }

  var hasCairo = has_('cairo') || hasFold_('cairo')
  var hasElCairo = containsTokenSequence_Updater_(tokens, ['el', 'cairo']) || seqFold_('el cairo')
  var hasKahire = hasFold_('kahire')
  var hasCaire = hasFold_('caire')

  if (hasCairo && (hasFold_('day') && (hasFold_('tour') || hasFold_('tours')))) return 'en'
  if (seqFold_('things to do') && hasCairo) return 'en'
  if (hasCairo && hasFold_('museum')) return 'en'
  if (hasCairo && hasFold_('sightseeing')) return 'en'
  if (seqFold_('old cairo') && hasFold_('tour')) return 'en'
  if (hasFold_('alexandria') && hasFold_('day') && hasFold_('tour') && hasFold_('from') && hasCairo) return 'en'
  if (hasCairo && hasFold_('to') && hasFold_('luxor') && hasFold_('day') && hasFold_('tour')) return 'en'

  if (hasCaire && (hasFold_('musee') || padded.indexOf(' musée ') !== -1) && (hasFold_('egyptien') || hasFold_('egyptienne'))) return 'fr'

  if (hasElCairo && (hasFold_('excursion') || hasFold_('museo') || seqFold_('museo egipcio'))) return 'es'

  if (hasKahire && (hasFold_('piramit') || hasFold_('kalesi') || hasFold_('turu') || hasFold_('turlari'))) return 'tr'

  if (hasCairo && (hasFold_('vizita') || hasFold_('vechi') || (hasFold_('citadela') && hasFold_('lui')))) return 'ro'
  if (hasFold_('citadela') && hasFold_('lui') && hasFold_('saladin')) return 'ro'
  if (hasFold_('excursie') && hasCairo) {
    log('BUCKET AUDIT FIX APPLIED: "' + raw + '" moved from ro to nl')
    return 'nl'
  }
  if (hasFold_('citadela') && hasFold_('saladin')) return 'ro'

  if ((hasFold_('muzeum') && hasFold_('egipskie') && hasFold_('kairze')) || (hasFold_('muzeum') && hasFold_('egipskie') && seqFold_('w kairze'))) return 'pl'

  if (hasFold_('oud') && hasCairo) return 'nl'
  if (hasFold_('vecchio') && hasCairo) return 'it'

  if (hasFold_('co') && hasFold_('videt') && hasFold_('kahire')) return 'cs'
  if (hasFold_('muzeum') && (hasFold_('egyptske') || padded.indexOf(' egyptské ') !== -1) && (hasFold_('kahire') || hasFold_('kahira'))) return 'cs'

  if ((hasFold_('piramides') || padded.indexOf(' pirâmides ') !== -1) && hasFold_('de') && (hasFold_('gize') || hasFold_('gize'))) return 'pt-br'
  if (hasCairo && hasFold_('antigo')) return 'pt-br'

  if (hasFold_('szaladin') && hasFold_('citadella')) return 'hu'
  if (hasFold_('okairo') || padded.indexOf(' ókairó ') !== -1) return 'hu'

  return ''
}

function applyHardKeywordDisambiguation_Updater_(phrase) {
  var raw = String(phrase || '')
  var s = normalizeKeywordForScoring_Updater_(raw)
  var p = ' ' + s + ' '
  if (p.indexOf(' le caire ') !== -1) return 'fr'
  if (p.indexOf(' el cairo ') !== -1) return 'es'
  if (p.indexOf(' oud cairo ') !== -1) return 'nl'
  if (p.indexOf(' old cairo ') !== -1) return 'en'
  if (p.indexOf(' stary kair ') !== -1) return 'pl'
  if (p.indexOf(' ókairó ') !== -1 || p.indexOf(' okairo ') !== -1) return 'hu'
  if (/стар(ый|ий)\s+ка(ир|їр)/i.test(raw)) {
    if (/[їєґ]/i.test(raw)) return 'uk'
    return 'ru'
  }
  return ''
}

function findStrongMarkerFastPathForKeyword_Updater_(phrase, scriptHint) {
  var raw = String(phrase || '').trim()
  if (!raw) return ''
  if (scriptHint === 'han') return 'zh-hans'
  if (scriptHint === 'hangul') return 'ko'
  if (scriptHint === 'japanese') return 'ja'

  var hard = applyHardKeywordDisambiguation_Updater_(raw)
  if (hard) return hard

  var profiles = getKeywordLanguageProfiles_Updater_()
  var scope = scriptHint === 'cyrillic' ? ['ru', 'uk'] : ['de', 'fr', 'es', 'tr', 'ro', 'pl', 'nl', 'it', 'pt-br', 'hu', 'cs', 'en', 'ru', 'uk']
  var hits = []
  for (var i = 0; i < scope.length; i++) {
    var lang = scope[i]
    var rules = profiles[lang] || []
    for (var r = 0; r < rules.length; r++) {
      var rule = rules[r]
      if (!rule || !rule.strong || !rule.p) continue
      var re = new RegExp(rule.p, 'i')
      if (re.test(raw)) { hits.push(lang); break }
    }
  }
  if (hits.length === 1) return hits[0]
  return ''
}

function scoreKeywordPhrase_Updater_(phrase, scriptHint, opts) {
  opts = opts || {}
  var raw = String(phrase || '')
  var normalized = normalizeKeywordForScoring_Updater_(raw)
  var profiles = getKeywordLanguageProfiles_Updater_()
  var scores = {}
  var strongHits = {}
  var cityHits = {}
  var citySignals = opts.citySignals ? opts.citySignals : detectCityFormSignals_Updater_(raw, { log: false })
  var cityApplied = {}

  var hard = applyHardKeywordDisambiguation_Updater_(raw)
  if (hard) {
    scores[hard] = 999
    return { scores: scores, forced: hard, normalized: normalized }
  }

  var forced = ''
  var scope = null
  if (scriptHint === 'han') forced = 'zh-hans'
  else if (scriptHint === 'hangul') forced = 'ko'
  else if (scriptHint === 'japanese') forced = 'ja'
  else if (scriptHint === 'cyrillic') scope = ['ru', 'uk']

  if (forced) {
    scores[forced] = 999
    return { scores: scores, forced: forced, normalized: normalized }
  }

  var langs = scope || ['de', 'fr', 'es', 'tr', 'ro', 'pl', 'nl', 'it', 'pt-br', 'hu', 'cs', 'en', 'ru', 'uk']
  if (citySignals && citySignals.length) {
    citySignals.forEach(function (s) {
      var l = String(s.lang || '').toLowerCase()
      if (!l) return
      if (!scores[l]) scores[l] = 0
      scores[l] += Number(s.w || 0)
      cityHits[l] = true
      cityApplied[l] = (cityApplied[l] ? cityApplied[l] : 0) + Number(s.w || 0)
      if (opts.logCityBoost) log('CITY-FORM BOOST APPLIED: "' + raw + '" -> ' + l)
    })
  }
  for (var i = 0; i < langs.length; i++) {
    var lang = langs[i]
    var rules = profiles[lang] || []
    var score = 0
    for (var r = 0; r < rules.length; r++) {
      var rule = rules[r]
      if (!rule || !rule.p) continue
      var re = new RegExp(rule.p, 'i')
      if (re.test(raw) || re.test(normalized)) {
        score += Number(rule.w || 0)
        if (rule.strong) strongHits[lang] = true
      }
    }
    if (score > 0) scores[lang] = (scores[lang] ? scores[lang] : 0) + score
  }

  var morph = detectMorphologyOverrideLang_Updater_(raw, scriptHint)
  if (morph && morph.lang) {
    var ml = String(morph.lang).toLowerCase()
    scores[ml] = (scores[ml] ? scores[ml] : 0) + 12
    strongHits[ml] = true
    if (opts.logMorphology) {
      log('MORPHOLOGY OVERRIDE APPLIED: "' + raw + '" -> ' + ml)
      log('LANGUAGE-FAMILY DISAMBIGUATION APPLIED: "' + raw + '" -> ' + ml)
      if (morph.id) log('COUNT INFLATION SOURCE IDENTIFIED: "' + raw + '" -> ' + ml + ' (morphology:' + String(morph.id) + ')')
    }
  }

  var strongKeys = Object.keys(strongHits || {})
  if (strongKeys.length && citySignals && citySignals.length) {
    var cityLangs = Object.keys(cityApplied || {})
    for (var ci = 0; ci < cityLangs.length; ci++) {
      var cl = cityLangs[ci]
      if (!strongHits[cl] && cityApplied[cl]) {
        scores[cl] = (scores[cl] ? scores[cl] : 0) - cityApplied[cl]
        if (scores[cl] <= 0) delete scores[cl]
        if (opts.logCityIgnore) log('CITY-FORM BOOST IGNORED DUE TO STRONG MARKER: "' + raw + '"')
      }
    }
  }

  return { scores: scores, forced: '', normalized: normalized, strongHits: strongHits, cityHits: cityHits }
}

function decideBucketFromScores_Updater_(phrase, scoreObj, scriptHint) {
  var raw = String(phrase || '')
  if (scoreObj && scoreObj.forced) return { lang: scoreObj.forced, confidence: 'forced' }

  var entries = []
  var scores = scoreObj && scoreObj.scores ? scoreObj.scores : {}
  for (var k in scores) {
    if (!Object.prototype.hasOwnProperty.call(scores, k)) continue
    entries.push({ lang: k, score: scores[k] })
  }
  entries.sort(function (a, b) { return b.score - a.score })

  var top = entries.length ? entries[0] : null
  var second = entries.length > 1 ? entries[1] : null
  var normalized = scoreObj && scoreObj.normalized ? String(scoreObj.normalized) : normalizeKeywordForScoring_Updater_(raw)
  var words = normalized ? normalized.split(/\s+/).filter(function (x) { return !!x }) : []
  var shortish = normalized.length < 12 || words.length <= 2

  if (!top) return { lang: 'unknown', confidence: 'none' }

  var scoreLogParts = []
  entries.slice(0, 6).forEach(function (e) { scoreLogParts.push(e.lang + '=' + e.score) })
  if (scoreLogParts.length) log('LANGUAGE PROFILE SCORES: "' + raw + '" -> ' + scoreLogParts.join(', '))

  var hasStrongTop = !!(scoreObj && scoreObj.strongHits && scoreObj.strongHits[top.lang])
  var hasCityTop = !!(scoreObj && scoreObj.cityHits && scoreObj.cityHits[top.lang])
  var isCyr = scriptHint === 'cyrillic'
  var minScore = shortish ? (hasStrongTop || isCyr ? 4 : 6) : 4
  var minGap = shortish ? (hasStrongTop || isCyr ? 1 : 3) : 2
  var gap = second ? (top.score - second.score) : top.score

  if ((top.score < minScore || (second && gap < minGap)) && !(shortish && hasCityTop && top.score >= 3 && (!second || gap >= 1))) {
    if (hasStrongTop || isCyr) {
      if (isCyr && hasStrongTop) log('SCRIPT + MARKER CONFIDENCE BOOST: "' + raw + '" -> ' + top.lang)
      if (shortish && hasStrongTop) log('SHORT PHRASE ACCEPTED BY STRONG MARKER: "' + raw + '" -> ' + top.lang)
      log('UNKNOWN FALLBACK SUPPRESSED BY STRONG MARKER: "' + raw + '" -> ' + top.lang)
      return { lang: top.lang, confidence: 'strong_relaxed' }
    }
    log('LOW CONFIDENCE PHRASE SENT TO UNKNOWN: "' + raw + '"')
    return { lang: 'unknown', confidence: (second && gap < minGap) ? 'ambiguous' : 'low' }
  }

  return { lang: top.lang, confidence: 'scored' }
}

function buildKeywordBucketsByLanguage_Updater_(keywordsField) {
  var phrases = normalizeKeywordPhrasesInput_Updater_(keywordsField)

  var buckets = { unknown: [] }
  var seen = {}

  function canonLang_(lang) {
    var l = String(lang || '').toLowerCase().trim()
    if (!l) return 'unknown'
    if (l.indexOf('pl') === 0) l = 'pl'
    if (l === 'pt') l = 'pt-br'
    if (l === 'zh') l = 'zh-hans'
    if (l === 'zh-cn') l = 'zh-hans'
    return l
  }

  function add_(lang, phrase) {
    var l = canonLang_(lang)
    var p = String(phrase || '').replace(/\s+/g, ' ').trim()
    if (!p) return
    var key = l + '|' + p.toLowerCase()
    if (seen[key]) return
    seen[key] = true
    if (!buckets[l]) buckets[l] = []
    buckets[l].push(p)
  }

  for (var i = 0; i < phrases.length; i++) {
    var raw = phrases[i] ? String(phrases[i].raw || '') : ''
    if (!raw) continue

    var parsed = parseKeywordWithLangPrefix_Updater_(raw)
    if (parsed && parsed.lang && parsed.phrase) {
      add_(parsed.lang, parsed.phrase)
      continue
    }

    var cls = classifyKeywordPhraseLang_Updater_(raw)
    if (cls && cls.lang && cls.lang !== 'unknown') {
      if (cls.reason === 'script') log('SCRIPT CLASSIFICATION: "' + raw + '" -> ' + cls.lang)
      else if (cls.reason === 'city_form') log('CITY-FORM CLASSIFICATION: "' + raw + '" -> ' + cls.lang)
      else if (cls.reason === 'strong_marker') log('STRONG-MARKER CLASSIFICATION: "' + raw + '" -> ' + cls.lang)
      else if (cls.reason === 'exact_phrase') log('EXACT-PHRASE CLASSIFICATION: "' + raw + '" -> ' + cls.lang)
      else if (cls.reason === 'family') log('LANGUAGE-FAMILY DISAMBIGUATION APPLIED: "' + raw + '" -> ' + cls.lang)
      else if (cls.reason === 'minimal') log('MINIMAL DISAMBIGUATION APPLIED: "' + raw + '" -> ' + cls.lang)
      add_(cls.lang, raw)
    } else {
      log('UNKNOWN ONLY BECAUSE TRULY AMBIGUOUS: "' + raw + '"')
      add_('unknown', raw)
    }
  }

  var summaryParts = []
  var keys = Object.keys(buckets).filter(function (k) { return k !== 'unknown' }).sort()
  for (var k2 = 0; k2 < keys.length; k2++) {
    var keyLang = keys[k2]
    summaryParts.push(keyLang + '=' + String((buckets[keyLang] || []).length))
  }
  if (buckets.unknown && buckets.unknown.length) summaryParts.push('unknown=' + String(buckets.unknown.length))
  log('FINAL KEYWORD BUCKETS BUILT: ' + summaryParts.join(', '))

  return buckets
}

function extractKeywordsForTargetLanguage_Updater_(keywordsField, targetLang) {
  var lang = String(targetLang || '').toLowerCase()
  if (!lang) return null

  var accepted = [lang]
  if (lang === 'pt-br') accepted.push('pt')

  var buckets = buildKeywordBucketsByLanguage_Updater_(keywordsField)

  if (lang === 'pl') {
    var rawBucket = (buckets && buckets.pl) ? buckets.pl.slice(0) : []
    log('TARGET BUCKET BUILT (pl): ' + JSON.stringify(rawBucket.slice(0, 20)) + (rawBucket.length > 20 ? (' (+ ' + (rawBucket.length - 20) + ' more)') : ''))
    var purified = []
    for (var j = 0; j < rawBucket.length; j++) {
      var kw2 = String(rawBucket[j] || '').trim()
      if (!kw2) continue
      var t = normalizeForSpecMatch_Updater_(kw2)
      if (/\b(piramides|piramidele)\b/.test(t) || /\b(de|din)\b/.test(t)) {
        log('FALSE POSITIVE REMOVED FROM TARGET BUCKET (pl): ' + kw2)
        continue
      }
      var det2 = detectLanguageSafe_Updater_(kw2)
      if (det2) {
        var d2 = String(det2).toLowerCase()
        if (d2 !== 'pl' && d2.indexOf('pl') !== 0) {
          log('FALSE POSITIVE REMOVED FROM TARGET BUCKET (pl): ' + kw2)
          continue
        }
      }
      var ok = false
      try { ok = /[ąćęłńóśźż]/i.test(kw2) } catch (eOk) { ok = false }
      if (!ok) {
        if (/\b(wycieczka|zwiedzanie|warto|zobaczyc|zobaczyć|piramidy|muzeum|egipskie|cytadela|saladyna|stary)\b/.test(t)) ok = true
        else if (/\b(w|we|z)\s+(kairze|kair|gizie|giza)\b/.test(t)) ok = true
      }
      if (!ok) {
        log('FALSE POSITIVE REMOVED FROM TARGET BUCKET (pl): ' + kw2)
        continue
      }
      purified.push(kw2)
    }
    buckets.pl = purified
    log('TARGET BUCKET PURIFIED (pl): ' + JSON.stringify(purified.slice(0, 20)) + (purified.length > 20 ? (' (+ ' + (purified.length - 20) + ' more)') : ''))
  }

  var picked = []
  accepted.forEach(function (code) {
    if (buckets && buckets[code] && buckets[code].length) {
      buckets[code].forEach(function (x) { picked.push(x) })
    }
  })
  picked = picked.map(function (x) { return String(x || '').trim() }).filter(function (x) { return !!x })
  if (!picked.length) {
    log('NO VALID TARGET-LANGUAGE KEYWORD FOUND - USING NATURAL TRANSLATION (' + lang + ')')
    return null
  }

  var seen = {}
  var uniq = []
  picked.forEach(function (s) {
    var k = String(s || '').toLowerCase()
    if (!k || seen[k]) return
    seen[k] = true
    uniq.push(String(s || '').trim())
  })

  var out = {
    primary: uniq[0] || '',
    secondary: uniq.length > 1 ? uniq.slice(1, 5) : [],
    all: uniq
  }
  log('TARGET-LANGUAGE KEYWORDS EXTRACTED (' + lang + '): ' + JSON.stringify(out.all.slice(0, 8)) + (out.all.length > 8 ? (' (+ ' + (out.all.length - 8) + ' more)') : ''))
  if (out.primary) log('TARGET-LANGUAGE PRIMARY KEYWORD SELECTED (' + lang + '): ' + out.primary)
  log('FALLBACK NOT USED - TARGET BUCKET NOT EMPTY (' + lang + ')')
  return out
}

function extractSeoFocusKeywordsListFromTripsFieldOnly_Updater_(tripFields) {
  var f = tripFields || {};
  var list = [];
  var v = f.SEO_FocusKeywords_List;
  if (v) {
    if (Array.isArray(v)) list = list.concat(v.map(function(x) { return String(x || '').trim(); }));
    else list = list.concat(String(v).split(/[,;\n]+/).map(function(x) { return String(x || '').trim(); }));
  }
  list = list.filter(function(s) { return !!s; });
  var seen = {};
  var uniq = [];
  list.forEach(function(s) {
    var k = s.toLowerCase();
    if (seen[k]) return;
    seen[k] = true;
    uniq.push(s);
  });
  return uniq;
}

function selectKeywordsFromSeoFocusKeywordsListForLang_Updater_(tripFields, targetLang) {
  var lang = String(targetLang || '').toLowerCase();
  if (!lang) return null;

  var list = extractSeoFocusKeywordsListFromTripsFieldOnly_Updater_(tripFields);
  if (!list.length) return null;
  return extractKeywordsForTargetLanguage_Updater_(list, lang)
}

function isNeutralPlaceKeyword_Updater_(phrase) {
  var s = String(phrase || '').trim();
  if (!s) return false;
  if (s.length > 40) return false;
  if (/[^a-zA-Z\u00C0-\u024F\s\-]/.test(s)) return false;
  var words = s.split(/\s+/).filter(function(w) { return !!w; });
  if (words.length < 1 || words.length > 3) return false;
  var lower = s.toLowerCase();
  var blocked = ['tour', 'tours', 'trip', 'excursion', 'safari', 'desert', 'désert', 'white', 'bbq', 'observation'];
  for (var i = 0; i < blocked.length; i++) {
    if (lower.indexOf(blocked[i]) !== -1) return false;
  }
  return true;
}

function appendNeutralPlaceKeywords_Updater_(selected, keywordsList, targetLang) {
  var out = selected || { primary: '', secondary: [], all: [] };
  var list = (keywordsList || []).map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x; });
  var lang = String(targetLang || '').toLowerCase();
  var neutral = list.filter(isNeutralPlaceKeyword_Updater_).filter(function(n) {
    if (!lang) return true;
    var detected = detectLangHeuristicForKeyword_Updater_(n);
    if (!detected) return true;
    return langMatchesOrBase_Updater_(detected, lang);
  });
  if (!neutral.length) return out;

  var existing = {};
  [out.primary].concat(out.secondary || []).forEach(function(k) {
    var s = String(k || '').trim();
    if (!s) return;
    existing[s.toLowerCase()] = true;
  });

  neutral.forEach(function(n) {
    var key = String(n).toLowerCase();
    if (existing[key]) return;
    if (!out.secondary) out.secondary = [];
    if (out.secondary.length < 4) out.secondary.push(n);
    existing[key] = true;
  });

  out.all = [out.primary].concat(out.secondary || []).filter(function(x) { return !!String(x || '').trim(); });
  return out;
}

async function selectSeoKeywordsFromMultilingualList_Updater_(keywordsList, targetLang) {
  var lang = String(targetLang || '').toLowerCase();
  var list = (keywordsList || []).map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x; });
  if (!list.length || !lang) return null;
  return extractKeywordsForTargetLanguage_Updater_(list, lang)
}

function extractProvidedSeoKeywordsForLang_Updater_(tripFields, targetLang) {
  var f = tripFields || {};
  var lang = String(targetLang || '').toLowerCase();
  if (!lang) return null;

  var aliases = {
    en: ['en', 'english'],
    fr: ['fr', 'french'],
    de: ['de', 'german'],
    es: ['es', 'spanish'],
    tr: ['tr', 'turkish'],
    ru: ['ru', 'russian'],
    ro: ['ro', 'romanian']
  };

  var langAliases = aliases[lang] || [lang];
  var candidates = [];

  for (var key in f) {
    if (!f.hasOwnProperty(key)) continue;
    var name = String(key || '');
    var lower = name.toLowerCase();
    if (lower.indexOf('keyword') === -1 && lower.indexOf('focus') === -1) continue;

    var matchesLang = false;
    for (var i = 0; i < langAliases.length; i++) {
      var a = langAliases[i];
      var re = new RegExp('(^|[^a-z])' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z]|$)', 'i');
      if (re.test(lower)) {
        matchesLang = true;
        break;
      }
    }
    if (!matchesLang) continue;
    candidates.push(key);
  }

  if (!candidates.length) return null;

  var raw = '';
  candidates.forEach(function(k) {
    var v = f[k];
    if (v === null || v === undefined) return;
    if (Array.isArray(v)) v = v.join(',');
    raw += String(v) + ',';
  });

  var parts = raw.split(/[,;\n]+/).map(function(s) { return String(s || '').trim(); }).filter(function(s) { return !!s; });
  var seen = {};
  var uniq = [];
  parts.forEach(function(s) {
    var key = s.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    uniq.push(s);
  });

  if (!uniq.length) return null;

  return {
    primary: uniq[0],
    secondary: uniq.slice(1, 4),
    all: uniq
  };
}

function pickProvidedSeoKeywordsForLang_Updater_(provided, targetLang) {
  var lang = String(targetLang || '').toLowerCase();
  if (!provided || !provided.primary) return null;
  if (lang === 'en') return provided;

  var sample = [provided.primary].concat(provided.secondary || []).join(' | ');
  var detected = detectLanguageSafe_Updater_(sample);
  if (detected && !langMatchesOrBase_Updater_(detected, lang)) return null;
  return provided;
}

var SEO_INTERNAL_LINKS = {
  fr: [
    { url: 'https://ftstravels.com/fr/tours/', anchor: 'excursions en Égypte' },
    { url: 'https://ftstravels.com/fr/', anchor: 'voyages en Égypte' }
  ],
  en: [
    { url: 'https://ftstravels.com/tours/', anchor: 'Egypt tours' },
    { url: 'https://ftstravels.com/', anchor: 'Egypt travel' }
  ]
};

var SEO_EXTERNAL_LINKS = {
  fr: [
    { url: 'https://maps.google.com/', anchor: 'voir l’emplacement sur la carte' }
  ],
  en: [
    { url: 'https://maps.google.com/', anchor: 'view the location on the map' }
  ]
};

function sanitizeHTML_Updater_(html) {
  var s = String(html || '');
  if (!s) return s;

  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  s = s.replace(/\n{2,}/g, '<br><br>');
  s = s.replace(/\n/g, '<br>');

  s = s.replace(/<\s*font\b[^>]*>/gi, '').replace(/<\s*\/\s*font\s*>/gi, '');
  s = s.replace(/\sstyle\s*=\s*(['"])[\s\S]*?\1/gi, '');
  s = s.replace(/\sclass\s*=\s*(['"])[\s\S]*?\1/gi, '');
  s = s.replace(/\sid\s*=\s*(['"])[\s\S]*?\1/gi, '');
  s = s.replace(/\son\w+\s*=\s*(['"])[\s\S]*?\1/gi, '');
  s = s.replace(/<\s*span\b[^>]*>/gi, '').replace(/<\s*\/\s*span\s*>/gi, '');
  s = s.replace(/<\s*br\b[^>]*>/gi, '<br>');

  var allowed = { p: true, h2: true, h3: true, ul: true, li: true, strong: true, em: true, br: true };
  s = s.replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, function(full, tag) {
    var t = String(tag || '').toLowerCase();
    if (!allowed[t]) return '';
    if (t === 'br') return '<br>';
    return full.charAt(1) === '/' ? ('</' + t + '>') : ('<' + t + '>');
  });

  s = s.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
  return s;
}

function buildEnglishTranslationSourceSnapshot_Updater_(enhancedData) {
  var data = enhancedData || {};
  var g = data.general || {};

  var content = {
    title: g.AI_SEO_Title || '',
    slug: g.AI_SEO_Permalink || '',
    meta_desc: g.AI_SEO_Meta_Description || '',
    description: g.AI_Trip_Description || '',
    short_summary: g.AI_Short_Summary || '',
    excerpt: g.AI_Excerpt || '',
    highlights_title: g.AI_Trip_Highlights_Section_Title || '',
    overview_title: g.AI_Overview_Section_Title || '',
    itinerary_title: g.AI_Itinerary_Section_Title || '',
    itinerary_desc: g.AI_Itinerary_Description || '',
    faq_title: g.AI_FAQ_Section_Title || '',
    cost_title: g.AI_Cost_Section_Title || '',
    inc_title: g.AI_Cost_Includes_Title || '',
    exc_title: g.AI_Cost_Excludes_Title || '',
    facts_title: g.AI_Trip_Facts_Section_Title || '',
    why_love_title: g.AI_Why_People_Love_This_Trip_Section_Title || ''
  };

  var highlights = (data.highlights || []).map(function(h) {
    var f = h && h.fields ? h.fields : {};
    return f.AI_Highlight || '';
  });
  var includes = (data.includes || []).map(function(i) {
    var f = i && i.fields ? i.fields : {};
    return f.IncludeItem || '';
  });
  var excludes = (data.excludes || []).map(function(e) {
    var f = e && e.fields ? e.fields : {};
    return f.ExcludeItem || '';
  });
  var faqs = (data.faqs || []).map(function(item) {
    var f = item && item.fields ? item.fields : {};
    return { q: f.AI_Question || '', a: f.AI_Answer || '' };
  });
  var itinerary = (data.itinerary || []).map(function(step) {
    var f = step && step.fields ? step.fields : {};
    return { title: f.AI_Step_Title || '', desc: f.AI_Step_Description || '', label: f.AI_Step_Label || '' };
  });

  return {
    core: content,
    lists: { highlights: highlights, includes: includes, excludes: excludes, faqs: faqs },
    itinerary: itinerary
  };
}

function attachSourceTripMediaToTranslationPayload_(translatedPayload, sourceTripInfo) {
  if (!translatedPayload || !sourceTripInfo) return translatedPayload;
  translatedPayload.meta = translatedPayload.meta || {};
  var meta = sourceTripInfo.meta || {};

  var featId = null;
  if (meta._thumbnail_id) featId = meta._thumbnail_id;
  if (!featId && sourceTripInfo.featured_image && sourceTripInfo.featured_image.id) featId = sourceTripInfo.featured_image.id;
  if (Array.isArray(featId)) featId = featId[0];

  if (featId) {
    translatedPayload.meta._thumbnail_id = featId;
    log('TRANSLATION FEATURED IMAGE ATTACHED: ' + featId);
  }

  var galObj = meta.wpte_gallery_id;
  if (Array.isArray(galObj)) galObj = galObj[0];
  if (typeof galObj === 'string') {
    var trimmed = galObj.trim();
    if (trimmed && trimmed.charAt(0) === '{') {
      try { galObj = JSON.parse(trimmed); } catch (e) {}
    }
  }

  if (galObj && typeof galObj === 'object') {
    if (galObj.enable === undefined) galObj.enable = "1";
    translatedPayload.meta.wpte_gallery_id = galObj;
    var count = 0;
    for (var kk in galObj) {
      if (!galObj.hasOwnProperty(kk)) continue;
      if (kk === 'enable') continue;
      if (galObj[kk]) count++;
    }
    log('TRANSLATION GALLERY ATTACHED: ' + count);
  }

  return translatedPayload;
}

function mergeTranslationMetaFromSourceTrip_Updater_(translatedPayload, sourceTripInfo) {
  if (!translatedPayload || !sourceTripInfo) return translatedPayload;
  translatedPayload.meta = translatedPayload.meta || {};
  var metaOut = translatedPayload.meta;
  var sourceMeta = sourceTripInfo.meta || {};

  var excludedExact = {
    wp_travel_engine_setting: true,
    schema_trip_data: true,
    trip_schema_data: true,
    faq_schema_data: true,
    _thumbnail_id: true,
    wpte_gallery_id: true
  };

  for (var k in sourceMeta) {
    if (!sourceMeta.hasOwnProperty(k)) continue;
    if (excludedExact[k]) continue;
    if (metaOut.hasOwnProperty(k)) continue;

    var key = String(k || '');
    var lower = key.toLowerCase();
    if (!key) continue;
    if (lower.indexOf('icl_') === 0 || lower.indexOf('_icl_') === 0) continue;
    if (lower.indexOf('wpml') === 0 || lower.indexOf('_wpml') === 0) continue;
    if (lower.indexOf('_edit_') === 0) continue;
    if (lower === '_wp_old_slug') continue;

    var shouldCopy =
      lower.indexOf('wpte_') === 0 ||
      lower.indexOf('wte_') === 0 ||
      lower.indexOf('trip_') === 0 ||
      lower.indexOf('wp_travel_engine_') === 0 ||
      lower.indexOf('rank_math_') === 0;

    if (!shouldCopy) continue;

    metaOut[key] = sourceMeta[k];
  }

  var sourceSettings = sourceMeta.wp_travel_engine_setting;
  if (sourceSettings && typeof sourceSettings === 'object') {
    var mergedSettings = null;
    try {
      mergedSettings = JSON.parse(JSON.stringify(sourceSettings));
    } catch (e) {
      mergedSettings = sourceSettings;
    }

    var translatedSettings = metaOut.wp_travel_engine_setting;
    if (translatedSettings && typeof translatedSettings === 'object') {
      for (var sk in translatedSettings) {
        if (!translatedSettings.hasOwnProperty(sk)) continue;
        mergedSettings[sk] = translatedSettings[sk];
      }
    }

    metaOut.wp_travel_engine_setting = mergedSettings;
  }

  return translatedPayload;
}

function buildTripImagesMetaPayloadFromSourceTripInfo_Updater_(sourceTripInfo) {
  var payload = { meta: {} };
  var ids = collectSourceTripImageIds_Updater_(sourceTripInfo);
  if (!ids) return null;
  if (ids.featuredId) payload.meta._thumbnail_id = ids.featuredId;

  var meta = sourceTripInfo && sourceTripInfo.meta ? sourceTripInfo.meta : {};
  var galObj = meta.wpte_gallery_id;
  if (Array.isArray(galObj)) galObj = galObj[0];
  if (typeof galObj === 'string') {
    var trimmed = galObj.trim();
    if (trimmed && trimmed.charAt(0) === '{') {
      try { galObj = JSON.parse(trimmed); } catch (e) {}
    }
  }
  if (galObj && typeof galObj === 'object') {
    if (galObj.enable === undefined) galObj.enable = "1";
    payload.meta.wpte_gallery_id = galObj;
  } else if (ids.galleryIds && ids.galleryIds.length) {
    var fallback = { "enable": "1" };
    ids.galleryIds.forEach(function(id, idx) { fallback[String(idx)] = id; });
    payload.meta.wpte_gallery_id = fallback;
  }
  if (!payload.meta._thumbnail_id && !payload.meta.wpte_gallery_id) return null;
  return payload;
}

async function applySourceTripImagesToTrip_Updater_(wpTripId, sourceTripInfo) {
  var p = buildTripImagesMetaPayloadFromSourceTripInfo_Updater_(sourceTripInfo);
  if (!p) return;
  await pushToWordPress_Updater_(wpTripId, p);
  var featId = p.meta && p.meta._thumbnail_id ? p.meta._thumbnail_id : null;
  var galObj = p.meta ? p.meta.wpte_gallery_id : null;
  var count = 0;
  if (galObj && typeof galObj === 'object') {
    for (var kk in galObj) {
      if (!galObj.hasOwnProperty(kk)) continue;
      if (kk === 'enable') continue;
      if (galObj[kk]) count++;
    }
  }
  if (featId) log('TRANSLATION FEATURED IMAGE ATTACHED: ' + featId);
  if (galObj) log('TRANSLATION GALLERY ATTACHED: ' + count);
}

// ----------------------------------------------------------
// AI TRANSLATION HELPER
// ----------------------------------------------------------

function sanitizeTranslatedSlug_(text) {
  var s = String(text || '');
  if (!s) return '';
  try {
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch (e) {}
  s = s.toLowerCase();
  s = s.replace(/&/g, ' and ');
  s = s.replace(/[^a-z0-9]+/g, '-');
  s = s.replace(/-+/g, '-');
  s = s.replace(/^-+|-+$/g, '');
  return s;
}

function finalizeTranslatedSlug_Updater_(raw, opts) {
  var maxLen = opts && opts.maxLen ? Number(opts.maxLen) : 80
  if (!Number.isFinite(maxLen) || maxLen <= 0) maxLen = 80

  var original = sanitizeTranslatedSlug_(raw)
  if (!original) return ''
  if (original.length <= maxLen) return original

  var baseUnits = [
    'old-cairo',
    'alt-kairo',
    'egyptian-museum',
    'egyptian-civilization-museum',
    'national-museum-of-egyptian-civilization',
    'khan-el-khalili',
    'quad-biking',
    'horse-riding',
    'orange-bay',
    'water-sports',
    'grand-egyptian-museum'
  ]
  var units = baseUnits.slice()
  if (opts && opts.spec && opts.spec.landmark_slugs && Array.isArray(opts.spec.landmark_slugs)) {
    opts.spec.landmark_slugs.forEach(function (x) { units.push(x) })
  }
  var seenUnits = {}
  units = units.map(function (x) { return sanitizeTranslatedSlug_(x) }).filter(function (x) {
    if (!x) return false
    if (seenUnits[x]) return false
    seenUnits[x] = true
    return true
  })

  var tokens = original.split('-').filter(function (t) { return !!t })
  var outTokens = []
  for (var i = 0; i < tokens.length; i++) {
    var candidate = outTokens.concat([tokens[i]]).join('-')
    if (candidate.length > maxLen) break
    outTokens.push(tokens[i])
  }
  if (!outTokens.length) outTokens = tokens.slice(0, 1)

  function endsWithSeq_(arr, seq) {
    if (arr.length < seq.length) return false
    for (var j = 0; j < seq.length; j++) {
      if (arr[arr.length - seq.length + j] !== seq[j]) return false
    }
    return true
  }

  var didTrim = true
  while (didTrim) {
    didTrim = false
    for (var u = 0; u < units.length; u++) {
      var unit = units[u]
      if (!unit) continue
      if (original.indexOf(unit) === -1) continue
      var unitTokens = unit.split('-').filter(function (t) { return !!t })
      if (unitTokens.length < 2) continue
      if (endsWithSeq_(outTokens, unitTokens)) continue
      for (var k = 1; k < unitTokens.length; k++) {
        var prefix = unitTokens.slice(0, k)
        if (endsWithSeq_(outTokens, prefix)) {
          outTokens = outTokens.slice(0, outTokens.length - k)
          didTrim = true
          break
        }
      }
      if (didTrim) break
    }
  }

  var didTrim2 = true
  while (didTrim2) {
    didTrim2 = false
    for (var u2 = 0; u2 < units.length; u2++) {
      var unit2 = units[u2]
      if (!unit2) continue
      var unitTokens2 = unit2.split('-').filter(function (t) { return !!t })
      if (unitTokens2.length < 2) continue
      if (endsWithSeq_(outTokens, unitTokens2)) continue
      for (var k2 = 1; k2 < unitTokens2.length; k2++) {
        var prefix2 = unitTokens2.slice(0, k2)
        if (endsWithSeq_(outTokens, prefix2)) {
          outTokens = outTokens.slice(0, outTokens.length - k2)
          didTrim2 = true
          break
        }
      }
      if (didTrim2) break
    }
  }

  var stop = { of: true, and: true, the: true, to: true, in: true, at: true, on: true, for: true }
  while (outTokens.length) {
    var last = String(outTokens[outTokens.length - 1] || '')
    if (!last) { outTokens.pop(); continue }
    if (last.length < 2) { outTokens.pop(); continue }
    if (stop[last]) { outTokens.pop(); continue }
    break
  }

  if (opts && opts.spec) {
    var enRef = normalizeForEnglishPhraseScan_Updater_(String(opts.spec.english_title || '') + ' ' + String(opts.spec.english_meta || '') + ' ' + String(opts.spec.english_slug || ''))
    var hasOldCairo = enRef.indexOf('old cairo') !== -1
    if (hasOldCairo && outTokens.length && String(outTokens[outTokens.length - 1]) === 'alt') {
      outTokens.pop()
    }
  }

  function trimTrailingUnitPrefix_(slugText) {
    var s0 = String(slugText || '').replace(/-+$/g, '')
    if (!s0) return ''
    var toks = s0.split('-').filter(function (t) { return !!t })
    if (!toks.length) return ''
    var changed = true
    while (changed && toks.length) {
      changed = false
      for (var uu = 0; uu < units.length; uu++) {
        var unit3 = units[uu]
        if (!unit3 || original.indexOf(unit3) === -1) continue
        var ut = unit3.split('-').filter(function (t) { return !!t })
        if (ut.length < 2) continue
        if (endsWithSeq_(toks, ut)) continue
        for (var kk = 1; kk < ut.length; kk++) {
          var pref = ut.slice(0, kk)
          if (endsWithSeq_(toks, pref)) {
            toks = toks.slice(0, toks.length - kk)
            changed = true
            break
          }
        }
        if (changed) break
      }
    }
    return toks.join('-').replace(/-+$/g, '')
  }

  var out = outTokens.join('-')
  out = out.replace(/-+$/g, '')
  out = trimTrailingUnitPrefix_(out)
  if (!out) out = outTokens.slice(0, 1).join('-')
  if (out.length > maxLen) {
    out = out.substring(0, maxLen)
    out = out.replace(/-+$/g, '')
    out = trimTrailingUnitPrefix_(out)
  }
  return out
}

function validateNewTranslationSlugSemanticCompleteness_Updater_(slug, targetLang, kw, spec) {
  var out = { ok: true, reasons: [], warnings: [], slug: '', accepted_as_good_enough: false }
  var s = sanitizeTranslatedSlug_(slug)
  out.slug = s
  if (!s) {
    out.ok = false
    out.reasons.push('empty_slug')
    return out
  }

  var parts = s.split('-').filter(function (t) { return !!t })
  var last = parts.length ? String(parts[parts.length - 1]) : ''
  var weakTail = { old: true, new: true, and: true, of: true, the: true, to: true, in: true, at: true, on: true, for: true }
  if (s.length < 10) out.reasons.push('slug_too_short')
  if (last && (weakTail[last] || last.length < 2)) out.reasons.push('weak_trailing_token_' + last)

  var hasDayTours = (s.indexOf('day-tours') !== -1) || (s.indexOf('day') !== -1 && s.indexOf('tours') !== -1)
  if (hasDayTours) out.reasons.push('multilingual_hybrid_day_tours')

  var cityVariants = { cairo: false, kairo: false, kahire: false, caire: false }
  var cityCounts = { cairo: 0, kairo: 0, kahire: 0, caire: 0 }
  for (var i = 0; i < parts.length; i++) {
    var p = String(parts[i] || '')
    if (cityVariants.hasOwnProperty(p)) {
      cityVariants[p] = true
      cityCounts[p] = (cityCounts[p] || 0) + 1
    }
  }
  var presentCities = Object.keys(cityVariants).filter(function (k) { return cityVariants[k] })
  if (String(targetLang || '').toLowerCase() !== 'en' && presentCities.length >= 2) out.reasons.push('multilingual_hybrid_city_variants_' + presentCities.join('_'))
  presentCities.forEach(function (c) {
    if (cityCounts[c] && cityCounts[c] >= 2) out.reasons.push('repeated_city_token_' + c)
  })

  if (isGenericSlug_Updater_(s, targetLang, spec)) {
    if (parts.length >= 4 && s.length >= 14) out.warnings.push('acceptable_localized_slug_genericness_soft')
    else out.reasons.push('slug_generic')
  }

  var place = spec && spec.place ? sanitizeTranslatedSlug_(spec.place) : ''
  if (place && s.indexOf(place) === -1) out.warnings.push('missing_destination_intent')

  var enRef = normalizeForEnglishPhraseScan_Updater_(String((spec && (spec.english_landmark_title || spec.english_title)) || '') + ' ' + String((spec && (spec.english_landmark_meta || spec.english_meta)) || '') + ' ' + String((spec && (spec.english_landmark_slug || spec.english_slug)) || ''))
  var requireCitadel = enRef.indexOf('citadel') !== -1
  if (requireCitadel) {
    if (s.indexOf('citadel') === -1 && s.indexOf('zitadelle') === -1 && s.indexOf('fortress') === -1) out.warnings.push('missing_citadel_intent')
  }

  var fam = spec && spec.landmark_canonical_museum_family ? String(spec.landmark_canonical_museum_family).toLowerCase() : ''
  if (fam === 'civilization') {
    if (s.indexOf('nmec') === -1 && s.indexOf('civilization') === -1) out.warnings.push('missing_museum_family_civilization')
  } else if (fam === 'egyptian') {
    if (s.indexOf('museum') === -1) out.warnings.push('missing_museum_intent')
  }

  var oldStrong = enRef.indexOf('old cairo') !== -1 && (enRef.indexOf('old-cairo') !== -1 || enRef.indexOf('alt-kairo') !== -1)
  if (oldStrong) {
    if (s.indexOf('old-cairo') === -1 && s.indexOf('alt-kairo') === -1 && s.indexOf('altkairo') === -1) out.warnings.push('old_cairo_missing_in_slug')
  }

  out.ok = out.reasons.length === 0
  if (out.ok && out.warnings.length) out.accepted_as_good_enough = true
  return out
}

function buildDeterministicFallbackSlugForCreate_Updater_(targetLang, kw, spec, translatedPayload) {
  var lang = String(targetLang || '').toLowerCase()
  var s = spec || {}
  var p = translatedPayload || {}
  var meta = p.meta || {}
  var core = p.core || {}

  var titleBase = String(meta.rank_math_title || core.title || '').trim()
  var baseSlug = sanitizeTranslatedSlug_(titleBase)
  var wantedRaw = kw && kw.primary ? buildShortSlugFromPrimaryKeyword_Updater_(kw.primary) : ''
  var wantedParts = wantedRaw ? sanitizeTranslatedSlug_(wantedRaw).split('-').filter(function (t) { return !!t }) : []
  wantedParts = wantedParts.filter(function (t) { return t !== 'day' && t !== 'tours' && t !== 'nmec' })
  var wanted = wantedParts.join('-')

  var toks = baseSlug ? baseSlug.split('-').filter(function (t) { return !!t }) : []
  var filtered = []
  var seen = {}
  for (var i = 0; i < toks.length; i++) {
    var t = String(toks[i] || '')
    if (!t) continue
    if (t === 'day' || t === 'tours' || t === 'nmec') continue
    if (seen[t]) continue
    seen[t] = true
    filtered.push(t)
  }

  if (lang !== 'en') {
    var cityVariants = { cairo: false, kairo: false, kahire: false, caire: false }
    for (var j = 0; j < filtered.length; j++) {
      var v = filtered[j]
      if (cityVariants.hasOwnProperty(v)) cityVariants[v] = true
    }
    var presentCities = Object.keys(cityVariants).filter(function (k) { return cityVariants[k] })
    if (presentCities.length >= 2) {
      var keep = presentCities[0]
      if (wanted) {
        for (var c = 0; c < presentCities.length; c++) {
          if (wanted.indexOf(presentCities[c]) !== -1) { keep = presentCities[c]; break }
        }
      }
      filtered = filtered.filter(function (x) { return !cityVariants.hasOwnProperty(x) || x === keep })
    }
  }

  var joined = filtered.join('-')
  if (wanted && joined.indexOf(wanted) === -1) joined = (wanted + (joined ? ('-' + joined) : ''))
  joined = joined.replace(/(^|-)day-tours(-|$)/g, '-').replace(/(^|-)day(-|$)/g, '-').replace(/(^|-)tours(-|$)/g, '-').replace(/(^|-)nmec(-|$)/g, '-')
  joined = joined.replace(/-+/g, '-').replace(/^-+|-+$/g, '')
  return finalizeTranslatedSlug_Updater_(joined, { maxLen: 80, spec: s })
}

function normalizeTripCode_Updater_(raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (!s) return '';

  if (/^\d+$/.test(s)) return 'FTS-' + s;

  var mFts = s.match(/^fts[-\s]?(\d+)$/i);
  if (mFts) return 'FTS-' + mFts[1];

  var mWte = s.match(/^wte[-\s]?(\d+)$/i);
  if (mWte) return 'FTS-' + mWte[1];

  return s;
}

async function translateFocusKeywords_Updater_(focusKeywordString, targetLang) {
  var raw = String(focusKeywordString || '').trim();
  if (!raw) return '';
  var items = raw.split(',').map(function(s) { return String(s || '').trim(); }).filter(function(s) { return !!s; });
  if (items.length === 0) return '';

  var prompt =
    "Translate each SEO keyword phrase into " + String(targetLang || '').toUpperCase() + ".\n" +
    "RULES:\n" +
    "- Keep the output SEO-friendly and concise.\n" +
    "- Keep proper nouns (places/brands) unchanged.\n" +
    "- Do not add quotes.\n" +
    "- Return ONLY valid JSON with the same number of keywords.\n\n" +
    "INPUT JSON:\n" + JSON.stringify({ keywords: items });

  var res = await callAiForTargetLangWithRetry_Updater_(prompt, targetLang);
  if (res && res.keywords && Array.isArray(res.keywords) && res.keywords.length === items.length) {
    var out = res.keywords.map(function(s) { return String(s || '').trim(); }).filter(function(s) { return !!s; });
    if (out.length) return out.join(', ');
  }

  return raw;
}

async function generateLocalizedFocusKeywords_Updater_(translatedData, targetLang) {
  var data = translatedData || {};
  var g = data.general || {};

  var title = String(g.AI_SEO_Title || '').trim();
  var excerpt = String(g.AI_Excerpt || g.AI_Short_Summary || '').trim();
  var description = String(g.AI_Trip_Description || '').trim();
  var itinerarySummary = String(g.AI_Itinerary_Description || g.itinerary_desc || '').trim();
  var seoDescription = String(g.AI_SEO_Meta_Description || '').trim();
  var highlights = (data.highlights || []).map(function(h) {
    var f = h && h.fields ? h.fields : {};
    return String(f.AI_Highlight || '').trim();
  }).filter(function(s) { return !!s; }).slice(0, 12);

  var textParts = [title, excerpt, description, itinerarySummary, seoDescription].filter(function(s) { return !!s; });
  if (highlights.length) textParts.push(highlights.join(' | '));
  var inputText = textParts.join('\n\n');

  var prompt =
    "You are an expert in Travel SEO and Multilingual Content Localization.\n" +
    "CRITICAL RULES:\n" +
    "- TARGET LANGUAGE ONLY: Return ONLY in " + String(targetLang || '').toLowerCase() + ". Do NOT switch language.\n" +
    "- CONTENT INTEGRITY: Do NOT change any facts.\n" +
    "- SAFE OUTPUT: Return ONLY a valid JSON array of strings.\n\n" +
    "TASK:\n" +
    "Extract 4 to 6 SEO focus keyword phrases based ONLY on the translated travel content.\n" +
    "They must be search-friendly, location-aware if possible, and natural.\n\n" +
    "CONTENT:\n" + inputText;

  var res = await callAiForTargetLangWithRetry_Updater_(prompt, targetLang);
  var keywords = [];
  if (res && Array.isArray(res)) {
    keywords = res;
  } else if (res && res.keywords && Array.isArray(res.keywords)) {
    keywords = res.keywords;
  }

  var seen = {};
  var cleaned = [];
  keywords.forEach(function(k) {
    var s = String(k || '').trim();
    if (!s) return;
    var key = s.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    cleaned.push(s);
  });

  if (cleaned.length === 0) {
    var fallback = [];
    if (title) fallback.push(title);
    if (highlights.length) fallback.push(highlights[0]);
    cleaned = fallback.map(function(s) { return String(s || '').trim(); }).filter(function(s) { return !!s; });
  }

  if (cleaned.length > 5) cleaned = cleaned.slice(0, 5);
  return cleaned.join(', ');
}

async function generateLocalizedSEO_Updater_(translatedData, targetLang) {
  var data = translatedData || {};
  var g = data.general || {};

  var title = String(g.AI_SEO_Title || '').trim();
  var excerpt = String(g.AI_Excerpt || g.AI_Short_Summary || '').trim();
  var overview = String(g.AI_Trip_Description || '').trim();
  var itinerarySummary = String(g.AI_Itinerary_Description || '').trim();
  var seoDescription = String(g.AI_SEO_Meta_Description || '').trim();
  var highlights = (data.highlights || []).map(function(h) {
    var f = h && h.fields ? h.fields : {};
    return String(f.AI_Highlight || '').trim();
  }).filter(function(s) { return !!s; }).slice(0, 12);
  var itineraryTitles = (data.itinerary || []).map(function(step) {
    var f = step && step.fields ? step.fields : {};
    return String(f.AI_Step_Title || '').trim();
  }).filter(function(s) { return !!s; }).slice(0, 8);

  var location = '';
  if (data.tripDetails) {
    location = String(data.tripDetails.TourLocation || data.tripDetails.Location || data.tripDetails.City || data.tripDetails.Destination || '').trim();
  }
  var activityType = '';
  if (data.tripDetails) {
    activityType = String(data.tripDetails.TourType || '').trim();
  }

  var textParts = [];
  if (title) textParts.push('TITLE: ' + title);
  if (excerpt) textParts.push('EXCERPT: ' + excerpt);
  if (overview) textParts.push('OVERVIEW: ' + overview);
  if (itinerarySummary) textParts.push('ITINERARY SUMMARY: ' + itinerarySummary);
  if (highlights.length) textParts.push('HIGHLIGHTS: ' + highlights.join(' | '));
  if (itineraryTitles.length) textParts.push('ITINERARY TITLES: ' + itineraryTitles.join(' | '));
  if (seoDescription) textParts.push('CURRENT SEO DESCRIPTION: ' + seoDescription);
  if (location) textParts.push('LOCATION: ' + location);
  if (activityType) textParts.push('ACTIVITY TYPE: ' + activityType);

  var prompt =
    "You are an expert in Travel SEO and Multilingual Content Localization.\n" +
    "CRITICAL RULES:\n" +
    "- TARGET LANGUAGE ONLY: Return ONLY in " + String(targetLang || '').toLowerCase() + ". Do NOT switch language.\n" +
    "- CONTENT INTEGRITY: Do NOT change any facts.\n" +
    "- SAFE OUTPUT: Return ONLY valid JSON.\n\n" +
    "TASK:\n" +
    "Using ONLY the translated content below, generate a localized SEO package.\n" +
    "Return ONLY valid JSON with this exact shape:\n" +
    "{\n" +
    "  \"title\": \"...\",\n" +
    "  \"description\": \"...\",\n" +
    "  \"keywords\": [\"...\", \"...\", \"...\"]\n" +
    "}\n" +
    "RULES:\n" +
    "- title: 55 to 65 characters.\n" +
    "- description: 140 to 160 characters.\n" +
    "- keywords: 3 to 5 SEO keyword phrases, natural in the target language.\n" +
    "- Keep proper nouns (places/brands) unchanged.\n\n" +
    "CONTENT:\n" + textParts.join('\n');

  var res = await callAiForTargetLangWithRetry_Updater_(prompt, targetLang);
  var outTitle = '';
  var outDesc = '';
  var outKeywords = '';

  if (res && typeof res === 'object' && !Array.isArray(res)) {
    if (res.title) outTitle = String(res.title).trim();
    if (res.description) outDesc = String(res.description).trim();
    if (res.keywords && Array.isArray(res.keywords)) {
      var seen = {};
      var kw = [];
      res.keywords.forEach(function(k) {
        var s = String(k || '').trim();
        if (!s) return;
        var key = s.toLowerCase();
        if (seen[key]) return;
        seen[key] = true;
        kw.push(s);
      });
      if (kw.length > 5) kw = kw.slice(0, 5);
      outKeywords = kw.join(', ');
    }
  }

  if (!outTitle) outTitle = title;
  if (!outDesc) outDesc = excerpt || seoDescription || overview;
  if (!outKeywords) {
    var words = title.split(/\s+/).map(function(w) { return String(w || '').trim(); }).filter(function(w) { return w.length > 2; });
    var seenW = {};
    var picked = [];
    for (var i = 0; i < words.length && picked.length < 3; i++) {
      var lw = words[i].toLowerCase();
      if (seenW[lw]) continue;
      seenW[lw] = true;
      picked.push(words[i]);
    }
    outKeywords = picked.join(', ');
  }

  outTitle = truncateAtWordBoundary_Updater_(normalizeSeoHeadTextForQuality_Updater_(outTitle), 65)
  outDesc = truncateAtWordBoundary_Updater_(normalizeSeoHeadTextForQuality_Updater_(outDesc), 160)

  return { title: outTitle, description: outDesc, focus_keyword: outKeywords };
}

function splitLongParagraphsForSEO_Updater_(html) {
  var input = String(html || '');
  if (!input) return input;

  var parts = input.split(/<\/p>/i);
  var out = [];

  parts.forEach(function(part) {
    var p = part;
    if (!p || !p.trim()) return;
    if (!/<p\b/i.test(p)) {
      out.push(p + '</p>');
      return;
    }

    var text = p.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.length <= 420) {
      out.push(p + '</p>');
      return;
    }

    var sentences = text.match(/[^\.!\?…]+[\.!\?…]+|[^\.!\?…]+$/g);
    if (!sentences) sentences = [text];
    if (sentences.length < 2) {
      out.push(p + '</p>');
      return;
    }

    var buf = '';
    var chunks = [];
    sentences.forEach(function(s) {
      var next = (buf ? (buf + ' ' + s) : s);
      if (next.length > 260 && buf) {
        chunks.push(buf);
        buf = s;
      } else {
        buf = next;
      }
    });
    if (buf) chunks.push(buf);

    chunks.forEach(function(c) {
      out.push('<p>' + c + '</p>');
    });
  });

  return out.join('');
}

function pickSeoLink_Updater_(linksMap, lang) {
  var l = String(lang || '').toLowerCase();
  var list = linksMap && linksMap[l] ? linksMap[l] : (linksMap && linksMap.en ? linksMap.en : []);
  if (!list || !list.length) return null;
  return list[0];
}

function buildShortSlugFromPrimaryKeyword_Updater_(primaryKeyword) {
  var base = sanitizeTranslatedSlug_(primaryKeyword);
  if (!base) return '';
  var parts = base.split('-').filter(function(s) { return !!s; });
  if (parts.length > 6) parts = parts.slice(0, 6);
  return parts.join('-');
}

function applySeoEnhancementsToOverviewHtml_Updater_(html, seoAssets, lang) {
  var out = String(html || '');
  var primary = seoAssets && seoAssets.primary_keyword ? String(seoAssets.primary_keyword).trim() : '';
  var heading = seoAssets && seoAssets.h2_heading ? String(seoAssets.h2_heading).trim() : '';
  var l = String(lang || '').toLowerCase();

  if (primary) {
    var lower = out.toLowerCase();
    if (lower.indexOf(primary.toLowerCase()) === -1) {
      if (/<p\b/i.test(out)) {
        out = out.replace(/<p\b[^>]*>/i, function(m) { return m + primary + ' — '; });
      } else {
        out = '<p>' + primary + '</p>' + out;
      }
    }
  }

  if (heading) {
    if (!/<h2\b/i.test(out) && !/<h3\b/i.test(out)) {
      out = '<h2>' + heading + '</h2>' + out;
      log('HEADING WITH KEYWORD INSERTED (' + l + ')');
    }
  }

  if (primary) {
    var re = new RegExp(primary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    var matches = out.match(re);
    var count = matches ? matches.length : 0;
    if (count < 2) {
      out = out.replace(/<\/p>/i, function(m) { return ' ' + primary + m; });
    }
  }

  out = splitLongParagraphsForSEO_Updater_(out);
  out = sanitizeHTML_Updater_(out);
  log('HTML SANITIZED (' + l + ')');
  return out;
}

async function generateLocalizedSEOAssets_Updater_(translatedData, targetLang, providedKeywords, spec, seoOpts) {
  var data = translatedData || {};
  var g = data.general || {};
  var kw = providedKeywords || null;
  var specObj = spec || null;
  var strict = !!(seoOpts && seoOpts.strict);

  var title = String(g.AI_SEO_Title || '').trim();
  var excerpt = String(g.AI_Excerpt || g.AI_Short_Summary || '').trim();
  var overview = String(g.AI_Trip_Description || '').trim();
  var itinerarySummary = String(g.AI_Itinerary_Description || '').trim();
  var highlights = (data.highlights || []).map(function(h) {
    var f = h && h.fields ? h.fields : {};
    return String(f.AI_Highlight || '').trim();
  }).filter(function(s) { return !!s; }).slice(0, 10);

  var location = '';
  if (data.tripDetails) {
    location = String(data.tripDetails.TourLocation || data.tripDetails.Location || data.tripDetails.City || data.tripDetails.Destination || '').trim();
  }
  var activityType = '';
  if (data.tripDetails) {
    activityType = String(data.tripDetails.TourType || '').trim();
  }

  var input = [
    title ? ('TITLE: ' + title) : '',
    excerpt ? ('EXCERPT: ' + excerpt) : '',
    overview ? ('OVERVIEW: ' + overview) : '',
    itinerarySummary ? ('ITINERARY SUMMARY: ' + itinerarySummary) : '',
    highlights.length ? ('HIGHLIGHTS: ' + highlights.join(' | ')) : '',
    location ? ('LOCATION: ' + location) : '',
    activityType ? ('ACTIVITY TYPE: ' + activityType) : ''
  ].filter(function(s) { return !!s; }).join('\n');

  var providedBlock = '';
  if (kw && kw.primary) {
    providedBlock =
      "Provided SEO Keywords (MANDATORY):\n" +
      "Primary Keyword: " + kw.primary + "\n" +
      "Secondary Keywords:\n" +
      (kw.secondary && kw.secondary[0] ? ('- ' + kw.secondary[0] + '\n') : '') +
      (kw.secondary && kw.secondary[1] ? ('- ' + kw.secondary[1] + '\n') : '') +
      (kw.secondary && kw.secondary[2] ? ('- ' + kw.secondary[2] + '\n') : '');
  }

  var specBlock = '';
  if (specObj && specObj.landmarks && specObj.landmarks.length) {
    var keep = specObj.landmarks.slice(0, 10).map(function(x) { return '- ' + String(x || '').trim(); }).filter(function(x) { return x.length > 2; }).join('\n');
    var enTitle = specObj.english_title ? String(specObj.english_title) : '';
    var enSlug = specObj.english_slug ? String(specObj.english_slug) : '';
    specBlock =
      "SPECIFICITY PRESERVATION (CRITICAL):\n" +
      "- The English source is more specific. Preserve the same level of specificity.\n" +
      "- Do NOT collapse to a generic city tour/excursion title.\n" +
      "- Title must preserve the main destination intent and key attractions.\n" +
      "- Meta description must preserve key landmarks and main selling points (not vague).\n" +
      "- Slug must remain specific and must not collapse into a generic city-level slug.\n" +
      "- Preserve these key place/attraction names (keep them as-is; do not drop them):\n" +
      keep + "\n" +
      (enTitle ? ("- English reference title (do not translate; use only for specificity): " + enTitle + "\n") : "") +
      (enSlug ? ("- English reference slug (do not copy literally; use only for intent): " + enSlug + "\n") : "") +
      (strict ? "- Title must include at least one of the preserved names above when the English title contains multiple landmarks.\n" : "");
  }

  var prompt =
    "You are an expert in Travel SEO and Multilingual Content Localization.\n\n" +
    "CRITICAL RULES:\n" +
    "1) TARGET LANGUAGE ONLY\n" +
    "You MUST return the result ONLY in the target language: " + String(targetLang || '').toLowerCase() + ".\n" +
    "Never output any other language.\n\n" +
    "2) CONTENT INTEGRITY (100% MATCH)\n" +
    "- Do NOT change itinerary steps, schedule, inclusions, exclusions, pricing facts, durations, logistics, or pickup details.\n" +
    "- Improve wording and SEO phrasing ONLY without altering factual meaning.\n\n" +
    "3) HTML / STRUCTURE PRESERVATION\n" +
    "- Preserve existing HTML as-is.\n" +
    "- Do NOT add <font>, <span>, inline styles, or wrappers.\n\n" +
    "4) SEO LOCALIZATION\n" +
    "- Generate localized SEO based on the translated content itself.\n\n" +
    "5) MANDATORY KEYWORD STRATEGY\n" +
    "- You MUST use the provided Primary Keyword and Secondary Keywords exactly as given (do not translate or alter them).\n" +
    "- The Primary Keyword MUST appear in: SEO Title, URL Slug, Meta Description, H2 heading, Image alt.\n" +
    "- Secondary Keywords should be natural.\n" +
    "- Do NOT stuff keywords.\n\n" +
    (String(targetLang || '').toLowerCase() !== 'en' ? (
      "6) NO GENERIC ENGLISH PHRASES\n" +
      "- For non-English target languages, do NOT keep generic English travel phrasing inside the final title or slug.\n" +
      "- Keep only necessary proper nouns (place/attraction names) in original form.\n\n"
    ) : "") +
    (specBlock ? (specBlock + "\n") : "") +
    "SAFE OUTPUT:\n" +
    "Return valid structured JSON only. No explanations. No markdown.\n\n" +
    "Target Language: " + String(targetLang || '').toLowerCase() + "\n" +
    (providedBlock ? (providedBlock + "\n") : "Provided SEO Keywords (MANDATORY): none\n\n") +
    "Translated / localized source blocks:\n" + input + "\n\n" +
    "REQUIRED JSON OUTPUT:\n" +
    "{\n" +
    "  \"title\": \"Optimized SEO Title\",\n" +
    "  \"description\": \"Optimized Meta Description\",\n" +
    "  \"primary_keyword\": \"Primary Keyword\",\n" +
    "  \"secondary_keywords\": [\"...\", \"...\"],\n" +
    "  \"slug\": \"localized-url-slug\",\n" +
    "  \"h2_heading\": \"H2 heading with keyword\",\n" +
    "  \"image_alt\": \"Image alt text\"\n" +
    "}";

  var res = await callAiForTargetLangWithRetry_Updater_(prompt, targetLang);
  var out = {
    primary_keyword: '',
    secondary_keywords: [],
    title: '',
    description: '',
    slug: '',
    h2_heading: '',
    image_alt: ''
  };

  if (res && typeof res === 'object' && !Array.isArray(res)) {
    if (res.primary_keyword) out.primary_keyword = String(res.primary_keyword).trim();
    if (res.secondary_keywords && Array.isArray(res.secondary_keywords)) {
      out.secondary_keywords = res.secondary_keywords.map(function(s) { return String(s || '').trim(); }).filter(function(s) { return !!s; });
    }
    if (res.title) out.title = String(res.title).trim();
    if (res.description) out.description = String(res.description).trim();
    if (res.slug) out.slug = String(res.slug).trim();
    if (res.h2_heading) out.h2_heading = String(res.h2_heading).trim();
    if (res.image_alt) out.image_alt = String(res.image_alt).trim();
  }

  if (kw && kw.primary) out.primary_keyword = kw.primary;
  if (!out.primary_keyword) out.primary_keyword = title;
  if (out.secondary_keywords.length > 4) out.secondary_keywords = out.secondary_keywords.slice(0, 4);
  if (kw && kw.secondary && kw.secondary.length) {
    out.secondary_keywords = kw.secondary.concat(out.secondary_keywords).map(function(s) { return String(s || '').trim(); }).filter(function(s) { return !!s; }).slice(0, 4);
  }
  if (!out.h2_heading) out.h2_heading = out.primary_keyword;
  if (!out.title) out.title = title;
  if (!out.description) out.description = excerpt || overview;
  if (!out.image_alt) out.image_alt = title;
  if (!out.slug) out.slug = out.primary_keyword;
  out.slug = buildShortSlugFromPrimaryKeyword_Updater_(out.slug) || buildShortSlugFromPrimaryKeyword_Updater_(out.primary_keyword);

  out.title = truncateAtWordBoundary_Updater_(normalizeSeoHeadTextForQuality_Updater_(out.title), 65)
  out.description = truncateAtWordBoundary_Updater_(normalizeSeoHeadTextForQuality_Updater_(out.description), 160)

  return out;
}

function generateTripSchema_Updater_(tripData, targetLang, opts) {
  var d = tripData || {};
  var core = d.core || {};
  var meta = d.meta || {};
  var pricing = d.pricing || {};
  var general = d.general || {};

  var options = opts || {}
  var airtableTripId = options.airtableTripId ? String(options.airtableTripId) : ''

  function buildSchemaOffersFromAirtable_Updater_(tripId, fallbackCurrency, url) {
    var out = { offers: null, source: '', currency: '', offerCount: 0 }
    if (!tripId) return out

    function num_(v) {
      var n = Number(v)
      return isFinite(n) ? n : 0
    }
    function pickStr_(v) {
      if (!v) return ''
      if (Array.isArray(v)) return v[0] != null ? String(v[0]) : ''
      if (typeof v === 'object') return String(v)
      return String(v)
    }
    function pushPrice_(arr, n) {
      var x = Number(n)
      if (isFinite(x) && x > 0) arr.push(x)
    }
    function parseGroupPricing_(raw, arr) {
      var txt = pickStr_(raw)
      if (!txt) return
      try {
        var gp = JSON.parse(txt)
        if (Array.isArray(gp)) {
          gp.forEach(function(row) {
            if (!row) return
            pushPrice_(arr, row.price != null ? row.price : row.Price)
          })
        }
      } catch (e) {}
    }

    var prices = []
    var currency = ''
    var source = ''

    var priceRecords = findRecordsByLinkedId_Updater_('Prices', 'Trip', tripId)
    if (Array.isArray(priceRecords) && priceRecords.length) {
      source = 'Prices'
      priceRecords.forEach(function(rec) {
        var f = rec && rec.fields ? rec.fields : {}
        if (!currency) currency = String(pickStr_(f.Currency) || '').trim()
        var sale = num_(pickStr_(f.SalePrice))
        var regular = num_(pickStr_(f.RegularPrice))
        if (sale > 0) pushPrice_(prices, sale)
        else if (regular > 0) pushPrice_(prices, regular)
        parseGroupPricing_(f.GroupPricing, prices)
      })
    }

    if (!prices.length) {
      var pkgRecords = findRecordsByLinkedId_Updater_('Packages', 'Trip', tripId)
      if (Array.isArray(pkgRecords) && pkgRecords.length) {
        source = 'Packages'
        pkgRecords.forEach(function(rec) {
          var f = rec && rec.fields ? rec.fields : {}
          if (!currency) currency = String(pickStr_(f.Currency) || '').trim()
          var sale = num_(pickStr_(f.SalePrice))
          var regular = num_(pickStr_(f.RegularPrice))
          if (sale > 0) pushPrice_(prices, sale)
          else if (regular > 0) pushPrice_(prices, regular)
          parseGroupPricing_(f.GroupPricing, prices)
          var catsTxt = pickStr_(f.PricingCategories)
          if (catsTxt) {
            try {
              var cats = JSON.parse(catsTxt)
              if (Array.isArray(cats)) {
                cats.forEach(function(cat) {
                  if (!cat) return
                  if (!currency && cat.currency) currency = String(cat.currency || '').trim()
                  var cs = num_(cat.sale_price)
                  var cr = num_(cat.regular_price)
                  if (cs > 0) pushPrice_(prices, cs)
                  else if (cr > 0) pushPrice_(prices, cr)
                  if (cat.group_pricing) {
                    if (Array.isArray(cat.group_pricing)) {
                      cat.group_pricing.forEach(function(gpRow) {
                        if (!gpRow) return
                        pushPrice_(prices, gpRow.price != null ? gpRow.price : gpRow.Price)
                      })
                    } else {
                      parseGroupPricing_(cat.group_pricing, prices)
                    }
                  }
                })
              }
            } catch (eCats) {}
          }
        })
      }
    }

    var seen = {}
    var uniq = []
    for (var i = 0; i < prices.length; i++) {
      var p = Number(prices[i])
      if (!isFinite(p) || p <= 0) continue
      var key = String(p)
      if (seen[key]) continue
      seen[key] = true
      uniq.push(p)
    }
    uniq.sort(function(a, b) { return a - b })
    if (!uniq.length) return out

    currency = currency || String(fallbackCurrency || '').trim() || 'EUR'
    out.currency = currency
    out.source = source || 'unknown'
    out.offerCount = uniq.length

    if (uniq.length === 1) {
      out.offers = {
        "@type": "Offer",
        "priceCurrency": currency,
        "price": uniq[0],
        "availability": "https://schema.org/InStock",
        "url": url || undefined
      }
    } else {
      out.offers = {
        "@type": "AggregateOffer",
        "priceCurrency": currency,
        "lowPrice": uniq[0],
        "highPrice": uniq[uniq.length - 1],
        "offerCount": uniq.length,
        "availability": "https://schema.org/InStock",
        "url": url || undefined
      }
    }
    Object.keys(out.offers).forEach(function(k) { if (out.offers[k] === undefined || out.offers[k] === '') delete out.offers[k] })
    return out
  }

  var lang = String(targetLang || '').toLowerCase()
  var aiSeoTitle = ''
  var aiSeoDesc = ''
  if (lang === 'en' && airtableTripId) {
    try {
      var impRecords = findRecordsByLinkedId_Updater_('Improvement With AI', 'Trip', airtableTripId)
      if (Array.isArray(impRecords) && impRecords.length) {
        var impF = impRecords[0] && impRecords[0].fields ? impRecords[0].fields : {}
        aiSeoTitle = String(impF.AI_SEO_Title || '').trim()
        aiSeoDesc = String(impF.AI_SEO_Meta_Description || '').trim()
      }
    } catch {}
  }

  var seoTitleRaw = ''
  if (meta.rank_math_title && Array.isArray(meta.rank_math_title)) seoTitleRaw = meta.rank_math_title[0]
  else if (meta.rank_math_title && typeof meta.rank_math_title === 'object') seoTitleRaw = String(meta.rank_math_title)
  else if (meta.rank_math_title) seoTitleRaw = meta.rank_math_title
  var title = String(aiSeoTitle || seoTitleRaw || core.title || '').trim();
  var url = String(core.permalink || core.link || '').trim();

  var descRaw = ''
  if (aiSeoDesc) descRaw = aiSeoDesc
  else if (meta.rank_math_description && Array.isArray(meta.rank_math_description)) descRaw = meta.rank_math_description[0]
  else if (meta.rank_math_description && typeof meta.rank_math_description === 'object') descRaw = String(meta.rank_math_description)
  else if (meta.rank_math_description) descRaw = meta.rank_math_description
  else if (core.excerpt) descRaw = core.excerpt
  else if (core.content_html) descRaw = core.content_html

  var description = String(descRaw || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  description = truncateAtWordBoundary_Updater_(description, 240)
  if (lang === 'en') {
    var titleSrc = aiSeoTitle ? 'AI_SEO_Title' : (seoTitleRaw ? 'rank_math_title' : (core.title ? 'core.title' : 'missing'))
    var descSrc = (aiSeoDesc ? 'AI_SEO_Meta_Description' : (meta.rank_math_description ? 'rank_math_description' : (core.excerpt ? 'core.excerpt' : (core.content_html ? 'core.content_html' : 'missing'))))
    log('SCHEMA SOURCE RESOLVED (en, TouristTrip): title=' + titleSrc + ' desc=' + descSrc)
    if (!aiSeoDesc && meta.rank_math_description && (core.content_html || core.excerpt)) log('SCHEMA BYPASSED STALE FALLBACK (en, TouristTrip): used rank_math_description')
    if (!aiSeoTitle && seoTitleRaw && core.title && String(core.title).trim() !== String(seoTitleRaw).trim()) log('SCHEMA BYPASSED STALE FALLBACK (en, TouristTrip): used rank_math_title')
  }

  var images = [];
  if (d.featured_image && d.featured_image.url) images.push(String(d.featured_image.url));
  if (d.gallery && Array.isArray(d.gallery)) {
    d.gallery.forEach(function(img) {
      if (img && img.url) images.push(String(img.url));
    });
  }
  var seenImg = {};
  images = images.filter(function(u) {
    var s = String(u || '').trim();
    if (!s) return false;
    if (seenImg[s]) return false;
    seenImg[s] = true;
    return true;
  });

  var currency = String(pricing.currency || 'EUR')
  var priceVal = pricing.actual_price != null ? pricing.actual_price : pricing.base_price
  var price = priceVal == null ? '' : String(priceVal)

  var offersResolved = buildSchemaOffersFromAirtable_Updater_(airtableTripId, currency, url)
  var offers = offersResolved && offersResolved.offers ? offersResolved.offers : null
  if (!offers) {
    offers = {
      "@type": "Offer",
      "priceCurrency": currency,
      "price": price,
      "availability": "https://schema.org/InStock",
      "url": url || undefined
    }
  } else if (lang === 'en') {
    log('SCHEMA PRICES SOURCE RESOLVED (en, TouristTrip): source=' + offersResolved.source + ' offers=' + (offers['@type'] || 'Offer') + ' count=' + String(offersResolved.offerCount || 0))
    if (offersResolved.source === 'Prices') log('SCHEMA BYPASSED PACKAGES FALLBACK (en, TouristTrip): used Prices')
  }

  var durationText = '';
  if (general.duration && (general.duration.hours || general.duration.minutes)) {
    var h = Number(general.duration.hours || 0);
    var m = Number(general.duration.minutes || 0);
    if (h && m) durationText = h + 'h ' + m + 'm';
    else if (h) durationText = h + 'h';
    else if (m) durationText = m + 'm';
  }

  var destinationName = '';
  var itineraryObj = undefined
  var placeNames = []
  if (d.taxonomies && typeof d.taxonomies === 'object') {
    var candidates = ['destination', 'destinations', 'trip_location', 'trip_locations', 'location', 'tour_location', 'tour_locations']
    for (var i = 0; i < candidates.length; i++) {
      var key = candidates[i]
      var arr = d.taxonomies[key]
      if (!arr || !arr.length) continue
      for (var j = 0; j < arr.length; j++) {
        var t = arr[j]
        if (!t || !t.name) continue
        var nm = String(t.name || '').trim()
        if (!nm) continue
        placeNames.push(nm)
      }
      if (!destinationName && arr[0] && arr[0].name) destinationName = String(arr[0].name).trim()
    }
  }
  var seenPlace = {}
  var uniqPlaces = []
  for (var kP = 0; kP < placeNames.length; kP++) {
    var nm2 = String(placeNames[kP] || '').trim()
    var kk = nm2.toLowerCase()
    if (!nm2 || seenPlace[kk]) continue
    seenPlace[kk] = true
    uniqPlaces.push(nm2)
    if (uniqPlaces.length >= 6) break
  }

  ;(function() {
    var hay = (String(title || '') + ' ' + String(description || '') + ' ' + String(core.content_html || '')).replace(/<[^>]*>/g, ' ').toLowerCase()
    function addPlace_(name) {
      var nm = String(name || '').trim()
      if (!nm) return
      var kk = nm.toLowerCase()
      if (seenPlace[kk]) return
      seenPlace[kk] = true
      uniqPlaces.unshift(nm)
    }
    if (/\bnmec\b/.test(hay) || hay.indexOf('national museum of egyptian civilization') !== -1 || hay.indexOf('egyptian civilization museum') !== -1) {
      addPlace_('National Museum of Egyptian Civilization')
    }
    if (hay.indexOf('citadel of saladin') !== -1 || (hay.indexOf('citadel') !== -1 && hay.indexOf('saladin') !== -1)) {
      addPlace_('Citadel of Saladin')
    }
    if (hay.indexOf('old cairo') !== -1) {
      addPlace_('Old Cairo')
    }
    if (/\bkhan\s+el[\s-]?khalili\b/.test(hay)) {
      addPlace_('Khan El-Khalili')
    }
    if (/\bnile\b/.test(hay)) {
      addPlace_('Nile')
    }

    if (uniqPlaces.length > 1) {
      var cleaned = []
      for (var iP = 0; iP < uniqPlaces.length; iP++) {
        var n0 = String(uniqPlaces[iP] || '').trim()
        var k0 = n0.toLowerCase()
        if (k0 === 'egypt') continue
        cleaned.push(n0)
      }
      uniqPlaces = cleaned
    }
    if (uniqPlaces.length > 2) {
      var cleaned2 = []
      for (var iP2 = 0; iP2 < uniqPlaces.length; iP2++) {
        var n1 = String(uniqPlaces[iP2] || '').trim()
        var k1 = n1.toLowerCase()
        if (k1 === 'cairo') continue
        cleaned2.push(n1)
      }
      uniqPlaces = cleaned2
    }
    if (uniqPlaces.length > 6) uniqPlaces = uniqPlaces.slice(0, 6)
  })()
  if (uniqPlaces.length === 1) {
    itineraryObj = { "@type": "Place", "name": uniqPlaces[0] }
  } else if (uniqPlaces.length > 1) {
    var items = []
    for (var pi = 0; pi < uniqPlaces.length; pi++) {
      items.push({
        "@type": "ListItem",
        "position": pi + 1,
        "item": { "@type": "Place", "name": uniqPlaces[pi] }
      })
    }
    itineraryObj = { "@type": "ItemList", "itemListElement": items }
  } else if (destinationName) {
    itineraryObj = { "@type": "Place", "name": destinationName }
  }

  var providerUrl = ''
  if (url && /^https?:\/\//i.test(url)) {
    var mSite = String(url).match(/^https?:\/\/[^\/]+/i)
    if (mSite && mSite[0]) providerUrl = mSite[0]
  }
  var provider = { "@type": "TravelAgency", "name": "FTS Travels", "url": providerUrl || undefined }

  var touristTypeVal = 'Sightseeing Travelers'
  var hayType = (String(title || '') + ' ' + String(description || '')).toLowerCase()
  var culture = /(museum|citadel|temple|mosque|church|coptic|old cairo|khan|bazaar|market|heritage|historic|history|ancient|artifacts?|pharaoh|civilization)/i.test(hayType)
  var adventure = /(desert|safari|quad|atv|snorkel|snorkeling|diving|hike|hiking|trek|trekking|camp|camping|adventure)/i.test(hayType)
  if (culture) touristTypeVal = ['Cultural Travelers', 'History Lovers']
  else if (adventure) touristTypeVal = 'Adventure Travelers'

  var schema = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    "name": title,
    "description": description,
    "url": url || undefined,
    "mainEntityOfPage": url ? { "@type": "WebPage", "@id": url } : undefined,
    "image": images.length ? images : undefined,
    "touristType": touristTypeVal,
    "provider": provider,
    "inLanguage": String(targetLang || '').trim() || undefined,
    "offers": offers,
    "itinerary": itineraryObj,
    "duration": durationText || undefined
  };

  Object.keys(schema).forEach(function(k) { if (schema[k] === undefined) delete schema[k]; });
  if (schema.offers) {
    Object.keys(schema.offers).forEach(function(k) { if (schema.offers[k] === undefined || schema.offers[k] === '') delete schema.offers[k]; });
  }
  if (schema.provider) {
    Object.keys(schema.provider).forEach(function(k) { if (schema.provider[k] === undefined || schema.provider[k] === '') delete schema.provider[k]; });
  }

  return schema;
}

function generateFaqSchema_Updater_(enhancedTripData, wpTripInfo, targetLang) {
  var lang = String(targetLang || 'en').toLowerCase()
  var t = wpTripInfo || {}
  var core = t.core || {}
  var meta = t.meta || {}
  var g = enhancedTripData && enhancedTripData.general ? enhancedTripData.general : {}
  var faqs = enhancedTripData && enhancedTripData.faqs ? enhancedTripData.faqs : []
  if (!Array.isArray(faqs) || faqs.length === 0) return null

  function norm_(s) { return String(s || '').replace(/\s+/g, ' ').trim() }
  function stripHtml_(s) { return norm_(String(s || '').replace(/<[^>]*>/g, ' ')) }

  var mainEntity = []
  faqs.forEach(function(f) {
    var fields = f && f.fields ? f.fields : f
    var q = stripHtml_(fields && (fields.AI_Question || fields.question || fields.Q || fields.q) ? (fields.AI_Question || fields.question || fields.Q || fields.q) : '')
    var a = stripHtml_(fields && (fields.AI_Answer || fields.answer || fields.A || fields.a) ? (fields.AI_Answer || fields.answer || fields.A || fields.a) : '')
    if (!q || !a) return
    mainEntity.push({
      "@type": "Question",
      "name": q,
      "acceptedAnswer": { "@type": "Answer", "text": a }
    })
  })
  if (mainEntity.length === 0) return null

  var seoTitleRaw = ''
  if (meta.rank_math_title && Array.isArray(meta.rank_math_title)) seoTitleRaw = meta.rank_math_title[0]
  else if (meta.rank_math_title && typeof meta.rank_math_title === 'object') seoTitleRaw = String(meta.rank_math_title)
  else if (meta.rank_math_title) seoTitleRaw = meta.rank_math_title
  var title = String(seoTitleRaw || g.AI_SEO_Title || core.title || '').trim()
  var url = String(core.permalink || core.link || '').trim()

  var descRaw = ''
  if (meta.rank_math_description && Array.isArray(meta.rank_math_description)) descRaw = meta.rank_math_description[0]
  else if (meta.rank_math_description && typeof meta.rank_math_description === 'object') descRaw = String(meta.rank_math_description)
  else if (meta.rank_math_description) descRaw = meta.rank_math_description
  var description = String(descRaw || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (description) description = truncateAtWordBoundary_Updater_(description, 240)

  if (lang === 'en') {
    var titleSrc2 = seoTitleRaw ? 'rank_math_title' : ((g.AI_SEO_Title || core.title) ? (g.AI_SEO_Title ? 'AI_SEO_Title' : 'core.title') : 'missing')
    var descSrc2 = meta.rank_math_description ? 'rank_math_description' : (description ? 'resolved' : 'missing')
    log('SCHEMA SOURCE RESOLVED (en, FAQPage): title=' + titleSrc2 + ' desc=' + descSrc2)
    if (meta.rank_math_description) log('SCHEMA BYPASSED STALE FALLBACK (en, FAQPage): used rank_math_description')
  }

  var schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "inLanguage": lang,
    "mainEntity": mainEntity,
    "description": description || undefined
  }
  Object.keys(schema).forEach(function(k) { if (schema[k] === undefined) delete schema[k] })
  if (title) schema.name = title
  if (url) schema.url = url
  return schema
}

/**
 * Translates enhanced trip data into a target language using AI (DeepSeek).
 * Focuses on user-facing content: Title, Slug, Meta, Description, Itinerary, FAQs.
 */
async function translateTripData_Updater_(data, targetLang, providedKeywords, spec) {
  log('Updater: Translating trip data to ' + targetLang + ' using DeepSeek...');
  
  // Clone data to avoid modifying original
  var newData = JSON.parse(JSON.stringify(data));
  var g = newData.general || {};
  var kw = providedKeywords || null;
  var specObj = spec || null;
  var preserveBlock = '';
  if (specObj && specObj.landmarks && specObj.landmarks.length) {
    preserveBlock = specObj.landmarks.slice(0, 10).map(function(x) { return '- ' + String(x || '').trim(); }).filter(function(x) { return x.length > 2; }).join('\n');
  }

  var sourceEnglishSlug = data && data.general && data.general.AI_SEO_Permalink ? sanitizeTranslatedSlug_(data.general.AI_SEO_Permalink) : '';

  // 1. Prepare Content for Translation
  // Include SEO fields (Slug, Meta Desc) which were missing in previous versions
  var contentToTranslate = {
    title: g.AI_SEO_Title || '',
    slug: g.AI_SEO_Permalink || '', // ✅ Added Slug
    meta_desc: g.AI_SEO_Meta_Description || '', // ✅ Added Meta Description
    description: g.AI_Trip_Description || '',
    short_summary: g.AI_Short_Summary || '',
    excerpt: g.AI_Excerpt || '',
    highlights_title: g.AI_Trip_Highlights_Section_Title || 'Highlights',
    overview_title: g.AI_Overview_Section_Title || 'Overview',
    itinerary_title: g.AI_Itinerary_Section_Title || 'Itinerary',
    itinerary_desc: g.AI_Itinerary_Description || '',
    faq_title: g.AI_FAQ_Section_Title || 'FAQ',
    cost_title: g.AI_Cost_Section_Title || 'Prices & Details',
    inc_title: g.AI_Cost_Includes_Title || "What's Included",
    exc_title: g.AI_Cost_Excludes_Title || "What's Not Included",
    facts_title: g.AI_Trip_Facts_Section_Title || 'Trip Facts',
    why_love_title: g.AI_Why_People_Love_This_Trip_Section_Title || 'Why People Love This Trip',
    why_love_body: g.AI_Tab_Content || ''
  };

  // Add arrays (Itinerary steps, FAQs, Includes, Excludes, Highlights)
  var highlights = newData.highlights.map(function(h) { return h.fields.AI_Highlight; });
  var includes = newData.includes.map(function(i) { return i.fields.IncludeItem; });
  var excludes = newData.excludes.map(function(e) { return e.fields.ExcludeItem; });
  
  var faqs = newData.faqs.map(function(f) { 
    return { q: f.fields.AI_Question, a: f.fields.AI_Answer }; 
  });
  
  var itinerary = newData.itinerary.map(function(step) {
    return {
      title: step.fields.AI_Step_Title,
      desc: step.fields.AI_Step_Description,
      label: step.fields.AI_Step_Label
    };
  });
  
  // 2. Split Translation into Chunks
  var translatedJson = {};
  
  // --- Chunk 1: Core Fields & SEO ---
  // Explicitly prompt for URL-friendly slug and SEO optimization
  var providedKwBlock = '';
  if (kw && kw.primary) {
    providedKwBlock =
      "Provided SEO Keywords (MANDATORY):\n" +
      "Primary Keyword: " + kw.primary + "\n" +
      "Secondary Keywords:\n" +
      (kw.secondary && kw.secondary[0] ? ('- ' + kw.secondary[0] + '\n') : '') +
      (kw.secondary && kw.secondary[1] ? ('- ' + kw.secondary[1] + '\n') : '') +
      (kw.secondary && kw.secondary[2] ? ('- ' + kw.secondary[2] + '\n') : '');
  }

  var corePrompt = 
    "You are a native-level travel localization editor and SEO translator.\n" +
    "Localize (not literal-translate) the JSON content into " + targetLang.toUpperCase() + " so it reads fully native, polished, and premium.\n" +
    "RULES (CRITICAL):\n" +
    "- TARGET LANGUAGE ONLY: Output ONLY in (" + targetLang.toLowerCase() + "). No English leakage. No mixed-language phrases.\n" +
    "- CONTENT INTEGRITY: Preserve ALL facts exactly (numbers, prices, durations, pickup/logistics, timings). Do NOT add new facts.\n" +
    "- COMPLETENESS: Do NOT omit any detail from the source. Every detail must remain represented.\n" +
    "- SPECIFICITY PRESERVATION: If the English title is specific, the translated title/meta/slug MUST remain specific and persuasive (not generic).\n" +
    (preserveBlock ? (
      "- PRESERVE THESE PLACE/ATTRACTION NAMES EXACTLY IF PRESENT IN THE INPUT (do not drop them):\n" + preserveBlock + "\n"
    ) : "") +
    "- STRUCTURE PARITY: Keep the same JSON keys, same structure, same meaning.\n" +
    "- HTML LOCK: Preserve existing HTML tags exactly. Do NOT add new tags. Do NOT wrap with <font>/<span> or inline styles.\n" +
    "- TONE: Premium travel brand voice (natural, persuasive, not robotic).\n" +
    "- CONSISTENCY: Use consistent terminology across title/meta/body. Avoid inconsistent synonyms.\n" +
    (providedKwBlock ? (
      "- KEYWORD SAFETY (DO NOT FORCE UNSAFE WORDING):\n" +
      "  - If a provided SEO keyword is ALREADY correctly written in the target language and sounds natural → preserve and use it naturally.\n" +
      "  - If a provided keyword contains foreign words, partial untranslated wording, mixed-language wording, or unnatural phrasing → do NOT force it as-is.\n" +
      "    Silently normalize/localize it into a fully natural target-language equivalent.\n" +
      "  - Proper nouns/official brand names/official landmark names may stay unchanged.\n" +
      "  - Never keyword-stuff. Avoid awkward repetition.\n"
    ) : "") +
    "- SEO FIELDS:\n" +
    "  - 'slug': Localize meaning (do NOT mirror the English slug). Lowercase, hyphenated, URL-safe.\n" +
    "    No mixed-language slug. Do NOT reuse English words unless they are true locked proper nouns.\n" +
    "    Output slug using only [a-z0-9-]. If the target language is non-Latin, transliterate into natural Latin slug form.\n" +
    "  - 'meta_desc': Natural, persuasive, concise (ideally <=160 chars), no stuffing.\n" +
    "- OUTPUT: Return ONLY valid JSON. No markdown. No explanations.\n" +
    "- SELF-CHECK BEFORE OUTPUT: target-language-only, no mixed-language, valid JSON, full structural parity.\n\n" +
    (providedKwBlock ? (providedKwBlock + "\n") : "") +
    "INPUT JSON:\n" + JSON.stringify(contentToTranslate);
    
  var coreRes = await callAiForTargetLangWithRetry_Updater_(corePrompt, targetLang);
  if (coreRes) translatedJson.core = coreRes;

  // --- Chunk 2: Lists (Includes FAQs) ---
  var listPrompt = 
    "You are a native-level travel localization editor.\n" +
    "Localize these lists into " + targetLang.toUpperCase() + " so they read natural, polished, and consistent.\n" +
    "RULES (CRITICAL):\n" +
    "- TARGET LANGUAGE ONLY: Output ONLY in (" + targetLang.toLowerCase() + "). No English leakage. No mixed-language phrases.\n" +
    "- CONTENT INTEGRITY: Keep meaning and facts identical.\n" +
    "- STRUCTURE PARITY: Keep the same keys, same item counts, and the same order.\n" +
    "- COMPLETENESS: Do NOT drop or shorten away meaningful details.\n" +
    (preserveBlock ? (
      "- PRESERVE THESE PLACE/ATTRACTION NAMES EXACTLY IF PRESENT IN THE INPUT (do not drop them):\n" + preserveBlock + "\n"
    ) : "") +
    "- HTML LOCK: Preserve existing HTML exactly. Do NOT add tags/spans/styles.\n" +
    "- OUTPUT: Return ONLY valid JSON. No markdown.\n" +
    "INPUT JSON:\n" + JSON.stringify({
        highlights: highlights,
        includes: includes,
        excludes: excludes,
        faqs: faqs
    });
    
  var listRes = await callAiForTargetLangWithRetry_Updater_(listPrompt, targetLang);
  if (listRes) translatedJson.lists = listRes;

  // --- Chunk 3: Itinerary ---
  if (itinerary.length > 0) {
    var itinPrompt = 
      "You are a native-level travel localization editor.\n" +
      "Localize this itinerary into " + targetLang.toUpperCase() + " with fully natural native phrasing.\n" +
      "RULES (CRITICAL):\n" +
      "- TARGET LANGUAGE ONLY: Output ONLY in (" + targetLang.toLowerCase() + "). No English leakage. No mixed-language phrases.\n" +
      "- STRUCTURE PARITY: Do NOT add/remove/merge/split items. Keep the same order.\n" +
      "- FACT LOCK: Preserve times, numbers, durations, logistics, emojis, and punctuation exactly.\n" +
      "- COMPLETENESS: Keep ALL details from each step. Do NOT summarize away specifics.\n" +
      (preserveBlock ? (
        "- PRESERVE THESE PLACE/ATTRACTION NAMES EXACTLY IF PRESENT IN THE INPUT (do not drop them):\n" + preserveBlock + "\n"
      ) : "") +
      "- HTML LOCK: Preserve existing HTML tags exactly. Do NOT add tags/spans/styles.\n" +
      "- OUTPUT FORMAT: Return ONLY a JSON object with EXACTLY this shape: {\"itinerary\":[{\"title\":\"...\",\"desc\":\"...\",\"label\":\"...\"}, ...]}.\n" +
      "- LENGTH: Output itinerary length MUST equal input length exactly.\n" +
      "- OUTPUT: Return ONLY valid JSON. No markdown.\n" +
      "INPUT JSON:\n" + JSON.stringify({ itinerary: itinerary });
    var itinRes = await callAiForTargetLangWithRetry_Updater_(itinPrompt, targetLang);
    var itinArr = null;
    if (itinRes && Array.isArray(itinRes)) {
      itinArr = itinRes;
    } else if (itinRes && itinRes.itinerary && Array.isArray(itinRes.itinerary)) {
      itinArr = itinRes.itinerary;
    } else if (itinRes && typeof itinRes === 'object') {
      var keys = Object.keys(itinRes).filter(function(k) { return /^\d+$/.test(String(k)); }).sort(function(a, b) { return Number(a) - Number(b); });
      if (keys.length) itinArr = keys.map(function(k) { return itinRes[k]; });
    }
    if (itinArr && itinArr.length === itinerary.length) {
      translatedJson.itinerary = itinArr;
    } else {
      log('Updater: itinerary translation missing/invalid for ' + targetLang + ' (kept original)');
      var strictItinPrompt =
        "Localize this itinerary into " + targetLang.toUpperCase() + ". Return ONLY valid JSON.\n" +
        "CRITICAL (STRICT):\n" +
        "- TARGET LANGUAGE ONLY: Output ONLY in (" + targetLang.toLowerCase() + "). No English leakage. No mixed-language phrases.\n" +
        "- Return ONLY a JSON object with EXACTLY this shape: {\"itinerary\":[{\"title\":\"...\",\"desc\":\"...\",\"label\":\"...\"}, ...]}.\n" +
        "- The output itinerary array length MUST equal the input itinerary length exactly.\n" +
        "- Use the SAME order as input. Do NOT add/remove/merge/split items.\n" +
        "- Preserve times, numbers, emojis, punctuation, and HTML tags exactly.\n" +
        "- COMPLETENESS: Keep ALL details from each step.\n" +
        "INPUT JSON:\n" + JSON.stringify({ itinerary: itinerary });
      var itinRes2 = await callAiForTargetLangWithRetry_Updater_(strictItinPrompt, targetLang);
      var itinArr2 = null;
      if (itinRes2 && itinRes2.itinerary && Array.isArray(itinRes2.itinerary)) itinArr2 = itinRes2.itinerary;
      if (itinArr2 && itinArr2.length === itinerary.length) {
        translatedJson.itinerary = itinArr2;
        log('Updater: itinerary translated on strict retry for ' + targetLang);
      }
    }
  }

  // --- Chunk 4: Trip Facts Values + Extra Services (AddOns) ---
  var factsToTranslate = newData.facts.map(function(rec) {
    return { label: rec.fields.AI_Fact_Label || '', value: rec.fields.AI_Fact_Value || '' };
  });
  var addonsToTranslate = newData.addons.map(function(rec) {
    return { title: rec.fields.AI_AddOn_Title || '', desc: rec.fields.AI_AddOn_Description || '' };
  });
  if (factsToTranslate.length > 0 || addonsToTranslate.length > 0) {
    var extrasPrompt =
      "You are a native-level travel localization editor.\n" +
      "Localize these facts and add-ons into " + targetLang.toUpperCase() + " with natural native phrasing.\n" +
      "RULES (CRITICAL):\n" +
      "- TARGET LANGUAGE ONLY: Output ONLY in (" + targetLang.toLowerCase() + "). No English leakage. No mixed-language phrases.\n" +
      "- FACT LOCK: Preserve numbers, prices, durations, units, and logistics exactly.\n" +
      "- STRUCTURE PARITY: Keep the same keys, item counts, and order.\n" +
      "- COMPLETENESS: Do NOT omit details from fact values or add-on descriptions.\n" +
      "- HTML LOCK: Preserve existing HTML exactly. Do NOT add tags/spans/styles.\n" +
      "- Trip facts: translate both 'label' and 'value'.\n" +
      "- OUTPUT: Return ONLY valid JSON. No markdown.\n" +
      "INPUT JSON:\n" + JSON.stringify({ facts: factsToTranslate, addons: addonsToTranslate });
    var extrasRes = await callAiForTargetLangWithRetry_Updater_(extrasPrompt, targetLang);
    if (extrasRes) translatedJson.extras = extrasRes;
  }
  
  // 4. Apply Translations
  if (translatedJson) {
    // Apply Core
    if (translatedJson.core) {
      var c = translatedJson.core;
      if (c.title) g.AI_SEO_Title = c.title;
      var slugCandidate = c.slug ? finalizeTranslatedSlug_Updater_(c.slug, { maxLen: 80, spec: specObj }) : '';
      if (!slugCandidate) {
        slugCandidate = finalizeTranslatedSlug_Updater_(c.title || g.AI_SEO_Title || '', { maxLen: 80, spec: specObj });
      }
      if (slugCandidate && sourceEnglishSlug && slugCandidate === sourceEnglishSlug) {
        slugCandidate = finalizeTranslatedSlug_Updater_(c.title || g.AI_SEO_Title || '', { maxLen: 80, spec: specObj });
      }
      if (slugCandidate) {
        g.AI_SEO_Permalink = slugCandidate;
        log('TRANSLATED SLUG GENERATED: ' + slugCandidate);
      }
      if (c.meta_desc) g.AI_SEO_Meta_Description = c.meta_desc; // ✅ Apply translated Meta Desc
      if (c.description) g.AI_Trip_Description = sanitizeHTML_Updater_(c.description);
      if (c.short_summary) g.AI_Short_Summary = c.short_summary;
      if (c.excerpt) g.AI_Excerpt = c.excerpt;
      if (c.highlights_title) g.AI_Trip_Highlights_Section_Title = c.highlights_title;
      if (c.overview_title) g.AI_Overview_Section_Title = c.overview_title;
      if (c.itinerary_title) g.AI_Itinerary_Section_Title = c.itinerary_title;
      if (c.itinerary_desc) g.AI_Itinerary_Description = c.itinerary_desc;
      if (c.faq_title) g.AI_FAQ_Section_Title = c.faq_title;
      if (c.cost_title) g.AI_Cost_Section_Title = c.cost_title;
      if (c.inc_title) g.AI_Cost_Includes_Title = c.inc_title;
      if (c.exc_title) g.AI_Cost_Excludes_Title = c.exc_title;
      if (c.facts_title) g.AI_Trip_Facts_Section_Title = c.facts_title;
      if (c.why_love_title) g.AI_Why_People_Love_This_Trip_Section_Title = c.why_love_title;
      if (c.why_love_body) g.AI_Tab_Content = sanitizeHTML_Updater_(c.why_love_body);
    }
    
    // Apply Lists
    if (translatedJson.lists) {
      var l = translatedJson.lists;
      if (l.highlights && Array.isArray(l.highlights)) {
        newData.highlights.forEach(function(h, i) { if(l.highlights[i]) h.fields.AI_Highlight = l.highlights[i]; });
      }
      if (l.includes && Array.isArray(l.includes)) {
        newData.includes.forEach(function(inc, i) { if(l.includes[i]) inc.fields.IncludeItem = l.includes[i]; });
      }
      if (l.excludes && Array.isArray(l.excludes)) {
        newData.excludes.forEach(function(exc, i) { if(l.excludes[i]) exc.fields.ExcludeItem = l.excludes[i]; });
      }
      if (l.faqs && Array.isArray(l.faqs)) {
        newData.faqs.forEach(function(f, i) {
          if (l.faqs[i]) {
            if (l.faqs[i].q) f.fields.AI_Question = l.faqs[i].q;
            if (l.faqs[i].a) f.fields.AI_Answer = sanitizeHTML_Updater_(l.faqs[i].a);
          }
        });
      }
    }
    
    if (translatedJson.itinerary && Array.isArray(translatedJson.itinerary)) {
      newData.itinerary.forEach(function(step, i) {
        if (translatedJson.itinerary[i]) {
          if (translatedJson.itinerary[i].title) step.fields.AI_Step_Title = translatedJson.itinerary[i].title;
          if (translatedJson.itinerary[i].desc) step.fields.AI_Step_Description = sanitizeHTML_Updater_(translatedJson.itinerary[i].desc);
          if (translatedJson.itinerary[i].label) step.fields.AI_Step_Label = translatedJson.itinerary[i].label;
        }
      });
    }

    if (translatedJson.extras) {
      var ex = translatedJson.extras;
      if (ex.facts && Array.isArray(ex.facts)) {
        newData.facts.forEach(function(rec, i) {
          if (!ex.facts[i]) return;
          if (ex.facts[i].value) rec.fields.AI_Fact_Value = ex.facts[i].value;
          if (ex.facts[i].label) rec.fields.AI_Fact_Label_Localized = ex.facts[i].label;
        });
      }
      if (ex.addons && Array.isArray(ex.addons)) {
        newData.addons.forEach(function(rec, i) {
          if (!ex.addons[i]) return;
          if (ex.addons[i].title) rec.fields.AI_AddOn_Title = ex.addons[i].title;
          if (ex.addons[i].desc) rec.fields.AI_AddOn_Description = sanitizeHTML_Updater_(ex.addons[i].desc);
        });
      }
    }
  }
  
  log('AI TRANSLATION COMPLETE (' + targetLang.toLowerCase() + ')');
  return newData;
}

async function regenerateTripSection_Updater_(sourceData, translatedData, targetLang, sectionName, spec) {
  var lang = String(targetLang || '').toLowerCase()
  var src = sourceData || {}
  var tr = translatedData || {}
  var preserveBlock = ''
  if (spec && spec.landmarks && spec.landmarks.length) {
    preserveBlock = spec.landmarks.slice(0, 10).map(function (x) { return '- ' + String(x || '').trim() }).filter(function (x) { return x.length > 2 }).join('\n')
  }

  if (sectionName === 'highlights') {
    var inArr = (src.highlights || []).map(function (h) { return h && h.fields ? String(h.fields.AI_Highlight || '') : '' })
    var prompt =
      "Transcreate these highlight bullets into " + lang.toUpperCase() + ".\n" +
      "RULES:\n" +
      "- Same meaning 100%.\n" +
      "- Same number of items 100%.\n" +
      "- Same order 100%.\n" +
      "- Do NOT add/remove/merge/split items.\n" +
      "- Keep numbers, times, prices, locations, and logistics unchanged.\n" +
      "- Preserve any HTML tags exactly as-is.\n" +
      (preserveBlock ? ("PRESERVE THESE PLACE/ATTRACTION NAMES EXACTLY IF PRESENT IN THE INPUT:\n" + preserveBlock + "\n") : "") +
      "Return ONLY valid JSON with this exact shape:\n" +
      "{ \"items\": [\"...\", \"...\" ] }\n\n" +
      "INPUT JSON:\n" + JSON.stringify({ items: inArr })

    var res = await callAiForTargetLangWithRetry_Updater_(prompt, lang)
    var items = res && res.items && Array.isArray(res.items) ? res.items : (Array.isArray(res) ? res : null)
    if (!items || items.length !== inArr.length) return false
    ;(tr.highlights || []).forEach(function (h, i) { if (h && h.fields && items[i]) h.fields.AI_Highlight = String(items[i]) })
    return true
  }

  if (sectionName === 'includes') {
    var incIn = (src.includes || []).map(function (x) { return x && x.fields ? String(x.fields.IncludeItem || '') : '' })
    var pInc =
      "Transcreate these inclusions into " + lang.toUpperCase() + ".\n" +
      "RULES:\n" +
      "- Same meaning 100%.\n" +
      "- Same number of items 100%.\n" +
      "- Same order 100%.\n" +
      "- Do NOT add/remove/merge/split items.\n" +
      "- Keep numbers, times, prices, locations, and logistics unchanged.\n" +
      "- Preserve any HTML tags exactly as-is.\n" +
      (preserveBlock ? ("PRESERVE THESE PLACE/ATTRACTION NAMES EXACTLY IF PRESENT IN THE INPUT:\n" + preserveBlock + "\n") : "") +
      "Return ONLY valid JSON: { \"items\": [\"...\", \"...\" ] }\n\n" +
      "INPUT JSON:\n" + JSON.stringify({ items: incIn })

    var resInc = await callAiForTargetLangWithRetry_Updater_(pInc, lang)
    var incItems = resInc && resInc.items && Array.isArray(resInc.items) ? resInc.items : (Array.isArray(resInc) ? resInc : null)
    if (!incItems || incItems.length !== incIn.length) return false
    ;(tr.includes || []).forEach(function (x, i) { if (x && x.fields && incItems[i]) x.fields.IncludeItem = String(incItems[i]) })
    return true
  }

  if (sectionName === 'excludes') {
    var excIn = (src.excludes || []).map(function (x) { return x && x.fields ? String(x.fields.ExcludeItem || '') : '' })
    var pExc =
      "Transcreate these exclusions into " + lang.toUpperCase() + ".\n" +
      "RULES:\n" +
      "- Same meaning 100%.\n" +
      "- Same number of items 100%.\n" +
      "- Same order 100%.\n" +
      "- Do NOT add/remove/merge/split items.\n" +
      "- Keep numbers, times, prices, locations, and logistics unchanged.\n" +
      "- Preserve any HTML tags exactly as-is.\n" +
      (preserveBlock ? ("PRESERVE THESE PLACE/ATTRACTION NAMES EXACTLY IF PRESENT IN THE INPUT:\n" + preserveBlock + "\n") : "") +
      "Return ONLY valid JSON: { \"items\": [\"...\", \"...\" ] }\n\n" +
      "INPUT JSON:\n" + JSON.stringify({ items: excIn })

    var resExc = await callAiForTargetLangWithRetry_Updater_(pExc, lang)
    var excItems = resExc && resExc.items && Array.isArray(resExc.items) ? resExc.items : (Array.isArray(resExc) ? resExc : null)
    if (!excItems || excItems.length !== excIn.length) return false
    ;(tr.excludes || []).forEach(function (x, i) { if (x && x.fields && excItems[i]) x.fields.ExcludeItem = String(excItems[i]) })
    return true
  }

  if (sectionName === 'faqs') {
    var faqsIn = (src.faqs || []).map(function (x) {
      var ff = x && x.fields ? x.fields : {}
      return { q: String(ff.AI_Question || ''), a: String(ff.AI_Answer || '') }
    })
    var pFaq =
      "Transcreate these FAQs into " + lang.toUpperCase() + ".\n" +
      "RULES:\n" +
      "- Same meaning 100%.\n" +
      "- Same number of items 100%.\n" +
      "- Same order 100%.\n" +
      "- Do NOT add/remove/merge/split items.\n" +
      "- Keep numbers, times, prices, locations, and logistics unchanged.\n" +
      "- Preserve any HTML tags exactly as-is.\n" +
      (preserveBlock ? ("PRESERVE THESE PLACE/ATTRACTION NAMES EXACTLY IF PRESENT IN THE INPUT:\n" + preserveBlock + "\n") : "") +
      "Return ONLY valid JSON with exact shape:\n" +
      "{ \"faqs\": [{\"q\":\"...\",\"a\":\"...\"}] }\n\n" +
      "INPUT JSON:\n" + JSON.stringify({ faqs: faqsIn })

    var resFaq = await callAiForTargetLangWithRetry_Updater_(pFaq, lang)
    var faqsOut = resFaq && resFaq.faqs && Array.isArray(resFaq.faqs) ? resFaq.faqs : (Array.isArray(resFaq) ? resFaq : null)
    if (!faqsOut || faqsOut.length !== faqsIn.length) return false
    ;(tr.faqs || []).forEach(function (x, i) {
      if (!x || !x.fields || !faqsOut[i]) return
      if (faqsOut[i].q) x.fields.AI_Question = String(faqsOut[i].q)
      if (faqsOut[i].a) x.fields.AI_Answer = sanitizeHTML_Updater_(String(faqsOut[i].a))
    })
    return true
  }

  if (sectionName === 'itinerary') {
    var itIn = (src.itinerary || []).map(function (x) {
      var ff = x && x.fields ? x.fields : {}
      return { title: String(ff.AI_Step_Title || ''), desc: String(ff.AI_Step_Description || ''), label: String(ff.AI_Step_Label || '') }
    })
    var pIt =
      "Transcreate this itinerary into " + lang.toUpperCase() + ".\n" +
      "RULES:\n" +
      "- Same meaning 100%.\n" +
      "- Same number of steps 100%.\n" +
      "- Same order 100%.\n" +
      "- Do NOT add/remove/merge/split steps.\n" +
      "- Keep times, durations, pickup points, and logistics unchanged.\n" +
      "- Preserve any HTML tags exactly as-is.\n" +
      (preserveBlock ? ("PRESERVE THESE PLACE/ATTRACTION NAMES EXACTLY IF PRESENT IN THE INPUT:\n" + preserveBlock + "\n") : "") +
      "Return ONLY valid JSON:\n" +
      "{ \"itinerary\": [{\"title\":\"...\",\"desc\":\"...\",\"label\":\"...\"}] }\n\n" +
      "INPUT JSON:\n" + JSON.stringify({ itinerary: itIn })

    var resIt = await callAiForTargetLangWithRetry_Updater_(pIt, lang)
    var itOut = resIt && resIt.itinerary && Array.isArray(resIt.itinerary) ? resIt.itinerary : (Array.isArray(resIt) ? resIt : null)
    if (!itOut || itOut.length !== itIn.length) return false
    ;(tr.itinerary || []).forEach(function (x, i) {
      if (!x || !x.fields || !itOut[i]) return
      if (itOut[i].title) x.fields.AI_Step_Title = String(itOut[i].title)
      if (itOut[i].desc) x.fields.AI_Step_Description = sanitizeHTML_Updater_(String(itOut[i].desc))
      if (itOut[i].label) x.fields.AI_Step_Label = String(itOut[i].label)
    })
    return true
  }

  return false
}

async function regenerateCoreFields_Updater_(sourceData, translatedData, targetLang, kw, spec) {
  var lang = String(targetLang || '').toLowerCase()
  var srcG = (sourceData && sourceData.general) ? sourceData.general : {}
  var trG = (translatedData && translatedData.general) ? translatedData.general : {}
  var specObj = spec || null
  var input = {
    title: srcG.AI_SEO_Title || '',
    slug: srcG.AI_SEO_Permalink || '',
    meta_desc: srcG.AI_SEO_Meta_Description || '',
    description: srcG.AI_Trip_Description || '',
    short_summary: srcG.AI_Short_Summary || '',
    excerpt: srcG.AI_Excerpt || '',
    highlights_title: srcG.AI_Trip_Highlights_Section_Title || '',
    overview_title: srcG.AI_Overview_Section_Title || '',
    itinerary_title: srcG.AI_Itinerary_Section_Title || '',
    itinerary_desc: srcG.AI_Itinerary_Description || '',
    faq_title: srcG.AI_FAQ_Section_Title || '',
    cost_title: srcG.AI_Cost_Section_Title || '',
    inc_title: srcG.AI_Cost_Includes_Title || '',
    exc_title: srcG.AI_Cost_Excludes_Title || '',
    facts_title: srcG.AI_Trip_Facts_Section_Title || '',
    why_love_title: srcG.AI_Why_People_Love_This_Trip_Section_Title || '',
    why_love_body: srcG.AI_Tab_Content || ''
  }

  var kwBlock = ''
  if (kw && kw.primary) {
    kwBlock =
      "Provided SEO Keywords (MANDATORY):\n" +
      "Primary Keyword: " + String(kw.primary) + "\n" +
      "Secondary Keywords:\n" +
      (kw.secondary && kw.secondary[0] ? ('- ' + kw.secondary[0] + '\n') : '') +
      (kw.secondary && kw.secondary[1] ? ('- ' + kw.secondary[1] + '\n') : '') +
      (kw.secondary && kw.secondary[2] ? ('- ' + kw.secondary[2] + '\n') : '')
  }

  var specBlock = ''
  if (specObj && specObj.landmarks && specObj.landmarks.length) {
    var keep = specObj.landmarks.slice(0, 10).map(function (x) { return '- ' + String(x || '').trim() }).filter(function (x) { return x.length > 2 }).join('\n')
    var enTitle = specObj.english_title ? String(specObj.english_title) : ''
    specBlock =
      "SPECIFICITY PRESERVATION (CRITICAL):\n" +
      "- Preserve the same level of specificity as the English source.\n" +
      "- Do NOT collapse title/slug/meta into a generic city tour.\n" +
      "- Preserve these key place/attraction names (keep them as-is; do not drop them):\n" +
      keep + "\n" +
      (enTitle ? ("- English reference title (do not translate; use only for specificity): " + enTitle + "\n") : "")
  }

  var prompt =
    "Transcreate the following JSON core fields into " + lang.toUpperCase() + ".\n" +
    "RULES:\n" +
    "- Same meaning 100%.\n" +
    "- Keep the same JSON keys 100%.\n" +
    "- Keep numbers, times, prices, logistics, and pickup details unchanged.\n" +
    "- Preserve any HTML tags exactly as-is.\n" +
    "- Keep tone natural, local, and professional (no literal translation).\n" +
    "- 'slug' must be URL-friendly (lowercase Latin letters/digits and hyphens only).\n" +
    "- If the English title is specific, the translated title must remain specific (must not become generic).\n" +
    "- Return ONLY valid JSON.\n\n" +
    (specBlock ? (specBlock + "\n") : "") +
    (kwBlock ? (kwBlock + "\n") : "") +
    "INPUT JSON:\n" + JSON.stringify(input)

  var res = await callAiForTargetLangWithRetry_Updater_(prompt, lang)
  if (!res || typeof res !== 'object' || Array.isArray(res)) return false

  if (res.title) trG.AI_SEO_Title = String(res.title)
  if (res.slug) trG.AI_SEO_Permalink = sanitizeTranslatedSlug_(String(res.slug))
  if (res.meta_desc) trG.AI_SEO_Meta_Description = String(res.meta_desc)
  if (res.description) trG.AI_Trip_Description = sanitizeHTML_Updater_(String(res.description))
  if (res.short_summary) trG.AI_Short_Summary = String(res.short_summary)
  if (res.excerpt) trG.AI_Excerpt = String(res.excerpt)
  if (res.highlights_title) trG.AI_Trip_Highlights_Section_Title = String(res.highlights_title)
  if (res.overview_title) trG.AI_Overview_Section_Title = String(res.overview_title)
  if (res.itinerary_title) trG.AI_Itinerary_Section_Title = String(res.itinerary_title)
  if (res.itinerary_desc) trG.AI_Itinerary_Description = String(res.itinerary_desc)
  if (res.faq_title) trG.AI_FAQ_Section_Title = String(res.faq_title)
  if (res.cost_title) trG.AI_Cost_Section_Title = String(res.cost_title)
  if (res.inc_title) trG.AI_Cost_Includes_Title = String(res.inc_title)
  if (res.exc_title) trG.AI_Cost_Excludes_Title = String(res.exc_title)
  if (res.facts_title) trG.AI_Trip_Facts_Section_Title = String(res.facts_title)
  if (res.why_love_title) trG.AI_Why_People_Love_This_Trip_Section_Title = String(res.why_love_title)
  if (res.why_love_body) trG.AI_Tab_Content = sanitizeHTML_Updater_(String(res.why_love_body))

  translatedData.general = trG
  return true
}

// Helper for AI Call with Retry & Cleaning
async function callAiWithRetry_Updater_(prompt) {
  var maxRetries = 2;
  for (var attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) await sleep(2000);
      
      var rawResponse = await callDeepseekJson_(prompt);
      
      if (typeof rawResponse === 'object' && rawResponse !== null) return rawResponse;
      
      if (typeof rawResponse === 'string') {
        var clean = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        var first = clean.indexOf('{');
        var last = clean.lastIndexOf('}');
        if (first !== -1 && last !== -1) clean = clean.substring(first, last + 1);
        return JSON.parse(clean);
      }
    } catch (e) {
      log('Updater: AI Chunk Error (Attempt ' + (attempt + 1) + '): ' + e.message);
    }
  }
  return null;
}

function detectLanguageSafe_Updater_(text) {
  try {
    var s = String(text || '');
    if (!s) return '';
    if(/[\u0400-\u04FF]/.test(s)) return 'ru';
    if(/[\u4E00-\u9FFF]/.test(s)) {
      if (/[简体汉语龙门车云乐书东观发后机万与为这来里]/.test(s)) return 'zh-hans';
      if (/[簡體漢語龍門車雲樂書東觀發後機萬與為這來裡]/.test(s)) return 'zh-hant';
      return 'zh';
    }
    if(/[\u3040-\u30FF]/.test(s)) return 'ja';
    if(/[\uAC00-\uD7AF]/.test(s)) return 'ko';
    if (/[ğşıçöüİ]/i.test(s)) return 'tr';
    if (/[ąćęłńóśźż]/i.test(s)) return 'pl';
    if (/[ăâîșț]/i.test(s)) return 'ro';
    if (/[áéíóúñ¿¡]/i.test(s)) return 'es';
    if (/[àâçéèêëîïôûùüÿœ]/i.test(s)) return 'fr';
    if (/[äöüß]/i.test(s)) return 'de';
    return '';
  } catch (e) {
    return '';
  }
}

function langMatchesOrBase_Updater_(detected, targetLang) {
  var d = String(detected || '').toLowerCase();
  var t = String(targetLang || '').toLowerCase();
  if (!d || !t) return false;
  if (d === t) return true;
  var dp = d.split('-');
  var tp = t.split('-');
  if (!dp[0] || !tp[0]) return false;
  if (dp[0] !== tp[0]) return false;
  if (dp.length === 1 || tp.length === 1) return true;
  return false;
}

function collectStringsForLangValidation_Updater_(value, out, depth) {
  if (depth > 4) return;
  if (value === null || value === undefined) return;
  if (typeof value === 'string') {
    var s = value.trim();
    if (s) out.push(s);
    return;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return;
  if (Array.isArray(value)) {
    for (var i = 0; i < value.length; i++) {
      collectStringsForLangValidation_Updater_(value[i], out, depth + 1);
      if (out.length >= 30) return;
    }
    return;
  }
  if (typeof value === 'object') {
    for (var k in value) {
      if (!value.hasOwnProperty(k)) continue;
      collectStringsForLangValidation_Updater_(value[k], out, depth + 1);
      if (out.length >= 30) return;
    }
  }
}

async function callAiForTargetLangWithRetry_Updater_(prompt, targetLang, opts) {
  var lang = String(targetLang || '').toLowerCase();
  var neutralTokens = opts && opts.neutralTokens && Array.isArray(opts.neutralTokens) ? opts.neutralTokens : [];
  var supported = (UPDATER_SUPPORTED_LANGUAGE_CODES_ || getSupportedLanguageAliasMap_Updater_() && UPDATER_SUPPORTED_LANGUAGE_CODES_) || {};
  if (lang && !supported[lang]) {
    throw new Error('Unsupported target language: ' + lang);
  }
  var supportedList = Object.keys(supported).filter(function(k) { return !!supported[k]; }).sort().join(', ');
  var guardedPrompt =
    "target_language = " + lang + "\n" +
    "STRICT RULE:\n" +
    "Return the result ONLY in the exact target language code requested: " + lang + ".\n" +
    "Never output any other language.\n" +
    (supportedList ? ("The target language must be one of the supported site languages only: " + supportedList + ".\n") : "") +
    "Do NOT change the language.\n\n" +
    prompt;

  var maxLangAttempts = 2;
  for (var attempt = 0; attempt < maxLangAttempts; attempt++) {
    var res = await callAiWithRetry_Updater_(guardedPrompt);
    if (!res) return null;

    if (!lang) return res;

    var strings = [];
    collectStringsForLangValidation_Updater_(res, strings, 0);
    var checkText = strings.join(' | ');
    if (!checkText) return res;
    if (neutralTokens.length) {
      neutralTokens.forEach(function(t) {
        var s = String(t || '').trim();
        if (!s) return;
        var re = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        checkText = checkText.replace(re, ' ');
      });
      checkText = checkText.replace(/\s+/g, ' ').trim();
      if (!checkText) return res;
    }

    var detected = detectLanguageSafe_Updater_(checkText);
    if (!detected) return res;

    if (langMatchesOrBase_Updater_(detected, lang)) {
      log('LANGUAGE VALIDATION PASSED (' + lang + ')');
      return res;
    }

    log('LANGUAGE VALIDATION FAILED – regenerating (' + lang + ')');
    guardedPrompt =
      "target_language = " + lang + "\n" +
      "STRICT RULE:\n" +
      "Return the result ONLY in the exact target language code requested: " + lang + ".\n" +
      "Never output any other language.\n" +
      (supportedList ? ("The target language must be one of the supported site languages only: " + supportedList + ".\n") : "") +
      "Do NOT change the language.\n" +
      "The previous output language was detected as: " + detected + ".\n" +
      "Regenerate now.\n\n" +
      prompt;
  }

  return null;
}

function containsKeyword_Updater_(text, keyword) {
  var t = String(text || '');
  var k = String(keyword || '').trim();
  if (!t || !k) return false;
  return t.toLowerCase().indexOf(k.toLowerCase()) !== -1;
}

function validateRequiredFieldsCompleteness_Updater_(sourceData, translatedData) {
  var srcG = (sourceData && sourceData.general) ? sourceData.general : {};
  var trG = (translatedData && translatedData.general) ? translatedData.general : {};
  var out = [];
  function req(key, label) {
    var srcVal = String(srcG[key] || '').trim();
    if (!srcVal) return;
    var trVal = String(trG[key] || '').trim();
    if (!trVal) out.push(label);
  }
  req('AI_SEO_Title', 'title');
  req('AI_Trip_Description', 'AI_Trip_Description');
  req('AI_SEO_Meta_Description', 'AI_SEO_Meta_Description');
  req('AI_SEO_Permalink', 'slug');
  req('AI_Trip_Highlights_Section_Title', 'highlights title');
  req('AI_Itinerary_Section_Title', 'itinerary title');
  req('AI_FAQ_Section_Title', 'FAQ title');
  req('AI_Cost_Section_Title', 'cost title');
  req('AI_Cost_Includes_Title', 'includes title');
  req('AI_Cost_Excludes_Title', 'excludes title');
  return out;
}

function fillMissingRequiredFromEnglish_Updater_(sourceData, translatedData) {
  var srcG = (sourceData && sourceData.general) ? sourceData.general : {};
  var trG = (translatedData && translatedData.general) ? translatedData.general : {};
  function fill(key) {
    var srcVal = String(srcG[key] || '').trim();
    if (!srcVal) return;
    var trVal = String(trG[key] || '').trim();
    if (!trVal) trG[key] = srcVal;
  }
  fill('AI_SEO_Title');
  fill('AI_Trip_Description');
  fill('AI_SEO_Meta_Description');
  fill('AI_SEO_Permalink');
  fill('AI_Trip_Highlights_Section_Title');
  fill('AI_Itinerary_Section_Title');
  fill('AI_FAQ_Section_Title');
  fill('AI_Cost_Section_Title');
  fill('AI_Cost_Includes_Title');
  fill('AI_Cost_Excludes_Title');
  translatedData.general = trG;
}

function validateParityCounts_Updater_(sourceData, translatedData) {
  var src = sourceData || {};
  var tr = translatedData || {};
  var failures = [];
  var checks = [
    { k: 'highlights', src: (src.highlights || []).length, tr: (tr.highlights || []).length },
    { k: 'itinerary', src: (src.itinerary || []).length, tr: (tr.itinerary || []).length },
    { k: 'faqs', src: (src.faqs || []).length, tr: (tr.faqs || []).length },
    { k: 'includes', src: (src.includes || []).length, tr: (tr.includes || []).length },
    { k: 'excludes', src: (src.excludes || []).length, tr: (tr.excludes || []).length }
  ];
  checks.forEach(function(c) {
    if (c.src !== c.tr) failures.push({ section: c.k, expected: c.src, got: c.tr });
  });
  return failures;
}

function hasEmptySectionItems_Updater_(sourceData, translatedData, section) {
  var src = sourceData || {};
  var tr = translatedData || {};
  if (section === 'highlights') {
    for (var i = 0; i < (src.highlights || []).length; i++) {
      var s0 = src.highlights[i] && src.highlights[i].fields ? String(src.highlights[i].fields.AI_Highlight || '').trim() : '';
      var s1 = tr.highlights[i] && tr.highlights[i].fields ? String(tr.highlights[i].fields.AI_Highlight || '').trim() : '';
      if (s0 && !s1) return true;
    }
  } else if (section === 'includes') {
    for (var j = 0; j < (src.includes || []).length; j++) {
      var a0 = src.includes[j] && src.includes[j].fields ? String(src.includes[j].fields.IncludeItem || '').trim() : '';
      var a1 = tr.includes[j] && tr.includes[j].fields ? String(tr.includes[j].fields.IncludeItem || '').trim() : '';
      if (a0 && !a1) return true;
    }
  } else if (section === 'excludes') {
    for (var k = 0; k < (src.excludes || []).length; k++) {
      var e0 = src.excludes[k] && src.excludes[k].fields ? String(src.excludes[k].fields.ExcludeItem || '').trim() : '';
      var e1 = tr.excludes[k] && tr.excludes[k].fields ? String(tr.excludes[k].fields.ExcludeItem || '').trim() : '';
      if (e0 && !e1) return true;
    }
  } else if (section === 'faqs') {
    for (var f = 0; f < (src.faqs || []).length; f++) {
      var q0 = src.faqs[f] && src.faqs[f].fields ? String(src.faqs[f].fields.AI_Question || '').trim() : '';
      var q1 = tr.faqs[f] && tr.faqs[f].fields ? String(tr.faqs[f].fields.AI_Question || '').trim() : '';
      if (q0 && !q1) return true;
      var an0 = src.faqs[f] && src.faqs[f].fields ? String(src.faqs[f].fields.AI_Answer || '').trim() : '';
      var an1 = tr.faqs[f] && tr.faqs[f].fields ? String(tr.faqs[f].fields.AI_Answer || '').trim() : '';
      if (an0 && !an1) return true;
    }
  } else if (section === 'itinerary') {
    for (var it = 0; it < (src.itinerary || []).length; it++) {
      var t0 = src.itinerary[it] && src.itinerary[it].fields ? String(src.itinerary[it].fields.AI_Step_Title || '').trim() : '';
      var t1 = tr.itinerary[it] && tr.itinerary[it].fields ? String(tr.itinerary[it].fields.AI_Step_Title || '').trim() : '';
      if (t0 && !t1) return true;
      var d0 = src.itinerary[it] && src.itinerary[it].fields ? String(src.itinerary[it].fields.AI_Step_Description || '').trim() : '';
      var d1 = tr.itinerary[it] && tr.itinerary[it].fields ? String(tr.itinerary[it].fields.AI_Step_Description || '').trim() : '';
      if (d0 && !d1) return true;
    }
  }
  return false;
}

function fillEmptySectionItemsFromEnglish_Updater_(sourceData, translatedData, section) {
  var src = sourceData || {};
  var tr = translatedData || {};
  if (section === 'highlights') {
    for (var i = 0; i < (src.highlights || []).length; i++) {
      var s0 = src.highlights[i] && src.highlights[i].fields ? String(src.highlights[i].fields.AI_Highlight || '').trim() : '';
      var trg = tr.highlights[i] && tr.highlights[i].fields ? String(tr.highlights[i].fields.AI_Highlight || '').trim() : '';
      if (s0 && !trg && tr.highlights[i] && tr.highlights[i].fields) tr.highlights[i].fields.AI_Highlight = s0;
    }
  } else if (section === 'includes') {
    for (var j = 0; j < (src.includes || []).length; j++) {
      var a0 = src.includes[j] && src.includes[j].fields ? String(src.includes[j].fields.IncludeItem || '').trim() : '';
      var a1 = tr.includes[j] && tr.includes[j].fields ? String(tr.includes[j].fields.IncludeItem || '').trim() : '';
      if (a0 && !a1 && tr.includes[j] && tr.includes[j].fields) tr.includes[j].fields.IncludeItem = a0;
    }
  } else if (section === 'excludes') {
    for (var k = 0; k < (src.excludes || []).length; k++) {
      var e0 = src.excludes[k] && src.excludes[k].fields ? String(src.excludes[k].fields.ExcludeItem || '').trim() : '';
      var e1 = tr.excludes[k] && tr.excludes[k].fields ? String(tr.excludes[k].fields.ExcludeItem || '').trim() : '';
      if (e0 && !e1 && tr.excludes[k] && tr.excludes[k].fields) tr.excludes[k].fields.ExcludeItem = e0;
    }
  } else if (section === 'faqs') {
    for (var f = 0; f < (src.faqs || []).length; f++) {
      var q0 = src.faqs[f] && src.faqs[f].fields ? String(src.faqs[f].fields.AI_Question || '').trim() : '';
      var q1 = tr.faqs[f] && tr.faqs[f].fields ? String(tr.faqs[f].fields.AI_Question || '').trim() : '';
      if (q0 && !q1 && tr.faqs[f] && tr.faqs[f].fields) tr.faqs[f].fields.AI_Question = q0;
      var an0 = src.faqs[f] && src.faqs[f].fields ? String(src.faqs[f].fields.AI_Answer || '').trim() : '';
      var an1 = tr.faqs[f] && tr.faqs[f].fields ? String(tr.faqs[f].fields.AI_Answer || '').trim() : '';
      if (an0 && !an1 && tr.faqs[f] && tr.faqs[f].fields) tr.faqs[f].fields.AI_Answer = an0;
    }
  } else if (section === 'itinerary') {
    for (var it = 0; it < (src.itinerary || []).length; it++) {
      var t0 = src.itinerary[it] && src.itinerary[it].fields ? String(src.itinerary[it].fields.AI_Step_Title || '').trim() : '';
      var t1 = tr.itinerary[it] && tr.itinerary[it].fields ? String(tr.itinerary[it].fields.AI_Step_Title || '').trim() : '';
      if (t0 && !t1 && tr.itinerary[it] && tr.itinerary[it].fields) tr.itinerary[it].fields.AI_Step_Title = t0;
      var d0 = src.itinerary[it] && src.itinerary[it].fields ? String(src.itinerary[it].fields.AI_Step_Description || '').trim() : '';
      var d1 = tr.itinerary[it] && tr.itinerary[it].fields ? String(tr.itinerary[it].fields.AI_Step_Description || '').trim() : '';
      if (d0 && !d1 && tr.itinerary[it] && tr.itinerary[it].fields) tr.itinerary[it].fields.AI_Step_Description = d0;
    }
  }
}

function stripHtmlForLiteralCheck_Updater_(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeForLiteralCheck_Updater_(s) {
  var t = stripHtmlForLiteralCheck_Updater_(s);
  t = t.toLowerCase();
  t = t.replace(/\d+/g, ' ');
  t = t.replace(/[^a-zA-Z\u00C0-\u024F\u0400-\u04FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\s]+/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

function isIgnorableLiteralItem_Updater_(s) {
  var t = normalizeForLiteralCheck_Updater_(s);
  if (!t) return true;
  if (t.length < 25) return true;
  var words = t.split(/\s+/).filter(function(w) { return !!w; });
  if (words.length < 4) return true;
  return false;
}

function isSectionSuspiciousNotLocalized_Updater_(sourceData, translatedData, sectionName) {
  var src = sourceData || {};
  var tr = translatedData || {};
  var pairs = [];

  function pushPair(a, b) {
    var s0 = String(a == null ? '' : a).trim();
    var s1 = String(b == null ? '' : b).trim();
    if (!s0 || !s1) return;
    pairs.push({ src: s0, tr: s1 });
  }

  if (sectionName === 'highlights') {
    for (var i = 0; i < (src.highlights || []).length; i++) {
      var sh = src.highlights[i] && src.highlights[i].fields ? src.highlights[i].fields.AI_Highlight : '';
      var th = tr.highlights[i] && tr.highlights[i].fields ? tr.highlights[i].fields.AI_Highlight : '';
      pushPair(sh, th);
    }
  } else if (sectionName === 'includes') {
    for (var j = 0; j < (src.includes || []).length; j++) {
      var si = src.includes[j] && src.includes[j].fields ? src.includes[j].fields.IncludeItem : '';
      var ti = tr.includes[j] && tr.includes[j].fields ? tr.includes[j].fields.IncludeItem : '';
      pushPair(si, ti);
    }
  } else if (sectionName === 'excludes') {
    for (var k = 0; k < (src.excludes || []).length; k++) {
      var se = src.excludes[k] && src.excludes[k].fields ? src.excludes[k].fields.ExcludeItem : '';
      var te = tr.excludes[k] && tr.excludes[k].fields ? tr.excludes[k].fields.ExcludeItem : '';
      pushPair(se, te);
    }
  } else if (sectionName === 'faqs') {
    for (var f = 0; f < (src.faqs || []).length; f++) {
      var sq = src.faqs[f] && src.faqs[f].fields ? src.faqs[f].fields.AI_Question : '';
      var sa = src.faqs[f] && src.faqs[f].fields ? src.faqs[f].fields.AI_Answer : '';
      var tq = tr.faqs[f] && tr.faqs[f].fields ? tr.faqs[f].fields.AI_Question : '';
      var ta = tr.faqs[f] && tr.faqs[f].fields ? tr.faqs[f].fields.AI_Answer : '';
      pushPair((sq ? (String(sq) + ' ' + String(sa || '')) : sa), (tq ? (String(tq) + ' ' + String(ta || '')) : ta));
    }
  } else if (sectionName === 'itinerary') {
    for (var it = 0; it < (src.itinerary || []).length; it++) {
      var st = src.itinerary[it] && src.itinerary[it].fields ? src.itinerary[it].fields.AI_Step_Title : '';
      var sd = src.itinerary[it] && src.itinerary[it].fields ? src.itinerary[it].fields.AI_Step_Description : '';
      var tt = tr.itinerary[it] && tr.itinerary[it].fields ? tr.itinerary[it].fields.AI_Step_Title : '';
      var td = tr.itinerary[it] && tr.itinerary[it].fields ? tr.itinerary[it].fields.AI_Step_Description : '';
      pushPair((st ? (String(st) + ' ' + String(sd || '')) : sd), (tt ? (String(tt) + ' ' + String(td || '')) : td));
    }
  } else {
    return false;
  }

  var considered = 0;
  var equalCount = 0;
  for (var p = 0; p < pairs.length; p++) {
    var a = pairs[p].src;
    var b = pairs[p].tr;
    if (isIgnorableLiteralItem_Updater_(a) || isIgnorableLiteralItem_Updater_(b)) continue;
    considered++;
    if (normalizeForLiteralCheck_Updater_(a) === normalizeForLiteralCheck_Updater_(b)) equalCount++;
  }

  if (considered < 2) return false;
  var threshold = Math.max(2, Math.ceil(considered * 0.5));
  return equalCount >= threshold;
}

function normalizeForSpecMatch_Updater_(s) {
  var t = stripHtmlForLiteralCheck_Updater_(s);
  t = t.toLowerCase();
  t = t.replace(/[^a-zA-Z0-9\u00C0-\u024F\u0400-\u04FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\s]+/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

function detectEnglishMuseumFamily_Updater_(text) {
  var t = normalizeForEnglishPhraseScan_Updater_(String(text || ''))
  if (!t) return ''
  var civ = ['national museum of egyptian civilization', 'egyptian civilization museum', 'civilization museum', 'nmec']
  var egypt = ['egyptian museum', 'museum of egyptian antiquities']
  function hasAny_(hay, needles) {
    for (var i = 0; i < needles.length; i++) {
      if (hay.indexOf(needles[i]) !== -1) return true
    }
    return false
  }
  var hasCiv = hasAny_(t, civ)
  var hasEgypt = hasAny_(t, egypt)
  if (hasCiv && hasEgypt) return 'ambiguous'
  if (hasCiv) return 'civilization'
  if (hasEgypt) return 'egyptian'
  return ''
}

function areLandmarkVariantsEquivalent_Updater_(a, b) {
  var fa = detectEnglishMuseumFamily_Updater_(a)
  var fb = detectEnglishMuseumFamily_Updater_(b)
  if (!fa || !fb) return false
  if (fa === 'ambiguous' || fb === 'ambiguous') return false
  return fa === fb
}

function resolveCanonicalEnglishPrimaryLandmarks_Updater_(sourceData, tripFields, wpTripInfo) {
  var data = sourceData || {}
  var g = data.general || {}
  var f = tripFields || {}
  var wp = wpTripInfo || {}
  var wpCore = wp && wp.core ? wp.core : {}
  var wpMeta = wp && wp.meta ? wp.meta : {}

  var sources = []
  sources.push({
    key: 'wp_core',
    title: wpCore.title || '',
    meta: '',
    slug: wpCore.slug || ''
  })
  sources.push({
    key: 'wp_seo',
    title: wpMeta.rank_math_title || '',
    meta: wpMeta.rank_math_description || '',
    slug: wpCore.slug || ''
  })
  sources.push({
    key: 'wp_schema',
    title: '',
    meta: wpMeta.trip_schema_data || wpMeta.schema_trip_data || '',
    slug: ''
  })
  sources.push({
    key: 'airtable_ai_seo',
    title: g.AI_SEO_Title || '',
    meta: g.AI_SEO_Meta_Description || '',
    slug: g.AI_SEO_Permalink || ''
  })
  sources.push({
    key: 'airtable_trip',
    title: f.Title || f.Trip_Title || '',
    meta: f.Trip_Description || '',
    slug: f.Slug || ''
  })

  var chosen = null
  var chosenFamily = ''
  var otherFamilies = {}
  for (var i = 0; i < sources.length; i++) {
    var s = sources[i] || {}
    var combined = String(s.title || '') + ' ' + String(s.meta || '') + ' ' + String(s.slug || '')
    var fam = detectEnglishMuseumFamily_Updater_(combined)
    if (fam && fam !== 'ambiguous') otherFamilies[fam] = true
    if (!chosen && fam && fam !== 'ambiguous') {
      chosen = s
      chosenFamily = fam
    }
  }

  var allFamilies = Object.keys(otherFamilies)
  var inconsistent = chosenFamily && allFamilies.length > 1
  var ambiguous = !chosenFamily

  return {
    museum_family: chosenFamily,
    museum_source: chosen ? chosen.key : '',
    is_clear: !!chosenFamily,
    is_ambiguous: ambiguous,
    is_inconsistent: inconsistent,
    ref_title: chosen && chosen.title ? String(chosen.title) : '',
    ref_meta: chosen && chosen.meta ? String(chosen.meta) : '',
    ref_slug: chosen && chosen.slug ? String(chosen.slug) : ''
  }
}

function extractSpecificityConstraintsFromEnglish_Updater_(sourceData, tripFields, wpTripInfo) {
  var data = sourceData || {};
  var g = data.general || {};
  var title = String(g.AI_SEO_Title || '').trim();
  var meta = String(g.AI_SEO_Meta_Description || '').trim();
  var slug = sanitizeTranslatedSlug_(String(g.AI_SEO_Permalink || title || '').trim());
  var desc = stripHtmlForLiteralCheck_Updater_(String(g.AI_Trip_Description || '').trim());
  if (desc.length > 800) desc = desc.substring(0, 800);

  var highlights = (data.highlights || []).map(function(h) {
    var f = h && h.fields ? h.fields : {};
    return String(f.AI_Highlight || '').trim();
  }).filter(function(s) { return !!s; }).slice(0, 12).join(' | ');

  var itineraryTitles = (data.itinerary || []).map(function(x) {
    var f = x && x.fields ? x.fields : {};
    return String(f.AI_Step_Title || '').trim();
  }).filter(function(s) { return !!s; }).slice(0, 12).join(' | ');

  var place = '';
  if (data.tripDetails) {
    place = String(data.tripDetails.TourLocation || data.tripDetails.Location || data.tripDetails.City || data.tripDetails.Destination || '').trim();
  }

  var combined = [title, meta, desc, highlights, itineraryTitles, place].filter(function(s) { return !!s; }).join(' ');
  var combinedLower = combined.toLowerCase();

  var destinationList = ['cairo', 'giza', 'luxor', 'aswan', 'alexandria', 'hurghada', 'sharm', 'sinai', 'egypt'];
  var placeNorm = place ? normalizeForSpecMatch_Updater_(place) : '';
  var detectedPlace = '';
  if (placeNorm) detectedPlace = place;
  if (!detectedPlace) {
    for (var di = 0; di < destinationList.length; di++) {
      if (combinedLower.indexOf(destinationList[di]) !== -1) {
        detectedPlace = destinationList[di].charAt(0).toUpperCase() + destinationList[di].slice(1);
        break;
      }
    }
  }

  var candidates = [];
  var re = /\b[A-Z][A-Za-z’'\-]*(?:\s+(?:&\s+)?[A-Z][A-Za-z’'\-]*)+\b/g;
  var m;
  while ((m = re.exec(combined)) !== null) {
    var phrase = String(m[0] || '').trim();
    if (phrase) candidates.push(phrase);
  }

  var keyPhrases = [
    'Old Cairo',
    'Khan El Khalili',
    'Egyptian Museum',
    'Egyptian Civilization Museum',
    'National Museum of Egyptian Civilization',
    'Citadel',
    'Temple',
    'Pyramids',
    'Sphinx',
    'Bazaar',
    'Mosque',
    'Church',
    'Monastery',
    'Valley of the Kings',
    'Nile Cruise'
  ];
  for (var kp = 0; kp < keyPhrases.length; kp++) {
    var ph = keyPhrases[kp];
    if (combinedLower.indexOf(String(ph).toLowerCase()) !== -1) candidates.push(ph);
  }

  var seen = {};
  var landmarks = [];
  var detectedPlaceNorm = detectedPlace ? normalizeForSpecMatch_Updater_(detectedPlace) : '';
  candidates.forEach(function(x) {
    var v = String(x || '').trim();
    if (!v) return;
    var norm = normalizeForSpecMatch_Updater_(v);
    if (!norm) return;
    if (detectedPlaceNorm && norm === detectedPlaceNorm) return;
    if (seen[norm]) return;
    seen[norm] = true;
    if (norm.length < 4) return;
    landmarks.push(v);
  });
  if (landmarks.length > 12) landmarks = landmarks.slice(0, 12);

  var slugHints = landmarks.map(function(x) {
    var s = sanitizeTranslatedSlug_(x);
    if (!s) return '';
    var parts = s.split('-').filter(function(p) { return !!p; });
    if (parts.length > 6) parts = parts.slice(0, 6);
    return parts.join('-');
  }).filter(function(s) { return !!s; });

  var canonical = resolveCanonicalEnglishPrimaryLandmarks_Updater_(data, tripFields, wpTripInfo)
  if (canonical && canonical.museum_family) {
    log('CANONICAL PRIMARY LANDMARK RESOLVED: museum_family=' + canonical.museum_family + ' source=' + canonical.museum_source)
  } else {
    log('CANONICAL PRIMARY LANDMARK RESOLVED: (none detected)')
  }
  if (canonical && (canonical.is_inconsistent || canonical.is_ambiguous)) {
    log('SOURCE LANDMARK INCONSISTENT - NORMALIZED BEFORE VALIDATION')
  }

  return {
    english_title: title,
    english_meta: meta,
    english_slug: slug,
    english_landmark_title: canonical && canonical.ref_title ? canonical.ref_title : title,
    english_landmark_meta: canonical && canonical.ref_meta ? canonical.ref_meta : meta,
    english_landmark_slug: canonical && canonical.ref_slug ? sanitizeTranslatedSlug_(canonical.ref_slug) : slug,
    landmark_canonical_museum_family: canonical && canonical.museum_family ? canonical.museum_family : '',
    landmark_canonical_museum_source: canonical && canonical.museum_source ? canonical.museum_source : '',
    landmark_canonical_is_clear: canonical && canonical.is_clear ? true : false,
    landmark_source_inconsistent: canonical && canonical.is_inconsistent ? true : false,
    landmark_source_ambiguous: canonical && canonical.is_ambiguous ? true : false,
    place: detectedPlace,
    landmarks: landmarks,
    landmark_slugs: slugHints
  };
}

function countLandmarksPresentInText_Updater_(text, spec) {
  var s = spec || {};
  var list = s.landmarks && s.landmarks.length ? s.landmarks : [];
  if (!list.length) return 0;
  var hay = normalizeForSpecMatch_Updater_(text);
  if (!hay) return 0;
  var count = 0;
  for (var i = 0; i < list.length; i++) {
    var needle = normalizeForSpecMatch_Updater_(list[i]);
    if (needle && hay.indexOf(needle) !== -1) count++;
  }
  return count;
}

function countLandmarkSlugsPresent_Updater_(slug, spec) {
  var s = spec || {};
  var list = s.landmark_slugs && s.landmark_slugs.length ? s.landmark_slugs : [];
  var hay = String(slug || '').toLowerCase();
  if (!hay || !list.length) return 0;
  var count = 0;
  for (var i = 0; i < list.length; i++) {
    var needle = String(list[i] || '').toLowerCase();
    if (needle && hay.indexOf(needle) !== -1) count++;
  }
  return count;
}

function getGenericTokensForLang_Updater_(lang) {
  var l = String(lang || '').toLowerCase();
  var map = {
    'en': ['tour', 'trip', 'excursion', 'guided tour', 'city tour'],
    'de': ['ausflug', 'tour', 'reise', 'tagesausflug', 'stadtrundfahrt'],
    'fr': ['excursion', 'visite', 'tour'],
    'es': ['excursion', 'excursión', 'tour', 'visita'],
    'it': ['escursione', 'tour', 'visita'],
    'nl': ['excursie', 'tour', 'uitstap'],
    'pl': ['wycieczka', 'zwiedzanie', 'tour'],
    'tr': ['tur', 'gezi'],
    'ru': ['экскурсия', 'тур'],
    'ro': ['excursie', 'tur'],
    'pt-br': ['excursão', 'excursao', 'passeio', 'tour'],
    'uk': ['екскурсія', 'тур'],
    'cs': ['vylet', 'výlet', 'exkurze'],
    'hu': ['kirandulas', 'kirándulás', 'túra', 'tura'],
    'ja': ['ツアー'],
    'ko': ['투어'],
    'zh-hans': ['游', '之旅', '旅行']
  };
  return map[l] || map.en;
}

function getAttractionConceptTokensForLang_Updater_(lang) {
  var l = String(lang || '').toLowerCase();
  var map = {
    'en': ['museum', 'citadel', 'temple', 'pyramids', 'sphinx', 'bazaar', 'cruise', 'safari', 'desert', 'oasis', 'valley'],
    'de': ['museum', 'zitadelle', 'festung', 'tempel', 'pyramiden', 'sphinx', 'basar', 'kreuzfahrt', 'safari', 'wüste', 'oase', 'tal'],
    'fr': ['musée', 'citadelle', 'temple', 'pyramides', 'sphinx', 'bazar', 'croisière', 'safari', 'désert', 'oasis', 'vallée'],
    'es': ['museo', 'ciudadela', 'templo', 'pirámides', 'piramides', 'esfinge', 'bazar', 'crucero', 'safari', 'desierto', 'oasis', 'valle'],
    'it': ['museo', 'cittadella', 'tempio', 'piramidi', 'sfinge', 'bazar', 'crociera', 'safari', 'deserto', 'oasi', 'valle'],
    'nl': ['museum', 'citadel', 'tempel', 'piramides', 'sfinx', 'bazaar', 'cruise', 'safari', 'woestijn', 'oase', 'vallei'],
    'pl': ['muzeum', 'cytadela', 'świątynia', 'swiatynia', 'piramidy', 'sfinks', 'bazar', 'rejs', 'safari', 'pustynia', 'oaza', 'dolina'],
    'tr': ['müze', 'muze', 'kale', 'tapınak', 'tapinak', 'piramit', 'sfenks', 'çarşı', 'carsi', 'kruvaziyer', 'safari', 'çöl', 'col', 'vadi'],
    'ru': ['музей', 'цитадель', 'крепость', 'храм', 'пирамид', 'сфинкс', 'базар', 'круиз', 'сафари', 'пустын', 'оазис', 'долин'],
    'ro': ['muzeu', 'cetate', 'citadelă', 'citadela', 'templu', 'piramide', 'sfinx', 'bazar', 'croazieră', 'croaziera', 'safari', 'deșert', 'desert', 'oază', 'oaza'],
    'pt-br': ['museu', 'cidadela', 'templo', 'pirâmides', 'piramides', 'esfinge', 'bazar', 'cruzeiro', 'safari', 'deserto', 'oásis', 'oasis', 'vale'],
    'uk': ['музей', 'цитадель', 'фортеця', 'храм', 'пірамід', 'сфінкс', 'базар', 'круїз', 'сафарі', 'пустел', 'оазис', 'долин'],
    'cs': ['muzeum', 'citadela', 'pevnost', 'chrám', 'chram', 'pyramid', 'sfinga', 'bazar', 'plavba', 'safari', 'poušť', 'poust', 'oáza', 'oaza', 'údolí', 'udoli'],
    'hu': ['múzeum', 'muzeum', 'fellegvár', 'fellegvar', 'templom', 'piram', 'szfinx', 'bazár', 'bazar', 'hajóút', 'hajout', 'safari', 'sivatag', 'oázis', 'oazis', 'völgy', 'volgy'],
    'ja': ['博物館', '城塞', '要塞', '神殿', 'ピラミッド', 'スフィンクス', 'バザール', 'クルーズ', 'サファリ', '砂漠', 'オアシス', '谷'],
    'ko': ['박물관', '성채', '요새', '사원', '피라미드', '스핑크스', '바자르', '크루즈', '사파리', '사막', '오아시스', '계곡'],
    'zh-hans': ['博物馆', '城堡', '要塞', '神庙', '金字塔', '狮身人面像', '集市', '游轮', '沙漠', '绿洲', '山谷']
  };
  return map[l] || map.en;
}

function hasAttractionConceptInText_Updater_(text, targetLang) {
  var norm = normalizeForSpecMatch_Updater_(text);
  if (!norm) return false;
  var tokens = getAttractionConceptTokensForLang_Updater_(targetLang);
  for (var i = 0; i < tokens.length; i++) {
    var t = normalizeForSpecMatch_Updater_(tokens[i]);
    if (t && norm.indexOf(t) !== -1) return true;
  }
  return false;
}

function isGenericTitle_Updater_(title, targetLang, spec) {
  var t = String(title || '').trim();
  if (!t) return true;
  var norm = normalizeForSpecMatch_Updater_(t);
  var words = norm ? norm.split(/\s+/).filter(function(w) { return !!w; }) : [];
  var genericTokens = getGenericTokensForLang_Updater_(targetLang);
  var hasGeneric = false;
  for (var i = 0; i < genericTokens.length; i++) {
    var g = normalizeForSpecMatch_Updater_(genericTokens[i]);
    if (g && norm.indexOf(g) !== -1) { hasGeneric = true; break; }
  }
  if (!hasGeneric) return false;
  if (words.length <= 4) return true;
  var place = spec && spec.place ? normalizeForSpecMatch_Updater_(spec.place) : '';
  if (place && norm.indexOf(place) !== -1 && words.length <= 5) return true;
  return false;
}

function isGenericSlug_Updater_(slug, targetLang, spec) {
  var s = String(slug || '').trim().toLowerCase();
  if (!s) return true;
  var parts = s.split('-').filter(function(p) { return !!p; });
  var genericTokens = getGenericTokensForLang_Updater_(targetLang).map(function(x) { return buildShortSlugFromPrimaryKeyword_Updater_(x); }).filter(function(x) { return !!x; });
  var hasGeneric = false;
  for (var i = 0; i < genericTokens.length; i++) {
    if (genericTokens[i] && s.indexOf(genericTokens[i]) !== -1) { hasGeneric = true; break; }
  }
  if (!hasGeneric) return false;
  if (parts.length <= 3) return true;
  var place = spec && spec.place ? sanitizeTranslatedSlug_(spec.place) : '';
  if (place && s.indexOf(place) !== -1 && parts.length <= 4) return true;
  return false;
}

function isAcceptableButNotPerfectSlug_Updater_(slug, targetLang, kw, spec) {
  var s = String(slug || '').trim().toLowerCase();
  if (!s) return false;
  var parts = s.split('-').filter(function(p) { return !!p; });
  if (parts.length < 4) return false;

  var primary = kw && kw.primary ? String(kw.primary).trim() : '';
  var primarySlug = buildShortSlugFromPrimaryKeyword_Updater_(primary);
  var primarySlug2 = sanitizeTranslatedSlug_(primary);
  var hasPrimary = false;
  if (primarySlug && s.indexOf(primarySlug) !== -1) hasPrimary = true;
  else if (primarySlug2 && s.indexOf(primarySlug2) !== -1) hasPrimary = true;
  if (!hasPrimary) return false;

  var hasLandmark = false;
  if (countLandmarkSlugsPresent_Updater_(s, spec) > 0) hasLandmark = true;
  if (!hasLandmark && hasAttractionConceptInText_Updater_(s.replace(/-/g, ' '), targetLang)) hasLandmark = true;
  if (!hasLandmark) {
    var place = spec && spec.place ? sanitizeTranslatedSlug_(spec.place) : '';
    if (place && s.indexOf(place) !== -1 && parts.length >= 5) hasLandmark = true;
  }
  if (!hasLandmark) return false;

  if (isGenericSlug_Updater_(s, targetLang, spec)) {
    var genericTokens = getGenericTokensForLang_Updater_(targetLang).map(function(x) { return buildShortSlugFromPrimaryKeyword_Updater_(x); }).filter(function(x) { return !!x; });
    var place2 = spec && spec.place ? sanitizeTranslatedSlug_(spec.place) : '';
    var looksCityOnly = false;
    if (place2) {
      var others = parts.filter(function(p) { return p !== place2; });
      if (others.length <= 1 && genericTokens.length) looksCityOnly = true;
    }
    if (looksCityOnly) return false;
  }

  return true;
}

function getScriptProfileForLang_Updater_(targetLang) {
  var l = String(targetLang || '').toLowerCase()
  if (!l) return 'latin'
  if (l.indexOf('zh') === 0 || l === 'ja' || l === 'ko' || l.indexOf('zh-') === 0) return 'cjk'
  if (l === 'ru' || l === 'uk') return 'cyrillic'
  if (l === 'ar') return 'arabic'
  return 'latin'
}

function validateSeoSpecificity_Updater_(spec, payload, targetLang, kw, slugLocked) {
  var out = { ok: true, reasons: [], warnings: [] };
  var s = spec || {};
  var p = payload || {};
  var meta = p.meta || {};
  var core = p.core || {};
  var enTitle = String(s.english_title || '').trim();
  var enMeta = String(s.english_meta || '').trim();

  var title = String(meta.rank_math_title || '').trim();
  var desc = String(meta.rank_math_description || '').trim();
  var slug = String(core.slug || '').trim();
  var scriptProfile = getScriptProfileForLang_Updater_(targetLang)
  var isCjk = scriptProfile === 'cjk'

  if (enTitle && title && enTitle.length >= 24 && title.length < Math.max(12, Math.floor(enTitle.length * 0.45))) {
    if (isCjk) out.warnings.push('title_length_specificity_ignored_for_script')
    else out.reasons.push('title_genericness_failed')
  }
  if (title && s.landmarks && s.landmarks.length >= 2 && countLandmarksPresentInText_Updater_(title, s) === 0 && !hasAttractionConceptInText_Updater_(title, targetLang)) {
    if (isCjk) out.warnings.push('title_landmark_specificity_ignored_for_script')
    else out.reasons.push('title_genericness_failed')
  }
  if (title && isGenericTitle_Updater_(title, targetLang, s) && enTitle.length >= 18) {
    if (isCjk) out.warnings.push('title_genericness_ignored_for_script')
    else out.reasons.push('title_genericness_failed')
  }

  if (desc && enMeta && enMeta.length >= 90 && desc.length < Math.max(60, Math.floor(enMeta.length * 0.55))) {
    if (isCjk) out.warnings.push('meta_length_specificity_ignored_for_script')
    else out.reasons.push('meta_specificity_failed')
  }
  if (desc && s.landmarks && s.landmarks.length >= 2 && countLandmarksPresentInText_Updater_(desc, s) === 0 && !hasAttractionConceptInText_Updater_(desc, targetLang)) {
    if (isCjk) out.warnings.push('meta_landmark_specificity_ignored_for_script')
    else out.reasons.push('meta_specificity_failed')
  }

  var slugAcceptable = isAcceptableButNotPerfectSlug_Updater_(slug, targetLang, kw, s);
  if (slug && slug.length < 12 && String(s.english_slug || '').length >= 18) {
    if (!slugAcceptable) {
      if (isCjk) out.warnings.push('slug_genericness_ignored_for_script')
      else out.reasons.push('slug_genericness_failed')
    } else out.warnings.push('acceptable_but_not_perfect_slug');
  }
  if (slug && isGenericSlug_Updater_(slug, targetLang, s) && String(s.english_slug || '').length >= 14) {
    if (!slugAcceptable) {
      if (isCjk) out.warnings.push('slug_genericness_ignored_for_script')
      else out.reasons.push('slug_genericness_failed')
    } else out.warnings.push('acceptable_but_not_perfect_slug');
  }
  if (slug && s.landmark_slugs && s.landmark_slugs.length >= 2 && countLandmarkSlugsPresent_Updater_(slug, s) === 0) {
    if (!slugAcceptable) {
      if (isCjk) out.warnings.push('slug_genericness_ignored_for_script')
      else out.reasons.push('slug_genericness_failed')
    } else out.warnings.push('acceptable_but_not_perfect_slug');
  }

  out.ok = out.reasons.length === 0;
  return out;
}

function escapeRegex_Updater_(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeForEnglishPhraseScan_Updater_(text) {
  var t = String(text || '').toLowerCase();
  t = t.replace(/[\-_]+/g, ' ');
  t = t.replace(/[^a-z0-9\s]+/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

function getDisallowedEnglishGenericPhrasesForNonEnglish_Updater_() {
  return [
    'day tour',
    'day tours',
    'day trip',
    'day trips',
    'guided tour',
    'city tour',
    'trips',
    'travel',
    'egyptian museum',
    'civilization museum',
    'egyptian civilization museum',
    'national museum of egyptian civilization',
    'old cairo'
  ];
}

function getAllowedEnglishProperNounsForNonEnglish_Updater_(spec) {
  var s = spec || {};
  var out = [
    'cairo',
    'giza',
    'luxor',
    'aswan',
    'alexandria',
    'hurghada',
    'sharm',
    'sinai',
    'egypt',
    'citadel',
    'khan el khalili',
    'nile',
    'nile cruise',
    'nmec'
  ];
  if (s.place) out.push(String(s.place));
  return out.map(function(x) { return normalizeForEnglishPhraseScan_Updater_(x); }).filter(function(x) { return !!x; });
}

function keywordBlockAllowsPhrase_Updater_(kw, phraseNorm) {
  var p = String(phraseNorm || '').trim();
  if (!p) return false;
  var primary = kw && kw.primary ? normalizeForEnglishPhraseScan_Updater_(kw.primary) : '';
  if (primary && primary.indexOf(p) !== -1) return true;
  var sec = kw && kw.secondary && Array.isArray(kw.secondary) ? kw.secondary : [];
  for (var i = 0; i < sec.length; i++) {
    var s = normalizeForEnglishPhraseScan_Updater_(sec[i]);
    if (s && s.indexOf(p) !== -1) return true;
  }
  return false;
}

function validateNoEnglishGenericMixingInTitleSlug_Updater_(payload, targetLang, kw, spec) {
  var lang = String(targetLang || '').toLowerCase();
  if (!lang || lang === 'en') return { ok: true, reasons: [], found: [], severity: 'none' };

  var p = payload || {};
  var meta = p.meta || {};
  var core = p.core || {};

  var titleNorm = normalizeForEnglishPhraseScan_Updater_(meta.rank_math_title);
  var slugNorm = normalizeForEnglishPhraseScan_Updater_(core.slug);

  var allowed = getAllowedEnglishProperNounsForNonEnglish_Updater_(spec);
  var disallowed = getDisallowedEnglishGenericPhrasesForNonEnglish_Updater_();

  var found = [];
  for (var i = 0; i < disallowed.length; i++) {
    var phrase = String(disallowed[i] || '').trim();
    if (!phrase) continue;
    var ph = normalizeForEnglishPhraseScan_Updater_(phrase);
    if (!ph) continue;
    if (keywordBlockAllowsPhrase_Updater_(kw, ph)) continue;
    if (allowed.indexOf(ph) !== -1) continue;

    var hit = false;
    if (titleNorm && titleNorm.indexOf(ph) !== -1) hit = true;
    if (slugNorm && slugNorm.indexOf(ph) !== -1) hit = true;
    if (hit) found.push(phrase);
  }

  if (!found.length) return { ok: true, reasons: [], found: [], severity: 'none' };

  var softList = [
    'day tour', 'day tours', 'day trip', 'day trips', 'guided tour', 'city tour', 'tour', 'trips', 'travel'
  ];
  var allSoft = true;
  for (var si = 0; si < found.length; si++) {
    var f = normalizeForEnglishPhraseScan_Updater_(found[si]);
    if (softList.indexOf(f) === -1) { allSoft = false; break; }
  }

  var titleNow = String(meta.rank_math_title || '').trim();
  var slugNow = String(core.slug || '').trim();
  var slugOk = isAcceptableButNotPerfectSlug_Updater_(slugNow, lang, kw, spec);
  var titleOk = !isGenericTitle_Updater_(titleNow, lang, spec);
  var severity = (allSoft && slugOk && titleOk) ? 'soft' : 'hard';
  return { ok: false, reasons: ['localization_failed'], found: found, severity: severity };
}

function localizeForbiddenEnglishPhraseForLang_Updater_(phrase, targetLang) {
  var lang = String(targetLang || '').toLowerCase();
  var p = normalizeForEnglishPhraseScan_Updater_(phrase);
  var map = {
    'day tour': { 'de': 'Tagesausflug' },
    'day tours': { 'de': 'Tagesausflüge' },
    'day trip': { 'de': 'Tagesausflug' },
    'day trips': { 'de': 'Tagesausflüge' },
    'guided tour': { 'de': 'Geführte Tour' },
    'city tour': { 'de': 'Stadtrundfahrt' },
    'old cairo': { 'de': 'Alt-Kairo' },
    'egyptian museum': { 'de': 'Ägyptisches Museum' },
    'civilization museum': { 'de': 'Museum der ägyptischen Zivilisation' },
    'egyptian civilization museum': { 'de': 'Museum der ägyptischen Zivilisation (NMEC)' },
    'national museum of egyptian civilization': { 'de': 'Nationalmuseum der ägyptischen Zivilisation (NMEC)' }
  };
  if (!map[p]) return '';
  var v = map[p][lang];
  return v ? String(v) : '';
}

function replaceDisallowedEnglishGenericPhrases_Updater_(text, targetLang, kw, spec) {
  var lang = String(targetLang || '').toLowerCase();
  var out = String(text || '');
  if (!out || !lang || lang === 'en') return out;

  var allowed = getAllowedEnglishProperNounsForNonEnglish_Updater_(spec);
  var disallowed = getDisallowedEnglishGenericPhrasesForNonEnglish_Updater_();
  for (var i = 0; i < disallowed.length; i++) {
    var phrase = String(disallowed[i] || '').trim();
    if (!phrase) continue;
    var ph = normalizeForEnglishPhraseScan_Updater_(phrase);
    if (!ph) continue;
    if (keywordBlockAllowsPhrase_Updater_(kw, ph)) continue;
    if (allowed.indexOf(ph) !== -1) continue;

    var localized = localizeForbiddenEnglishPhraseForLang_Updater_(phrase, lang);
    var re = new RegExp(escapeRegex_Updater_(phrase).replace(/\\ /g, '\\s+'), 'ig');
    if (localized) out = out.replace(re, localized);
    else out = out.replace(re, ' ');
  }

  out = out.replace(/\s+/g, ' ').trim();
  out = out.replace(/^[\-\–\—\|\:\s]+/, '').replace(/[\-\–\—\|\:\s]+$/, '').trim();
  return out;
}

function cleanTitleSlugEnglishPhrasesInPlace_Updater_(payload, targetLang, kw, spec, slugLocked) {
  var out = payload || {};
  out.meta = out.meta || {};
  out.core = out.core || {};
  var lang = String(targetLang || '').toLowerCase();
  if (!lang || lang === 'en') return { payload: out, changed: false };

  var beforeTitle = String(out.meta.rank_math_title || '').trim();
  var beforeSlug = String(out.core.slug || '').trim();

  var cleanedTitle = replaceDisallowedEnglishGenericPhrases_Updater_(beforeTitle, lang, kw, spec);
  if (cleanedTitle) out.meta.rank_math_title = cleanedTitle;

  if (!slugLocked) {
    var cleanedSlug = replaceDisallowedEnglishGenericPhrases_Updater_(beforeSlug.replace(/-/g, ' '), lang, kw, spec);
    cleanedSlug = finalizeTranslatedSlug_Updater_(cleanedSlug, { maxLen: 80, spec: spec });
    if (cleanedSlug) out.core.slug = cleanedSlug;
  }

  var afterTitle = String(out.meta.rank_math_title || '').trim();
  var afterSlug = String(out.core.slug || '').trim();
  var changed = (beforeTitle !== afterTitle) || (beforeSlug !== afterSlug);
  return { payload: out, changed: changed };
}

async function regenerateTitleSlugOnlyForLocalization_Updater_(translatedPayload, translatedData, targetLang, kw, spec, slugLocked, validation) {
  var lang = String(targetLang || '').toLowerCase()
  if (!lang || lang === 'en') return null
  var s = spec || {}
  var g = translatedData && translatedData.general ? translatedData.general : {}
  var p = translatedPayload || {}
  var meta = p.meta || {}
  var core = p.core || {}

  var preserve = s.landmarks && s.landmarks.length ? s.landmarks.slice(0, 10) : []
  var preserveBlock = preserve.map(function (x) { return '- ' + String(x || '').trim() }).filter(function (x) { return x.length > 2 }).join('\n')
  var banned = getDisallowedEnglishGenericPhrasesForNonEnglish_Updater_().map(function (x) { return '- ' + x }).join('\n')
  var allowedBlock = getAllowedEnglishProperNounsForNonEnglish_Updater_(s).map(function (x) { return '- ' + x }).join('\n')

  var kwBlock = ''
  if (kw && kw.primary) {
    kwBlock = "Provided SEO Keywords (MANDATORY):\nPrimary Keyword: " + String(kw.primary) + "\n"
  }

  var prompt =
    "Generate ONLY an improved SEO title and URL slug in " + lang.toUpperCase() + ".\n" +
    "CRITICAL RULES:\n" +
    "- Keep the same specificity as the English source; do NOT become generic.\n" +
    "- Preserve key landmarks and selling points.\n" +
    "- For non-English languages, localize generic English travel phrases.\n" +
    "- Keep only necessary proper nouns in original form.\n" +
    "- Do NOT output any of these generic English phrases in the final title or slug:\n" +
    banned + "\n" +
    (preserveBlock ? ("- Preserve these names if present in the source:\n" + preserveBlock + "\n") : "") +
    (allowedBlock ? ("- Allowed English proper nouns (may remain as-is):\n" + allowedBlock + "\n") : "") +
    (kwBlock ? (kwBlock + "\n") : "") +
    "OUTPUT JSON ONLY:\n" +
    "{ \"title\": \"...\", \"slug\": \"...\" }\n\n" +
    "ENGLISH REFERENCE TITLE: " + String(s.english_title || '') + "\n" +
    "CURRENT TITLE: " + String(meta.rank_math_title || g.AI_SEO_Title || '') + "\n" +
    "CURRENT SLUG: " + String(core.slug || g.AI_SEO_Permalink || '') + "\n"

  var res = await callAiForTargetLangWithRetry_Updater_(prompt, lang)
  if (!res || typeof res !== 'object' || Array.isArray(res)) return null
  var out = { title: '', slug: '' }
  if (res.title) out.title = String(res.title).trim()
  if (res.slug) out.slug = String(res.slug).trim()
  if (!out.title && !out.slug) return null
  out.slug = finalizeTranslatedSlug_Updater_(out.slug, { maxLen: 80, spec: s })
  if (slugLocked) out.slug = ''
  return out
}

function applyTitleSlugFallbackNoEnglishMixing_Updater_(payload, targetLang, kw, spec, slugLocked) {
  var out = payload || {}
  out.meta = out.meta || {}
  out.core = out.core || {}
  var lang = String(targetLang || '').toLowerCase()
  var s = spec || {}
  var primary = kw && kw.primary ? String(kw.primary).trim() : ''

  var parts = []
  if (primary) parts.push(primary)
  var selected = []
  if (s.landmarks && s.landmarks.length) selected = s.landmarks.slice(0, 2)
  var names = selected.map(function (x) {
    var v = String(x || '').trim()
    var repl = localizeForbiddenEnglishPhraseForLang_Updater_(v, lang)
    return repl || v
  }).filter(function (x) { return !!x }).join(' & ')
  if (names) parts.push(names)
  else if (s.place) parts.push(String(s.place).trim())

  var title = parts.join(' - ').trim()
  title = replaceDisallowedEnglishGenericPhrases_Updater_(title, lang, kw, s)
  title = truncateAtWordBoundary_Updater_(normalizeSeoHeadTextForQuality_Updater_(title), 65)
  if (title) out.meta.rank_math_title = title

  if (!slugLocked) {
    var slug = buildShortSlugFromPrimaryKeyword_Updater_(primary) || sanitizeTranslatedSlug_(primary)
    if (slug.length < 10 && names) slug = sanitizeTranslatedSlug_(slug + '-' + names)
    slug = replaceDisallowedEnglishGenericPhrases_Updater_(slug.replace(/-/g, ' '), lang, kw, s)
    slug = finalizeTranslatedSlug_Updater_(slug, { maxLen: 80, spec: s })
    if (slug) out.core.slug = slug
  }

  return out
}

function getLandmarkSpecificityRequirementsFromEnglish_Updater_(spec) {
  var s = spec || {}
  var enTitle = normalizeForEnglishPhraseScan_Updater_(String(s.english_landmark_title || s.english_title || ''))
  var enMeta = normalizeForEnglishPhraseScan_Updater_(String(s.english_landmark_meta || s.english_meta || ''))
  var enSlug = normalizeForEnglishPhraseScan_Updater_(String(s.english_landmark_slug || s.english_slug || ''))
  var enAll = normalizeForEnglishPhraseScan_Updater_(String(s.english_landmark_title || s.english_title || '') + ' ' + String(s.english_landmark_meta || s.english_meta || '') + ' ' + String(s.english_landmark_slug || s.english_slug || '') + ' ' + (s.landmarks ? s.landmarks.join(' ') : ''))

  function hasAny_(hay, needles) {
    var h = String(hay || '')
    for (var i = 0; i < needles.length; i++) {
      if (h.indexOf(needles[i]) !== -1) return true
    }
    return false
  }

  function score_(needles) {
    var inTitle = hasAny_(enTitle, needles)
    var inSlug = hasAny_(enSlug, needles)
    var inMeta = hasAny_(enMeta, needles)
    var inAny = hasAny_(enAll, needles)
    var score = (inTitle ? 6 : 0) + (inSlug ? 4 : 0) + (inMeta ? 2 : 0) + (inAny ? 1 : 0)
    return { present: inAny, inTitle: inTitle, inSlug: inSlug, inMeta: inMeta, score: score }
  }

  var civNeedles = ['civilization museum', 'egyptian civilization museum', 'national museum of egyptian civilization', 'nmec']
  var egyptNeedles = ['egyptian museum', 'museum of egyptian antiquities']
  var oldNeedles = ['old cairo']
  var khanNeedles = ['khan el khalili']

  var civ = score_(civNeedles)
  var egypt = score_(egyptNeedles)
  var old = score_(oldNeedles)
  var khan = score_(khanNeedles)

  var canonFam = String(s.landmark_canonical_museum_family || '').toLowerCase()
  var canonClear = !!s.landmark_canonical_is_clear
  if (canonClear && canonFam === 'egyptian') {
    civ.present = false
    civ.inTitle = false
    civ.inSlug = false
    civ.inMeta = false
    civ.score = 0
  } else if (canonClear && canonFam === 'civilization' && !civ.present) {
    civ.present = true
    civ.score = Math.max(6, civ.score || 0)
  }

  var items = {
    civilization_museum: civ,
    old_cairo: old,
    khan_el_khalili: khan
  }

  var presentKeys = Object.keys(items).filter(function (k) { return items[k] && items[k].present })
  var wantPrimaryCount = (String(s.english_title || '').length >= 45) ? 3 : 2
  if (wantPrimaryCount < 1) wantPrimaryCount = 1

  presentKeys.sort(function (a, b) { return (items[b].score || 0) - (items[a].score || 0) })

  var primaryKeys = []
  presentKeys.forEach(function (k) {
    if (!items[k]) return
    if (k === 'khan_el_khalili' && !(items[k].inTitle || items[k].inSlug)) return
    if (k === 'old_cairo') {
      var oldStrong = !!(items[k].inTitle && items[k].inSlug)
      if (!oldStrong && presentKeys.length > 1) return
      if (!(items[k].inTitle || items[k].inSlug)) return
    }
    if ((items[k].inTitle || items[k].inSlug) && primaryKeys.indexOf(k) === -1) primaryKeys.push(k)
  })

  for (var i = 0; i < presentKeys.length && primaryKeys.length < wantPrimaryCount; i++) {
    var k2 = presentKeys[i]
    if (primaryKeys.indexOf(k2) !== -1) continue
    if (k2 === 'khan_el_khalili') continue
    if (k2 === 'old_cairo') continue
    if (items[k2] && items[k2].score >= 4) primaryKeys.push(k2)
  }

  if (!primaryKeys.length && presentKeys.length) primaryKeys.push(presentKeys[0])

  var secondaryKeys = presentKeys.filter(function (k) { return primaryKeys.indexOf(k) === -1 })

  if (!canonClear && items.civilization_museum && items.civilization_museum.present) {
    primaryKeys = primaryKeys.filter(function (k) { return k !== 'civilization_museum' })
    if (secondaryKeys.indexOf('civilization_museum') === -1) secondaryKeys.push('civilization_museum')
  }

  return {
    items: items,
    primary_keys: primaryKeys,
    secondary_keys: secondaryKeys
  }
}

function getCivilizationMuseumMarkersForLang_Updater_(lang) {
  var l = String(lang || '').toLowerCase()
  var map = {
    'de': [
      'nationalmuseum der ägyptischen zivilisation',
      'nationalmuseum der aegyptischen zivilisation',
      'ägyptisches zivilisationsmuseum',
      'aegyptisches zivilisationsmuseum',
      'zivilisationsmuseum',
      'zivilisation',
      'nmec'
    ],
    'fr': [
      'musée national de la civilisation égyptienne',
      'musée de la civilisation égyptienne',
      'musee national de la civilisation egyptienne',
      'musee de la civilisation egyptienne',
      'civilisation égyptienne',
      'civilisation egyptienne',
      'nmec'
    ]
  }
  return map[l] || ['civiliz', 'nmec']
}

function textContainsAnyMarker_Updater_(text, markers) {
  var t = normalizeForSpecMatch_Updater_(text)
  if (!t) return false
  for (var i = 0; i < (markers || []).length; i++) {
    var m = normalizeForSpecMatch_Updater_(markers[i])
    if (m && t.indexOf(m) !== -1) return true
  }
  return false
}

function findFirstMarkerMatch_Updater_(text, markers) {
  var t = normalizeForSpecMatch_Updater_(text)
  if (!t) return ''
  for (var i = 0; i < (markers || []).length; i++) {
    var raw = String(markers[i] || '')
    var m = normalizeForSpecMatch_Updater_(raw)
    if (m && t.indexOf(m) !== -1) return raw
  }
  return ''
}

function validateLandmarkSpecificityPreservation_Updater_(spec, payload, targetLang) {
  var lang = String(targetLang || '').toLowerCase()
  if (!lang || lang === 'en') return { ok: true, reasons: [], warnings: [], primary_missing: [], secondary_missing: [], primary_present: [] }

  var req = getLandmarkSpecificityRequirementsFromEnglish_Updater_(spec)
  var p = payload || {}
  var meta = p.meta || {}
  var core = p.core || {}

  var combined = [meta.rank_math_title, meta.rank_math_description, core.title, core.slug].map(function (x) { return String(x || '') }).join(' | ')
  var primaryMissing = []
  var secondaryMissing = []
  var primaryPresent = []
  var warnings = []

  function mark_(key, ok) {
    var isPrimary = req && req.primary_keys && req.primary_keys.indexOf(key) !== -1
    var isSecondary = req && req.secondary_keys && req.secondary_keys.indexOf(key) !== -1
    if (ok) {
      if (isPrimary) primaryPresent.push(key)
      return
    }
    if (isPrimary) primaryMissing.push(key)
    else if (isSecondary) secondaryMissing.push(key)
  }

  var civAliasAccepted = false
  if (req && req.items && req.items.civilization_museum && req.items.civilization_museum.present) {
    var markers = getCivilizationMuseumMarkersForLang_Updater_(lang)
    var okC = textContainsAnyMarker_Updater_(combined, markers)
    if (!okC && lang === 'fr') {
      log('CIVILIZATION MUSEUM MARKER NOT DETECTED (fr): sample="' + String(combined || '').substring(0, 220) + '"')
    } else if (okC && lang === 'fr') {
      var hit = findFirstMarkerMatch_Updater_(combined, markers)
      if (hit) log('CIVILIZATION MUSEUM MARKER DETECTED (fr): ' + hit)
    }
    var normCombined = normalizeForSpecMatch_Updater_(combined)
    if (normCombined && normCombined.indexOf('nmec') !== -1) {
      civAliasAccepted = true
      log('LANDMARK ALIAS ACCEPTED: NMEC ~ National Museum of Egyptian Civilization (' + lang + ')')
    }
    mark_('civilization_museum', okC)
  }
  if (req && req.items && req.items.old_cairo && req.items.old_cairo.present) {
    var oc = localizeForbiddenEnglishPhraseForLang_Updater_('old cairo', lang) || ''
    var ocOk = oc ? textContainsAnyMarker_Updater_(combined, [oc, 'old cairo', 'alt-kairo', 'alt kairo', 'altkairo']) : textContainsAnyMarker_Updater_(combined, ['old cairo', 'alt-kairo', 'alt kairo', 'altkairo'])
    mark_('old_cairo', ocOk)
  }
  if (req && req.items && req.items.khan_el_khalili && req.items.khan_el_khalili.present) {
    var okK = textContainsAnyMarker_Updater_(combined, ['khan el khalili', 'khan-el-khalili'])
    mark_('khan_el_khalili', okK)
  }

  if (secondaryMissing.length) warnings = secondaryMissing.map(function (k) { return 'secondary_landmark_missing_' + k })
  var reasons = primaryMissing.map(function (k) { return 'landmark_specificity_failed_' + k })
  var canonClear2 = spec && spec.landmark_canonical_is_clear ? true : false
  var canonFam2 = spec && spec.landmark_canonical_museum_family ? String(spec.landmark_canonical_museum_family).toLowerCase() : ''

  if (canonClear2 && canonFam2 === 'civilization' && reasons.indexOf('landmark_specificity_failed_civilization_museum') !== -1 && civAliasAccepted) {
    reasons = reasons.filter(function (r) { return r !== 'landmark_specificity_failed_civilization_museum' })
    primaryMissing = primaryMissing.filter(function (k) { return k !== 'civilization_museum' })
    if (warnings.indexOf('primary_landmark_alias_accepted_civilization_museum') === -1) warnings.push('primary_landmark_alias_accepted_civilization_museum')
    log('PRIMARY LANDMARK ALIAS ACCEPTED - HARD FAIL CLEARED (' + lang + ')')
  }

  var oldStrong2 = false
  try {
    var eT = normalizeForEnglishPhraseScan_Updater_(String((spec && (spec.english_landmark_title || spec.english_title)) || ''))
    var eS = normalizeForEnglishPhraseScan_Updater_(String((spec && (spec.english_landmark_slug || spec.english_slug)) || ''))
    oldStrong2 = eT.indexOf('old cairo') !== -1 && eS.indexOf('old-cairo') !== -1
  } catch (eOldStrong) {}
  if (reasons.indexOf('landmark_specificity_failed_old_cairo') !== -1 && !oldStrong2) {
    reasons = reasons.filter(function (r) { return r !== 'landmark_specificity_failed_old_cairo' })
    primaryMissing = primaryMissing.filter(function (k) { return k !== 'old_cairo' })
    if (warnings.indexOf('old_cairo_missing_accepted_secondary') === -1) warnings.push('old_cairo_missing_accepted_secondary')
    log('OLD CAIRO MISSING BUT ACCEPTED AS SECONDARY (' + lang + ')')
  }

  if (!canonClear2 || (canonFam2 !== 'civilization' && canonFam2 !== 'egyptian')) {
    var hard = reasons.filter(function (r) { return r !== 'landmark_specificity_failed_civilization_museum' })
    if (hard.length === 0 && reasons.length) {
      warnings = warnings.concat(['source_landmark_inconsistent_normalized'])
      reasons = []
    }
  }
  return { ok: reasons.length === 0, reasons: reasons, warnings: warnings, primary_missing: primaryMissing, secondary_missing: secondaryMissing, primary_present: primaryPresent }
}

function applyLandmarkSpecificityFix_Updater_(payload, targetLang, kw, spec, slugLocked) {
  var out = payload || {}
  out.meta = out.meta || {}
  out.core = out.core || {}
  var lang = String(targetLang || '').toLowerCase()
  if (!lang || lang === 'en') return out

  var req = getLandmarkSpecificityRequirementsFromEnglish_Updater_(spec)
  var combined = String(out.meta.rank_math_title || '') + ' | ' + String(out.meta.rank_math_description || '') + ' | ' + String(out.core.slug || '')

  var requireCiv = req && req.primary_keys && req.primary_keys.indexOf('civilization_museum') !== -1
  var requireOld = req && req.primary_keys && req.primary_keys.indexOf('old_cairo') !== -1
  var requireKhan = req && req.primary_keys && req.primary_keys.indexOf('khan_el_khalili') !== -1

  if (requireCiv) {
    var markers = getCivilizationMuseumMarkersForLang_Updater_(lang)
    if (!textContainsAnyMarker_Updater_(combined, markers)) {
      var civPhrase = ''
      if (lang === 'fr') {
        civPhrase = 'Musée national de la civilisation égyptienne (NMEC)'
      } else {
        civPhrase =
          localizeForbiddenEnglishPhraseForLang_Updater_('national museum of egyptian civilization', lang) ||
          localizeForbiddenEnglishPhraseForLang_Updater_('egyptian civilization museum', lang) ||
          localizeForbiddenEnglishPhraseForLang_Updater_('civilization museum', lang)
      }

      if (civPhrase) {
        if (lang === 'fr') log('LANDMARK FIX INSERT (fr): civilization_museum -> "' + civPhrase + '"')
        var title = String(out.meta.rank_math_title || '').trim()
        var titleNorm = normalizeForSpecMatch_Updater_(title)
        var civNorm = normalizeForSpecMatch_Updater_(civPhrase)
        if (title && civNorm && titleNorm.indexOf(civNorm) === -1) {
          title = title.replace(/(aegyptisches\s+museum|ägyptisches\s+museum|egyptian\s+museum)/i, civPhrase)
        }
        if (title && civNorm && normalizeForSpecMatch_Updater_(title).indexOf(civNorm) === -1) {
          title = (title + ' – ' + civPhrase).trim()
        } else if (!title) {
          title = String(civPhrase)
        }
        title = truncateAtWordBoundary_Updater_(normalizeSeoHeadTextForQuality_Updater_(title), 65)
        if (title) out.meta.rank_math_title = title

        var desc = String(out.meta.rank_math_description || '').trim()
        if (desc && normalizeForSpecMatch_Updater_(desc).indexOf(civNorm) === -1) {
          desc = (civPhrase + ' – ' + desc).trim()
        } else if (!desc) {
          desc = String(civPhrase)
        }
        desc = truncateAtWordBoundary_Updater_(normalizeSeoHeadTextForQuality_Updater_(desc), 160)
        if (desc) out.meta.rank_math_description = desc

        if (lang === 'fr') {
          var checkCombined = String(out.meta.rank_math_title || '') + ' | ' + String(out.meta.rank_math_description || '') + ' | ' + String(out.core.title || '') + ' | ' + String(out.core.slug || '')
          var okNow = textContainsAnyMarker_Updater_(checkCombined, markers)
          log('LANDMARK FIX RESULT (fr): civilization_museum_present=' + (okNow ? 'yes' : 'no'))
        }

        if (!slugLocked) {
          var slug = String(out.core.slug || '').trim()
          var civSlug = sanitizeTranslatedSlug_(String(civPhrase))
          if (civSlug) {
            if (!slug) slug = civSlug
            else if (slug.indexOf(civSlug) === -1) {
              var replaced = false
              if (slug.indexOf('aegyptisches-museum') !== -1) { slug = slug.replace('aegyptisches-museum', civSlug); replaced = true }
              else if (slug.indexOf('agyptisches-museum') !== -1) { slug = slug.replace('agyptisches-museum', civSlug); replaced = true }
              if (!replaced) slug = (slug + '-' + civSlug)
            }
            slug = finalizeTranslatedSlug_Updater_(slug, { maxLen: 80, spec: spec })
            if (slug) out.core.slug = slug
          }
        }
      }
    }
  }

  if (requireOld) {
    var ocPhrase = localizeForbiddenEnglishPhraseForLang_Updater_('old cairo', lang) || ''
    var ocOk = ocPhrase ? textContainsAnyMarker_Updater_(combined, [ocPhrase, 'old cairo', 'alt-kairo', 'alt kairo', 'altkairo']) : textContainsAnyMarker_Updater_(combined, ['old cairo', 'alt-kairo', 'alt kairo', 'altkairo'])
    if (!ocOk && ocPhrase) {
      var t1 = String(out.meta.rank_math_title || '').trim()
      if (t1 && normalizeForSpecMatch_Updater_(t1).indexOf(normalizeForSpecMatch_Updater_(ocPhrase)) === -1) {
        t1 = (t1 + ' – ' + ocPhrase).trim()
        t1 = truncateAtWordBoundary_Updater_(normalizeSeoHeadTextForQuality_Updater_(t1), 65)
        out.meta.rank_math_title = t1
      }
      var d1 = String(out.meta.rank_math_description || '').trim()
      if (d1 && normalizeForSpecMatch_Updater_(d1).indexOf(normalizeForSpecMatch_Updater_(ocPhrase)) === -1) {
        d1 = (d1 + ' – ' + ocPhrase).trim()
        d1 = truncateAtWordBoundary_Updater_(normalizeSeoHeadTextForQuality_Updater_(d1), 160)
        out.meta.rank_math_description = d1
      }
      if (!slugLocked) {
        var s1 = String(out.core.slug || '').trim()
        var ocSlug = sanitizeTranslatedSlug_(ocPhrase)
        if (ocSlug && s1.indexOf(ocSlug) === -1) {
          s1 = (s1 ? (s1 + '-' + ocSlug) : ocSlug)
          out.core.slug = finalizeTranslatedSlug_Updater_(s1, { maxLen: 80, spec: spec })
        }
      }
    }
  }

  if (requireKhan) {
    var khOk = textContainsAnyMarker_Updater_(combined, ['khan el khalili', 'khan-el-khalili'])
    if (!khOk) {
      var kh = 'Khan El Khalili'
      var t2 = String(out.meta.rank_math_title || '').trim()
      if (t2 && normalizeForSpecMatch_Updater_(t2).indexOf(normalizeForSpecMatch_Updater_(kh)) === -1) {
        t2 = (t2 + ' – ' + kh).trim()
        t2 = truncateAtWordBoundary_Updater_(normalizeSeoHeadTextForQuality_Updater_(t2), 65)
        out.meta.rank_math_title = t2
      }
      var d2 = String(out.meta.rank_math_description || '').trim()
      if (d2 && normalizeForSpecMatch_Updater_(d2).indexOf(normalizeForSpecMatch_Updater_(kh)) === -1) {
        d2 = (d2 + ' – ' + kh).trim()
        d2 = truncateAtWordBoundary_Updater_(normalizeSeoHeadTextForQuality_Updater_(d2), 160)
        out.meta.rank_math_description = d2
      }
      if (!slugLocked) {
        var s2 = String(out.core.slug || '').trim()
        if (s2.indexOf('khan-el-khalili') === -1) {
          s2 = (s2 ? (s2 + '-khan-el-khalili') : 'khan-el-khalili')
          out.core.slug = finalizeTranslatedSlug_Updater_(s2, { maxLen: 80, spec: spec })
        }
      }
    }
  }

  if (!slugLocked && out.core && out.core.slug) {
    out.core.slug = finalizeTranslatedSlug_Updater_(out.core.slug, { maxLen: 80, spec: spec })
  }

  return out
}

function buildSpecificTitleFallback_Updater_(kw, spec) {
  var s = spec || {};
  var primary = kw && kw.primary ? String(kw.primary).trim() : '';
  var parts = [];
  if (primary) parts.push(primary);
  var names = s.landmarks && s.landmarks.length ? s.landmarks.slice(0, 2).join(' & ') : '';
  if (names) parts.push(names);
  else if (s.place) parts.push(String(s.place).trim());
  var out = parts.join(' - ').trim();
  out = truncateAtWordBoundary_Updater_(normalizeSeoHeadTextForQuality_Updater_(out), 65)
  return out;
}

function buildSpecificMetaFallback_Updater_(kw, spec) {
  var s = spec || {};
  var primary = kw && kw.primary ? String(kw.primary).trim() : '';
  var names = s.landmarks && s.landmarks.length ? s.landmarks.slice(0, 3).join(', ') : '';
  var out = '';
  if (primary && names) out = primary + ': ' + names + '.';
  else if (primary) out = primary + '.';
  else out = names;
  out = String(out || '').trim();
  out = truncateAtWordBoundary_Updater_(normalizeSeoHeadTextForQuality_Updater_(out), 160)
  return out;
}

function buildSpecificSlugFallback_Updater_(kw, spec) {
  var s = spec || {};
  var primary = kw && kw.primary ? String(kw.primary).trim() : '';
  var base = buildShortSlugFromPrimaryKeyword_Updater_(primary) || sanitizeTranslatedSlug_(primary);
  var extras = [];
  if (s.landmark_slugs && s.landmark_slugs.length) extras = s.landmark_slugs.slice(0, 2);
  var slug = base;
  extras.forEach(function(x) {
    var part = String(x || '').trim();
    if (!part) return;
    if (slug && slug.indexOf(part) !== -1) return;
    slug = (slug ? (slug + '-' + part) : part);
  });
  return finalizeTranslatedSlug_Updater_(slug, { maxLen: 80, spec: s });
}

function applySpecificityFallbackSeo_Updater_(payload, kw, spec, slugLocked) {
  var out = payload || {};
  out.meta = out.meta || {};
  out.core = out.core || {};
  var title = buildSpecificTitleFallback_Updater_(kw, spec);
  var desc = buildSpecificMetaFallback_Updater_(kw, spec);
  var slug = buildSpecificSlugFallback_Updater_(kw, spec);
  if (title) out.meta.rank_math_title = title;
  if (desc) out.meta.rank_math_description = desc;
  if (!slugLocked && slug) out.core.slug = slug;
  var primary = kw && kw.primary ? String(kw.primary).trim() : '';
  var alt = String(out.meta.localized_image_alt || '').trim();
  if (!alt) alt = primary;
  if (primary && alt && alt.toLowerCase().indexOf(primary.toLowerCase()) === -1) alt = (primary + ' - ' + alt).trim();
  if (alt) out.meta.localized_image_alt = alt;
  return out;
}

function normalizeKeywordsObject_Updater_(kw) {
  var out = { primary: '', secondary: [], all: [] };
  if (!kw) return out;
  out.primary = kw.primary ? String(kw.primary).trim() : '';
  out.secondary = kw.secondary && Array.isArray(kw.secondary) ? kw.secondary.map(function(s) { return String(s || '').trim(); }).filter(function(s) { return !!s; }) : [];
  var seen = {};
  var all = [];
  [out.primary].concat(out.secondary).forEach(function(s) {
    var v = String(s || '').trim();
    if (!v) return;
    var key = v.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    all.push(v);
  });
  out.primary = all.length ? all[0] : out.primary;
  out.secondary = all.length > 1 ? all.slice(1, 5) : [];
  out.all = all;
  return out;
}

function isLikelyLanguageContamination_Updater_(text, targetLang) {
  var lang = String(targetLang || '').toLowerCase()
  var t = String(text || '').trim()
  if (!t) return { contaminated: false, markers: [] }
  var markers = []

  if (lang !== 'tr') {
    var trChars = (lang === 'fr') ? /[ıİşŞğĞ]/ : ((lang === 'de') ? /[ıİşŞğĞçÇ]/ : /[ıİşŞğĞçÇöÖüÜ]/)
    if (trChars.test(t)) markers.push('turkish_chars')
    var tNorm = normalizeForSpecMatch_Updater_(t)
    if (tNorm.indexOf('kahire') !== -1) markers.push('turkish_kahire')
    if (tNorm.indexOf('turu') !== -1) markers.push('turkish_turu')
    if (tNorm.indexOf('turlari') !== -1 || tNorm.indexOf('turları') !== -1) markers.push('turkish_turlari')
    if (tNorm.indexOf('misir') !== -1 || tNorm.indexOf('mısır') !== -1) markers.push('turkish_misir')
    if (tNorm.indexOf('gunubirlik') !== -1 || tNorm.indexOf('günübirlik') !== -1) markers.push('turkish_gunubirlik')
  }

  if (lang !== 'en') {
    var low = t.toLowerCase()
    if (low.indexOf('day tours') !== -1 || low.indexOf('day tour') !== -1) markers.push('english_day_tours')
    if (low.indexOf('egyptian museum') !== -1) markers.push('english_egyptian_museum')
    if (low.indexOf('cairo museum') !== -1) markers.push('english_cairo_museum')
  }

  var det = detectLanguageSafe_Updater_(t.length > 260 ? t.substring(0, 260) : t)
  if (det && !langMatchesOrBase_Updater_(det, lang)) markers.push('detected_lang_' + det)

  return { contaminated: markers.length > 0, markers: markers }
}

function listTurkishCharMarkers_Updater_(text) {
  var t = String(text || '')
  if (!t) return []
  var m = t.match(/[ıİşŞğĞçÇöÖüÜ]/g)
  if (!m || !m.length) return []
  var seen = {}
  var out = []
  m.forEach(function(ch) {
    if (seen[ch]) return
    seen[ch] = true
    out.push(ch)
  })
  return out
}

function validateSingleLanguagePurity_Updater_(targetLang, fieldMap) {
  var lang = String(targetLang || '').toLowerCase()
  var fields = fieldMap && typeof fieldMap === 'object' ? fieldMap : {}
  var contaminated = []
  for (var k in fields) {
    if (!fields.hasOwnProperty(k)) continue
    var v = String(fields[k] == null ? '' : fields[k]).trim()
    if (!v) continue
    var check = isLikelyLanguageContamination_Updater_(v, lang)
    if (!check.contaminated) continue
    contaminated.push({ field: k, markers: check.markers, sample: v.substring(0, 140) })
  }
  return { ok: contaminated.length === 0, contaminated: contaminated }
}

function removeObviousCrossLanguageFragments_Updater_(text, targetLang) {
  var lang = String(targetLang || '').toLowerCase()
  var t = String(text || '')
  if (!t) return t
  if (lang !== 'tr') {
    t = t.replace(/\bkahire\s+turlar[ıi]\b/ig, '')
    t = t.replace(/\bm[ıi]s[ıi]r\s+kahire\s+turu\b/ig, '')
    t = t.replace(/\bkahire\s+turu\b/ig, '')
    t = t.replace(/\bkahire\b/ig, '')
    t = t.replace(/\bturu\b/ig, '')
    t = t.replace(/\bturlar[ıi]\b/ig, '')
    t = t.replace(/\bm[ıi]s[ıi]r\b/ig, '')
    if (lang === 'fr' || lang === 'de') {
      t = t.replace(/ı/g, 'i').replace(/İ/g, 'I').replace(/ş/g, 's').replace(/Ş/g, 'S').replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
      if (lang === 'de') t = t.replace(/ç/g, 'c').replace(/Ç/g, 'C')
    }
  }
  if (lang !== 'en') {
    t = t.replace(/\bday\s+tours?\b/ig, '')
    t = t.replace(/\bcairo\s+museum\b/ig, '')
    t = t.replace(/\begyptian\s+museum\s+cairo\b/ig, '')
  }
  t = t.replace(/\s{2,}/g, ' ')
  t = t.replace(/>\s+</g, '><')
  return t
}

async function regenerateBodyHtmlOnly_Updater_(html, targetLang) {
  var lang = String(targetLang || '').toLowerCase()
  var h = String(html || '')
  if (!h) return h
  var prompt =
    "You are a native-level travel localization editor.\n" +
    "Fix the following HTML body content so it is fully in " + lang.toUpperCase() + " and contains ZERO Turkish words/characters.\n" +
    "CRITICAL RULES:\n" +
    "- Output MUST be ONLY in the target language: " + lang + ".\n" +
    "- Preserve ALL meaning and ALL factual details exactly.\n" +
    "- Preserve ALL existing HTML tags exactly. Do NOT add/remove tags, wrappers, or attributes.\n" +
    "- Remove or rewrite any Turkish fragments into natural " + lang.toUpperCase() + ".\n" +
    "- Return ONLY valid JSON.\n\n" +
    "INPUT JSON:\n" + JSON.stringify({ html: h }) + "\n\n" +
    "OUTPUT JSON:\n" + "{\"html\":\"...\"}"
  var res = await callAiForTargetLangWithRetry_Updater_(prompt, lang)
  if (res && typeof res === 'object' && res.html) return String(res.html || '')
  return h
}

async function translateKeywordPhraseToTargetLang_Updater_(phrase, targetLang) {
  var lang = String(targetLang || '').toLowerCase()
  var p = String(phrase || '').trim()
  if (!p) return ''
  var prompt =
    "Translate this SEO keyword phrase into " + lang.toUpperCase() + ".\n" +
    "CRITICAL RULES:\n" +
    "- TARGET LANGUAGE ONLY: output ONLY in " + lang + ".\n" +
    "- Do NOT include any other language (no Turkish, no English).\n" +
    "- Keep proper nouns unchanged.\n" +
    "- Return ONLY valid JSON.\n\n" +
    "INPUT JSON:\n" + JSON.stringify({ keyword: p }) + "\n\n" +
    "OUTPUT JSON:\n" + "{\"keyword\":\"...\"}"
  var res = await callAiForTargetLangWithRetry_Updater_(prompt, lang)
  if (res && typeof res === 'object' && !Array.isArray(res) && res.keyword) return String(res.keyword || '').trim()
  return ''
}

async function enforceKeywordsTargetLanguagePurity_Updater_(kwObj, targetLang, englishFallback) {
  var lang = String(targetLang || '').toLowerCase()
  var out = normalizeKeywordsObject_Updater_(kwObj)
  var fb = normalizeKeywordsObject_Updater_(englishFallback)

  function isBad_(s) {
    var v = String(s || '').trim()
    if (!v) return true
    var c = isLikelyLanguageContamination_Updater_(v, lang)
    if (c.contaminated) return true
    var det = detectLanguageSafe_Updater_(v)
    if (det && !langMatchesOrBase_Updater_(det, lang)) return true
    return false
  }

  if (out.primary && isBad_(out.primary)) {
    log('LANGUAGE CONTAMINATION DETECTED (' + lang + '): primary_keyword=' + out.primary)
    log('REGENERATING CONTAMINATED FIELD: primary_keyword (' + lang + ')')
    var src = fb.primary ? fb.primary : out.primary
    var tr = await translateKeywordPhraseToTargetLang_Updater_(src, lang)
    if (tr && !isBad_(tr)) out.primary = tr
    else out.primary = ''
  }

  var cleanedSecondary = []
  ;(out.secondary || []).forEach(function (s) {
    var v = String(s || '').trim()
    if (!v) return
    if (isBad_(v)) return
    cleanedSecondary.push(v)
  })
  out.secondary = cleanedSecondary.slice(0, 4)

  if (!out.primary && fb.primary) {
    var tr2 = await translateKeywordPhraseToTargetLang_Updater_(fb.primary, lang)
    if (tr2 && !isBad_(tr2)) out.primary = tr2
  }

  out.all = [out.primary].concat(out.secondary).filter(function (x) { return !!String(x || '').trim() })
  return out
}

async function regenerateContaminatedSeoFields_Updater_(payload, targetLang, kw, spec) {
  var lang = String(targetLang || '').toLowerCase()
  var out = payload || {}
  out.core = out.core || {}
  out.meta = out.meta || {}
  var primary = kw && kw.primary ? String(kw.primary).trim() : ''
  var civ = spec && String(spec.landmark_canonical_museum_family || '').toLowerCase() === 'civilization'
    ? localizeForbiddenEnglishPhraseForLang_Updater_('civilization museum', lang)
    : ''

  var prompt =
    "Rewrite the following fields for a travel landing page in " + lang.toUpperCase() + ".\n" +
    "CRITICAL RULES:\n" +
    "- TARGET LANGUAGE ONLY: output ONLY in " + lang + ".\n" +
    "- No Turkish/English contamination.\n" +
    "- Keep meaning and facts.\n" +
    (primary ? ("- Must include this Primary Keyword verbatim at least once in SEO title OR meta description: " + primary + "\n") : "") +
    (civ ? ("- Must preserve this landmark meaning in the SEO title if relevant: " + civ + "\n") : "") +
    "Return ONLY valid JSON.\n\n" +
    "INPUT JSON:\n" + JSON.stringify({
      page_title: String(out.core.title || ''),
      seo_title: String(out.meta.rank_math_title || ''),
      meta_description: String(out.meta.rank_math_description || '')
    }) + "\n\n" +
    "OUTPUT JSON:\n" + "{\"page_title\":\"...\",\"seo_title\":\"...\",\"meta_description\":\"...\"}"

  var res = await callAiForTargetLangWithRetry_Updater_(prompt, lang)
  if (res && typeof res === 'object' && !Array.isArray(res)) {
    if (res.page_title) out.core.title = String(res.page_title).trim()
    if (res.seo_title) out.meta.rank_math_title = String(res.seo_title).trim()
    if (res.meta_description) out.meta.rank_math_description = String(res.meta_description).trim()
  }
  return out
}

async function getMandatorySeoKeywordsForLang_Updater_(tripFields, enhancedData, targetLang) {
  var lang = String(targetLang || '').toLowerCase();
  var f = tripFields || {};
  var data = enhancedData || {};
  var selected = null;
  var multilingualList = extractSeoKeywordsListFromTripsField_Updater_(f, data);
  if (multilingualList && multilingualList.length) {
    selected = await selectSeoKeywordsFromMultilingualList_Updater_(multilingualList, lang);
  }
  if (!selected) selected = selectKeywordsFromSeoFocusKeywordsListForLang_Updater_(f, lang);
  if (!selected) selected = extractProvidedSeoKeywordsForLang_Updater_(f, lang);

  selected = normalizeKeywordsObject_Updater_(selected);
  var englishFallback = normalizeKeywordsObject_Updater_(extractProvidedSeoKeywords_Updater_(data, f));

  if (!selected.primary && selected.secondary.length) selected.primary = String(selected.secondary.shift() || '').trim();
  if (!selected.primary) selected.primary = englishFallback.primary;
  if (!selected.primary) selected.primary = String((data.general && data.general.AI_SEO_Title) || '').trim();
  if (!selected.primary) selected.primary = 'tour';

  var merged = normalizeKeywordsObject_Updater_(selected);
  var fb = [englishFallback.primary].concat(englishFallback.secondary || []).map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x; });
  fb.forEach(function(x) {
    if (merged.secondary.length >= 4) return;
    var key = x.toLowerCase();
    if (!key || key === merged.primary.toLowerCase()) return;
    var exists = merged.all.some(function(k) { return String(k || '').toLowerCase() === key; });
    if (exists) return;
    merged.secondary.push(x);
    merged.all.push(x);
  });
  if (merged.secondary.length > 4) merged.secondary = merged.secondary.slice(0, 4);
  merged.all = [merged.primary].concat(merged.secondary);
  merged = await enforceKeywordsTargetLanguagePurity_Updater_(merged, lang, englishFallback)
  return merged;
}

function truncateAtWordBoundary_Updater_(text, maxLen) {
  var s = String(text || '').replace(/\s+/g, ' ').trim()
  var n = Number(maxLen || 0)
  if (!n || n <= 0) return s
  if (s.length <= n) return s
  var slice = s.substring(0, n + 1)
  var cut = slice.lastIndexOf(' ')
  if (cut <= 0) {
    var lastPunct = -1
    for (var i = slice.length - 1; i >= 0; i--) {
      var ch = slice.charAt(i)
      if (ch === '，' || ch === '。' || ch === '、' || ch === '！' || ch === '？' || ch === '；' || ch === '：' || ch === '·') { lastPunct = i; break }
    }
    if (lastPunct >= Math.floor(n * 0.6)) cut = lastPunct
    else cut = n
    s = s.substring(0, cut).trim()
  } else {
    if (cut < Math.floor(n * 0.6)) cut = n
    s = s.substring(0, cut).trim()
  }
  s = s.replace(/\s*[|—–\-:;,]+\s*$/g, '').trim()
  s = s.replace(/\s*&\s*[A-Za-zÀ-ÿ]$/g, '').trim()
  s = s.replace(/[，。、！？；：·]+$/g, '').trim()
  return s
}

function normalizeSeoHeadTextForQuality_Updater_(s) {
  var x = String(s || '').replace(/\s+/g, ' ').trim()
  x = x.replace(/\s+[|—–\-:;,]\s*$/g, '')
  x = x.replace(/\s*[|—–\-:;,]+\s*$/g, '')
  x = x.replace(/\s*\+\s*$/g, '')
  x = x.replace(/\s*&\s*$/g, '')
  x = x.replace(/\s*&\s*[A-Za-zÀ-ÿ]$/g, '')
  var guard = 0
  while (guard < 6) {
    var t = x.replace(/[.!?]+$/g, '').trim()
    if (!t) { x = ''; break }
    if (!/\b(with|and|or|but|for|to|from|of|in|on|at|by|a|an|the)\b\s*$/i.test(t)) { x = t; break }
    x = t.replace(/\b(?:with|and|or|but|for|to|from|of|in|on|at|by|a|an|the)\b[\s.]*$/i, '').trim()
    guard++
  }
  x = x.replace(/\s+/g, ' ').trim()
  return x
}

function dedupeSeoTitleSegments_Updater_(title) {
  var t = normalizeSeoHeadTextForQuality_Updater_(title)
  if (!t) return t
  var rawParts = t.split(/\s*(?:\||—|–|-|:)\s*/g).map(function(p) { return String(p || '').trim() }).filter(function(p) { return !!p })
  if (rawParts.length <= 1) return t
  var seen = {}
  var kept = []
  rawParts.forEach(function(p) {
    var k = normalizeForSpecMatch_Updater_(p)
    if (!k) return
    if (seen[k]) return
    seen[k] = true
    kept.push(p)
  })
  return kept.join(' | ').trim()
}

function detectSeoHeadQualityIssues_Updater_(title, desc) {
  var issues = []
  var t = String(title || '').trim()
  var d = String(desc || '').trim()
  if (!t) issues.push('missing_title')
  if (!d) issues.push('missing_description')
  if (/[|—–\-:;,]\s*$/.test(t)) issues.push('title_trailing_separator')
  if (/\s*&\s*[A-Za-zÀ-ÿ]$/.test(t)) issues.push('title_truncated_after_amp')
  if (/\b[A-Za-zÀ-ÿ]{1,3}$/.test(t) && t.length >= 40) issues.push('title_suspicious_tail_fragment')
  var t2 = dedupeSeoTitleSegments_Updater_(t)
  if (t2 && t2 !== t) issues.push('title_duplicate_segments')
  if (/[|—–\-:;,]\s*$/.test(d)) issues.push('description_trailing_separator')
  if (/\b[A-Za-zÀ-ÿ]{1,3}$/.test(d) && d.length >= 120) issues.push('description_suspicious_tail_fragment')
  return issues
}

function getWeakTailTokensForLatin_Updater_() {
  return [
    'a','an','and','or','but','the','of','to','in','on','at','by','for','from','with','without',
    'et','ou','mais','le','la','les','de','des','du','au','aux','en','dans','sur','pour','avec','sans',
    'y','o','pero','el','la','los','las','de','del','al','en','para','con','sin',
    'und','oder','aber','der','die','das','den','dem','des','ein','eine','einem','einen','im','in','am','auf','mit','ohne','für','von','zum','zur',
    '&'
  ]
}

function detectDanglingTailToken_Updater_(text, scriptProfile) {
  var s = String(text || '').replace(/\s+/g, ' ').trim()
  if (!s) return ''
  if (scriptProfile !== 'latin') return ''
  s = s.replace(/[|—–\-:;,]+$/g, '').trim()
  var parts = s.split(' ')
  if (!parts.length) return ''
  var last = String(parts[parts.length - 1] || '').trim()
  if (!last) return ''
  var lower = last.toLowerCase()
  var weak = getWeakTailTokensForLatin_Updater_()
  if (weak.indexOf(lower) !== -1) return lower
  if (lower.length <= 2 && /^[a-z]+$/.test(lower)) return lower
  return ''
}

function stripDanglingTail_Updater_(text, scriptProfile) {
  var s = String(text || '').replace(/\s+/g, ' ').trim()
  if (!s) return s
  if (scriptProfile !== 'latin') return s
  for (var i = 0; i < 3; i++) {
    var tail = detectDanglingTailToken_Updater_(s, scriptProfile)
    if (!tail) break
    s = s.replace(new RegExp('\\s+' + escapeRegex_Updater_(tail) + '\\s*$', 'i'), '').trim()
    s = s.replace(/[|—–\-:;,]+$/g, '').trim()
  }
  return s
}

function finalizePublishText_Updater_(text, maxLen, targetLang, fieldType) {
  var lang = String(targetLang || '').toLowerCase()
  var profile = getScriptProfileForLang_Updater_(lang)
  var s = normalizeSeoHeadTextForQuality_Updater_(String(text || ''))
  if (fieldType === 'title') s = dedupeSeoTitleSegments_Updater_(s)
  s = truncateAtWordBoundary_Updater_(s, maxLen)
  s = stripDanglingTail_Updater_(s, profile)
  s = normalizeSeoHeadTextForQuality_Updater_(s)
  return s
}

function isWeakGeneratedSlug_Updater_(slug) {
  var s = String(slug || '').trim().toLowerCase()
  if (!s) return true
  if (s.length < 14) return true
  if (/^s-/.test(s)) return true
  var parts = s.split('-').filter(function(x) { return !!x })
  if (parts.length < 3) return true
  if (parts.some(function(p) { return p.length <= 1 })) return true
  return false
}

function buildDescriptiveSlugCandidate_Updater_(targetLang, kw, spec) {
  var lang = String(targetLang || '').toLowerCase()
  var s = spec || {}
  var base = String(s.english_slug || '').trim()
  if (base) return base
  var primary = kw && kw.primary ? String(kw.primary).trim() : ''
  var secondary = kw && Array.isArray(kw.secondary) ? kw.secondary.map(function(x) { return String(x || '').trim() }).filter(function(x) { return !!x }) : []
  var pieces = [primary].concat(secondary.slice(0, 2)).filter(function(x) { return !!x })
  if (!pieces.length) pieces = ['tour', lang]
  return pieces.join(' ')
}

function ensureDescriptiveSlugForScript_Updater_(payload, targetLang, kw, spec, slugLocked) {
  if (slugLocked) return payload
  var lang = String(targetLang || '').toLowerCase()
  if (!lang || lang === 'en') return payload
  var profile = getScriptProfileForLang_Updater_(lang)
  if (profile === 'latin') return payload
  var out = payload || {}
  out.core = out.core || {}
  var cur = String(out.core.slug || '').trim()
  if (!isWeakGeneratedSlug_Updater_(cur)) return out
  var candidate = buildDescriptiveSlugCandidate_Updater_(lang, kw, spec)
  var fixed = finalizeTranslatedSlug_Updater_(candidate, { maxLen: 80, spec: spec || {} })
  if (fixed && fixed !== cur) {
    out.core.slug = fixed
    log('SLUG QUALITY UPGRADED (' + lang + '): ' + String(cur || '(empty)') + ' -> ' + fixed)
  }
  return out
}

function evaluatePublishTextQuality_Updater_(text, maxLen, targetLang, fieldType) {
  var lang = String(targetLang || '').toLowerCase()
  var profile = getScriptProfileForLang_Updater_(lang)
  var s = String(text || '').trim()
  var issues = []
  if (!s) issues.push('missing')
  if (/[|—–\-:;,]\s*$/.test(s)) issues.push('trailing_separator')
  if (fieldType === 'title' && /\s*&\s*[A-Za-zÀ-ÿ]$/.test(s)) issues.push('truncated_after_amp')
  var tail = detectDanglingTailToken_Updater_(s, profile)
  if (tail) issues.push('dangling_tail:' + tail)
  if (maxLen && s.length > maxLen + 5) issues.push('too_long')
  return { ok: issues.length === 0, issues: issues }
}

function decideQualityAction_Updater_(qa, allowRegenerate) {
  var issues = (qa && qa.issues) ? qa.issues : []
  var hard = issues.some(function(x) { return String(x).indexOf('missing') === 0 })
  if (hard && allowRegenerate) return 'regenerate'
  var dangling = issues.some(function(x) { return String(x).indexOf('dangling_tail:') === 0 })
  if (dangling && allowRegenerate) return 'regenerate'
  if (issues.length) return 'accept_with_warning'
  return 'accept'
}

async function regenerateSeoHeadFieldsForQuality_Updater_(lang, englishMeta, currentMeta, kw, spec) {
  var l = String(lang || '').toLowerCase()
  var en = englishMeta || {}
  var cur = currentMeta || {}
  var primary = kw && kw.primary ? String(kw.primary).trim() : ''
  var fam = spec && spec.landmark_canonical_museum_family ? String(spec.landmark_canonical_museum_family).toLowerCase() : ''
  var mustMention = ''
  if (fam === 'civilization') {
    mustMention =
      localizeForbiddenEnglishPhraseForLang_Updater_('national museum of egyptian civilization', l) ||
      localizeForbiddenEnglishPhraseForLang_Updater_('civilization museum', l) ||
      'National Museum of Egyptian Civilization'
  }

  var prompt =
    "You are a native-level travel SEO localization editor.\n" +
    "Rewrite ONLY the SEO title and meta description in " + l.toUpperCase() + " for quality.\n" +
    "CRITICAL RULES:\n" +
    "- Output ONLY " + l + ". No English leakage. No mixed-language phrases.\n" +
    "- Do NOT duplicate landmark phrases.\n" +
    "- Avoid malformed separators (| — – -) and do not end with separators.\n" +
    "- Do NOT truncate mid-word. Keep whole words.\n" +
    "- Keep the title <= 65 characters if possible.\n" +
    "- Keep the meta description coherent and <= 160 characters if possible.\n" +
    (primary ? ("- Use the primary keyword naturally if it fits: " + primary + "\n") : "") +
    (mustMention ? ("- Ensure the canonical museum entity is unmistakable in title or description: " + mustMention + "\n") : "") +
    "- Preserve meaning and key entities from the English reference.\n" +
    "- Return ONLY valid JSON.\n\n" +
    "INPUT JSON:\n" + JSON.stringify({
      english_title: String(en.title || ''),
      english_meta_desc: String(en.description || ''),
      current_title: String(cur.title || ''),
      current_meta_desc: String(cur.description || '')
    }) + "\n\n" +
    "OUTPUT JSON:\n" + "{\"title\":\"...\",\"description\":\"...\"}"

  var out = await callAiForTargetLangWithRetry_Updater_(prompt, l)
  if (!out || typeof out !== 'object') return null
  return { title: String(out.title || '').trim(), description: String(out.description || '').trim() }
}

async function hardenTranslatedSeoHeadFieldsQuality_Updater_(payload, targetLang, kw, spec, englishPayload) {
  var lang = String(targetLang || '').toLowerCase()
  if (!lang || lang === 'en') return payload
  var out = payload || {}
  out.meta = out.meta || {}

  out.meta.rank_math_title = finalizePublishText_Updater_(out.meta.rank_math_title, 65, lang, 'title')
  out.meta.rank_math_description = finalizePublishText_Updater_(out.meta.rank_math_description, 160, lang, 'description')

  var qaTitle = evaluatePublishTextQuality_Updater_(out.meta.rank_math_title, 65, lang, 'title')
  var qaDesc = evaluatePublishTextQuality_Updater_(out.meta.rank_math_description, 160, lang, 'description')
  var allowRegenerate = true
  var action = decideQualityAction_Updater_({ issues: qaTitle.issues.concat(qaDesc.issues) }, allowRegenerate)

  if (action === 'regenerate') {
    log('SEO FINALIZATION DECISION (' + lang + '): action=regenerate issues=' + JSON.stringify(qaTitle.issues.concat(qaDesc.issues)))
    var enMeta = englishPayload && englishPayload.meta ? englishPayload.meta : {}
    var regen = await regenerateSeoHeadFieldsForQuality_Updater_(
      lang,
      { title: enMeta.rank_math_title || '', description: enMeta.rank_math_description || '' },
      { title: out.meta.rank_math_title || '', description: out.meta.rank_math_description || '' },
      kw,
      spec
    )
    if (regen && regen.title && regen.description) {
      out.meta.rank_math_title = finalizePublishText_Updater_(regen.title, 65, lang, 'title')
      out.meta.rank_math_description = finalizePublishText_Updater_(regen.description, 160, lang, 'description')
      var qaTitle2 = evaluatePublishTextQuality_Updater_(out.meta.rank_math_title, 65, lang, 'title')
      var qaDesc2 = evaluatePublishTextQuality_Updater_(out.meta.rank_math_description, 160, lang, 'description')
      var issues2 = qaTitle2.issues.concat(qaDesc2.issues)
      if (!issues2.length) log('SEO HEAD REGENERATION RETRY SUCCEEDED (' + lang + ')')
      else log('SEO HEAD QUALITY STILL IMPERFECT AFTER RETRY (' + lang + '): ' + JSON.stringify(issues2))
    } else {
      log('SEO HEAD REGENERATION RETRY FAILED (' + lang + ')')
    }
  } else if (action === 'accept_with_warning') {
    log('SEO FINALIZATION DECISION (' + lang + '): action=accept_with_warning issues=' + JSON.stringify(qaTitle.issues.concat(qaDesc.issues)))
  }

  if (out.meta.rank_math_title) {
    out.meta.rank_math_facebook_title = out.meta.rank_math_title
    out.meta.rank_math_twitter_title = out.meta.rank_math_title
  }
  if (out.meta.rank_math_description) {
    out.meta.rank_math_facebook_description = out.meta.rank_math_description
    out.meta.rank_math_twitter_description = out.meta.rank_math_description
  }

  return out
}

async function enforceSeoKeywordsOnPayload_Updater_(payload, translatedData, targetLang, kw, opts) {
  opts = opts || {}
  var slugLocked = !!opts.slugLocked
  var out = payload || {}
  out.meta = out.meta || {}
  out.core = out.core || {}

  var assets = (opts && opts.assets) ? opts.assets : (await generateLocalizedSEOAssets_Updater_(translatedData, targetLang, kw, opts.spec, opts.seoOpts) || {})
  assets.primary_keyword = kw && kw.primary ? String(kw.primary).trim() : String(assets.primary_keyword || '').trim()

  var focusParts = []
  if (kw && kw.primary) focusParts.push(String(kw.primary).trim())
  if (kw && kw.secondary && kw.secondary.length) {
    kw.secondary.forEach(function (x) {
      var s = String(x || '').trim()
      if (s) focusParts.push(s)
    })
  }
  if (focusParts.length) out.meta.rank_math_focus_keyword = focusParts.join(', ')

  if (assets.title) out.meta.rank_math_title = String(assets.title).trim()
  if (assets.description) out.meta.rank_math_description = String(assets.description).trim()

  if (assets.image_alt) out.meta.localized_image_alt = String(assets.image_alt).trim()
  if (assets.h2_heading) assets.h2_heading = String(assets.h2_heading).trim()
  if (kw && kw.primary) {
    if (!assets.h2_heading || !containsKeyword_Updater_(assets.h2_heading, kw.primary)) assets.h2_heading = kw.primary
    if (out.meta.localized_image_alt && !containsKeyword_Updater_(out.meta.localized_image_alt, kw.primary)) {
      out.meta.localized_image_alt = (kw.primary + ' - ' + out.meta.localized_image_alt).trim()
    }
    if (out.meta.rank_math_title && !containsKeyword_Updater_(out.meta.rank_math_title, kw.primary)) {
      var candidateTitle = (kw.primary + ' | ' + out.meta.rank_math_title).trim()
      out.meta.rank_math_title = normalizeSeoHeadTextForQuality_Updater_(truncateAtWordBoundary_Updater_(candidateTitle, 65))
    } else {
      out.meta.rank_math_title = normalizeSeoHeadTextForQuality_Updater_(truncateAtWordBoundary_Updater_(out.meta.rank_math_title, 65))
    }
    if (out.meta.rank_math_description && !containsKeyword_Updater_(out.meta.rank_math_description, kw.primary)) {
      out.meta.rank_math_description = (kw.primary + ' - ' + out.meta.rank_math_description).trim()
      out.meta.rank_math_description = normalizeSeoHeadTextForQuality_Updater_(truncateAtWordBoundary_Updater_(out.meta.rank_math_description, 160))
    } else {
      out.meta.rank_math_description = normalizeSeoHeadTextForQuality_Updater_(truncateAtWordBoundary_Updater_(out.meta.rank_math_description, 160))
    }
  }

  if (!slugLocked) {
    var slug = ''
    if (assets.slug) slug = finalizeTranslatedSlug_Updater_(assets.slug, { maxLen: 80, spec: opts && opts.spec ? opts.spec : null })
    if (!slug && translatedData && translatedData.general && translatedData.general.AI_SEO_Permalink) {
      slug = finalizeTranslatedSlug_Updater_(translatedData.general.AI_SEO_Permalink, { maxLen: 80, spec: opts && opts.spec ? opts.spec : null })
    }
    if (!slug && out.core && out.core.slug) slug = finalizeTranslatedSlug_Updater_(out.core.slug, { maxLen: 80, spec: opts && opts.spec ? opts.spec : null })
    if (!slug && out.core && out.core.title) slug = finalizeTranslatedSlug_Updater_(out.core.title, { maxLen: 80, spec: opts && opts.spec ? opts.spec : null })
    if (!slug && kw && kw.primary) slug = buildShortSlugFromPrimaryKeyword_Updater_(kw.primary)
    if (slug) out.core.slug = slug
  }

  var wte = out.meta.wp_travel_engine_setting
  if (wte && wte.tab_content && wte.tab_content['1_wpeditor']) {
    wte.tab_content['1_wpeditor'] = applySeoEnhancementsToOverviewHtml_Updater_(wte.tab_content['1_wpeditor'], assets, targetLang)
    out.core.content = wte.tab_content['1_wpeditor']
    out.content = wte.tab_content['1_wpeditor']
  }

  if (kw && kw.primary) {
    var html = String(out.core.content || out.content || '')
    if (html) {
      var re = new RegExp('<h2[^>]*>[^<]*' + escapeRegex_Updater_(kw.primary) + '[^<]*<\\/h2>', 'i')
      if (!re.test(html)) {
        html = '<h2>' + String(assets.h2_heading || kw.primary) + '</h2>' + html
        out.core.content = html
        out.content = html
        var wte2 = out.meta && out.meta.wp_travel_engine_setting
        if (wte2 && wte2.tab_content && wte2.tab_content['1_wpeditor']) wte2.tab_content['1_wpeditor'] = html
      }
    }
  }

  return { payload: out, assets: assets }
}

function validateKeywordEnforcement_Updater_(payload, targetLang, kw, assets) {
  var out = { ok: true, reasons: [] }
  var p = payload || {}
  var meta = p.meta || {}
  var core = p.core || {}
  var primary = kw && kw.primary ? String(kw.primary).trim() : ''
  if (!primary) return { ok: false, reasons: ['missing_primary_keyword'] }

  if (!containsKeyword_Updater_(meta.rank_math_title, primary)) out.reasons.push('primary_missing_in_seo_title')
  if (!containsKeyword_Updater_(meta.rank_math_description, primary)) out.reasons.push('primary_missing_in_meta_description')
  if (!containsKeyword_Updater_(meta.localized_image_alt, primary)) out.reasons.push('primary_missing_in_featured_image_alt')

  var slug = String(core.slug || '').trim()
  var primarySlug = buildShortSlugFromPrimaryKeyword_Updater_(primary)
  if (!slug) out.reasons.push('primary_missing_in_slug')
  else if (primarySlug && slug.indexOf(primarySlug) === -1) out.reasons.push('primary_missing_in_slug')

  var html = String(core.content || p.content || '').trim()
  if (!html) {
    out.reasons.push('primary_missing_in_h2')
  } else {
    var re = new RegExp('<h2[^>]*>[^<]*' + escapeRegex_Updater_(primary) + '[^<]*<\\/h2>', 'i')
    if (!re.test(html)) out.reasons.push('primary_missing_in_h2')
  }

  out.ok = out.reasons.length === 0
  return out
}

function validatePrimaryKeywordInSeo_Updater_(payload, primaryKeyword) {
  var p = payload || {};
  var meta = p.meta || {};
  var core = p.core || {};
  var primary = String(primaryKeyword || '').trim();
  if (!primary) return { ok: false, reasons: ['missing_primary_keyword'] };
  var reasons = [];
  if (!containsKeyword_Updater_(meta.rank_math_title, primary)) reasons.push('primary_missing_in_seo_title');
  if (!containsKeyword_Updater_(meta.rank_math_description, primary)) reasons.push('primary_missing_in_meta_description');
  if (!containsKeyword_Updater_(meta.localized_image_alt, primary)) reasons.push('primary_missing_in_featured_image_alt');
  var slug = String(core.slug || '').trim();
  var wanted = buildShortSlugFromPrimaryKeyword_Updater_(primary);
  if (!slug) reasons.push('primary_missing_in_slug');
  else if (wanted && slug.indexOf(wanted) === -1) reasons.push('primary_missing_in_slug');
  var html = String(core.content || p.content || '').trim();
  if (!html) reasons.push('primary_missing_in_h2');
  else {
    var re = new RegExp('<h2[^>]*>[^<]*' + escapeRegex_Updater_(primary) + '[^<]*<\\/h2>', 'i');
    if (!re.test(html)) reasons.push('primary_missing_in_h2');
  }
  return { ok: reasons.length === 0, reasons: reasons };
}

function removeStandaloneKeywordParagraphs_Updater_(html, primaryKeyword, targetLang) {
  var kw = String(primaryKeyword || '').trim()
  if (!kw) return String(html || '')
  var s = String(html || '')
  if (!s) return s

  var before = s
  var esc = escapeRegex_Updater_(kw)
  var reP = new RegExp('<p[^>]*>\\s*(?:<strong[^>]*>\\s*)?' + esc + '\\s*(?:<\\/strong>\\s*)?<\\/p>\\s*', 'ig')
  s = s.replace(reP, '')
  s = s.replace(/^\s+/, '')

  var reH2Exact = new RegExp('^\\s*<h2[^>]*>\\s*' + esc + '\\s*<\\/h2>\\s*', 'i')
  if (reH2Exact.test(s)) {
    s = s.replace(reH2Exact, '')
    log('RAW KEYWORD PARAGRAPH REMOVED (' + String(targetLang || '').toLowerCase() + ')')
  }

  if (s !== before) {
    log('PRIMARY KEYWORD INTEGRATED NATURALLY (' + String(targetLang || '').toLowerCase() + ')')
  }
  return s
}

function enforceCanonicalMuseumFamilyFidelityInPayload_Updater_(payload, targetLang, spec) {
  var lang = String(targetLang || '').toLowerCase()
  if (!lang || lang === 'en') return payload
  var s = spec || {}
  var fam = s.landmark_canonical_museum_family ? String(s.landmark_canonical_museum_family).toLowerCase() : ''
  if (fam !== 'civilization') return payload
  var out = payload || {}
  out.core = out.core || {}
  out.meta = out.meta || {}

  var civ = localizeForbiddenEnglishPhraseForLang_Updater_('civilization museum', lang)
  var egypt = localizeForbiddenEnglishPhraseForLang_Updater_('egyptian museum', lang)
  if (!civ) return out

  function fixText_(txt) {
    var t = String(txt || '').trim()
    if (!t) return t
    if (lang === 'de') {
      if (/(?:ägyptisch|aegyptisch)\w*\s+museum/i.test(t)) {
        t = t.replace(/(?:ägyptisch|aegyptisch)\w*\s+museum/ig, civ).trim()
        log('LANDMARK FIDELITY FIXED IN FIELD (de): aegyptisch* museum -> civilization_museum')
        return t
      }
    }
    var norm = normalizeForSpecMatch_Updater_(t)
    var markers = getCivilizationMuseumMarkersForLang_Updater_(lang).concat([civ, 'NMEC'])
    var hasCiv = textContainsAnyMarker_Updater_(t, markers)
    if (hasCiv) return t
    if (egypt) {
      var eNorm = normalizeForSpecMatch_Updater_(egypt)
      if (eNorm && norm.indexOf(eNorm) !== -1) {
        t = t.replace(new RegExp(escapeRegex_Updater_(egypt), 'ig'), civ).trim()
        log('LANDMARK FIDELITY FIXED IN FIELD (' + lang + '): egyptian_museum -> civilization_museum')
        return t
      }
    }
    if (norm.indexOf('egyptian museum') !== -1) {
      t = t.replace(/egyptian\s+museum/ig, civ).trim()
      log('LANDMARK FIDELITY FIXED IN FIELD (' + lang + '): English egyptian museum -> civilization_museum')
      return t
    }
    if (t.length < 70) {
      var civPhrase = (lang === 'fr') ? 'Musée national de la civilisation égyptienne (NMEC)' : ((lang === 'de') ? 'Nationalmuseum der ägyptischen Zivilisation (NMEC)' : civ)
      t = (t + ' – ' + civPhrase).trim()
      log('LANDMARK FIDELITY APPENDED (' + lang + '): civilization_museum')
    }
    return t
  }

  out.core.title = fixText_(out.core.title)
  out.meta.rank_math_title = fixText_(out.meta.rank_math_title)
  out.meta.rank_math_description = fixText_(out.meta.rank_math_description)
  if (out.meta && out.meta.localized_image_alt) out.meta.localized_image_alt = fixText_(out.meta.localized_image_alt)
  return out
}

function harmonizeBodyHeadingWithCanonicalLandmark_Updater_(html, targetLang, spec, payload) {
  var lang = String(targetLang || '').toLowerCase()
  var fam = spec && spec.landmark_canonical_museum_family ? String(spec.landmark_canonical_museum_family).toLowerCase() : ''
  if (fam !== 'civilization') return String(html || '')
  var civ = localizeForbiddenEnglishPhraseForLang_Updater_('civilization museum', lang)
  if (!civ) return String(html || '')

  var out = String(html || '')
  if (!out) return out

  var egypt = localizeForbiddenEnglishPhraseForLang_Updater_('egyptian museum', lang)
  if (!egypt) egypt = 'egyptian museum'

  var firstH2 = out.match(/<h2[^>]*>[\s\S]*?<\/h2>/i)
  if (firstH2 && firstH2[0]) {
    var h2 = firstH2[0]
    var h2Norm = normalizeForSpecMatch_Updater_(h2)
    if (normalizeForSpecMatch_Updater_(civ) && h2Norm.indexOf(normalizeForSpecMatch_Updater_(civ)) === -1) {
      var eNorm = normalizeForSpecMatch_Updater_(egypt)
      if (eNorm && h2Norm.indexOf(eNorm) !== -1) {
        var replaced = h2.replace(new RegExp(escapeRegex_Updater_(egypt), 'ig'), civ)
        if (replaced !== h2) {
          out = out.replace(h2, replaced)
          log('BODY HEADING HARMONIZED WITH MAIN TITLE LANDMARK (' + lang + ')')
          log('LANDMARK FIDELITY PROPAGATED TO CONTENT INTRO (' + lang + ')')
          return out
        }
      }
    }
  }

  var snippet = out.substring(0, 800)
  var sn = normalizeForSpecMatch_Updater_(snippet)
  if (normalizeForSpecMatch_Updater_(civ) && sn.indexOf(normalizeForSpecMatch_Updater_(civ)) === -1) {
    var eNorm2 = normalizeForSpecMatch_Updater_(egypt)
    if (eNorm2 && sn.indexOf(eNorm2) !== -1) {
      var out2 = out.replace(new RegExp(escapeRegex_Updater_(egypt), 'ig'), civ)
      if (out2 !== out) {
        log('LANDMARK FIDELITY PROPAGATED TO CONTENT INTRO (' + lang + ')')
        return out2
      }
    }
  }

  return out
}

function forcePrimaryKeywordFallbackOnSeo_Updater_(payload, primaryKeyword, englishPayload, slugLocked) {
  var out = payload || {};
  out.meta = out.meta || {};
  out.core = out.core || {};
  var primary = String(primaryKeyword || '').trim();
  if (!primary) return out;

  var enMeta = englishPayload && englishPayload.meta ? englishPayload.meta : {};
  var enCore = englishPayload && englishPayload.core ? englishPayload.core : {};

  var title = String(out.meta.rank_math_title || '').trim();
  if (!title) title = String(enMeta.rank_math_title || enCore.title || '').trim();
  if (!title) title = String(out.core.title || '').trim();
  if (!title) title = primary;
  if (!containsKeyword_Updater_(title, primary)) title = (primary + ' | ' + title).trim();
  title = truncateAtWordBoundary_Updater_(normalizeSeoHeadTextForQuality_Updater_(title), 65)
  out.meta.rank_math_title = title;

  var desc = String(out.meta.rank_math_description || '').trim();
  if (!desc) desc = String(enMeta.rank_math_description || '').trim();
  if (!desc) desc = primary;
  if (!containsKeyword_Updater_(desc, primary)) desc = (primary + ' - ' + desc).trim();
  desc = truncateAtWordBoundary_Updater_(normalizeSeoHeadTextForQuality_Updater_(desc), 160)
  out.meta.rank_math_description = desc;

  if (!slugLocked) {
    var slug = String(out.core.slug || '').trim();
    var wanted = buildShortSlugFromPrimaryKeyword_Updater_(primary);
    if (!slug) slug = wanted;
    if (wanted && slug.indexOf(wanted) === -1) slug = wanted;
    if (slug) out.core.slug = slug;
  }

  var alt = String(out.meta.localized_image_alt || '').trim();
  if (!alt) alt = primary;
  if (!containsKeyword_Updater_(alt, primary)) alt = (primary + ' - ' + alt).trim();
  out.meta.localized_image_alt = alt;

  var html = String(out.core.content || out.content || '').trim();
  if (html) {
    var reH2 = new RegExp('<h2[^>]*>[^<]*' + escapeRegex_Updater_(primary) + '[^<]*<\\/h2>', 'i');
    if (!reH2.test(html)) {
      var baseTitle = String(out.core.title || out.meta.rank_math_title || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      var h2Text = '';
      if (baseTitle) {
        if (containsKeyword_Updater_(baseTitle, primary)) h2Text = baseTitle;
        else h2Text = (primary + ' — ' + baseTitle).trim();
      } else {
        h2Text = primary;
      }
      if (h2Text.length > 110) h2Text = h2Text.substring(0, 110).trim();
      html = '<h2>' + h2Text + '</h2>' + html;
      out.core.content = html;
      out.content = html;
      var wte = out.meta && out.meta.wp_travel_engine_setting;
      if (wte && wte.tab_content && wte.tab_content['1_wpeditor']) wte.tab_content['1_wpeditor'] = html;
    }
  }

  return out;
}

// ----------------------------------------------------------
// EXTENDED PUBLISHING: PACKAGES & IMAGES
// ----------------------------------------------------------

async function publishPackagesSafe_Updater_(tripId, wpTripId, opts) {
   opts = opts || {};
   var targetLang = opts.lang ? String(opts.lang) : '';
   var skipAirtableSync = !!opts.skipAirtableSync;
   var tripTitleForPackage = opts.tripTitle ? String(opts.tripTitle) : '';
   try {
     // 1. Fetch Packages & Prices from Airtable
     // Using findRecordsByLinkedId_ for reliable client-side filtering (ignores formula pitfalls)
     var pkgRecords = await findRecordsByLinkedId_Updater_('Packages', 'Trip', tripId);
     var priceRecords = await findRecordsByLinkedId_Updater_('Prices', 'Trip', tripId);

     var pkgState = getLookupState_Updater_('Packages', 'Trip', tripId, 'multi');
     var priceState = getLookupState_Updater_('Prices', 'Trip', tripId, 'multi');

     if (isLookupStateIncomplete_Updater_(pkgState) || isLookupStateIncomplete_Updater_(priceState)) {
       throw new Error(
         'Updater: Package publish aborted for Trip ' + tripId +
         ' because Airtable package/price dataset is incomplete. ' +
         'Packages[' + describeLookupState_Updater_(pkgState) + '] ' +
         'Prices[' + describeLookupState_Updater_(priceState) + ']'
       );
     }
     
     if (pkgRecords.length === 0 && priceRecords.length === 0) {
       log('Updater: No packages or prices found for Trip ' + tripId);
       return;
     }

     log('Updater: Found ' + pkgRecords.length + ' packages and ' + priceRecords.length + ' prices for Trip ' + tripId);

     // Map Price records by PackageID
     var pricesByPkgId = {}; 
     var defaultPrices = []; 
    
    priceRecords.forEach(function(r) {
       var f = r.fields;
       var pidRaw = f.PackageID;
       // Handle Airtable Linked Record array format
       var pid = (Array.isArray(pidRaw) && pidRaw.length > 0) ? pidRaw[0] : pidRaw;
       if (pid) pid = String(pid).trim(); // Normalize ID

       if (pid) {
          if (!pricesByPkgId[pid]) pricesByPkgId[pid] = [];
          pricesByPkgId[pid].push(r); // Store FULL record, not just fields
       } else {
          defaultPrices.push(r); // Store FULL record
       }
    });

    var generatedPackageIds = [];
    
    // Map of known Category Labels to IDs (User Provided)
    var CATEGORY_ID_MAP = {
      'Adult': 11,
      'Child': 12,
      'Children': 330,
      'Infant': 87,
      'Passengers': 88,
      'Student (with ID)': 264
    };

    function localizePackageLabel_(label, lang) {
      var l = String(label || '').trim();
      var c = String(lang || '').toLowerCase();
      if (!l || !c || c === 'en') return l;

      var translations = {
        'fr': {
          'Adult': 'Adulte',
          'Child': 'Enfant',
          'Children': 'Enfants',
          'Infant': 'Bébé',
          'Passengers': 'Passagers',
          'Student (with ID)': "Étudiant (avec pièce d'identité)",
          'Standard Package': 'Forfait standard',
          'Standard': 'Forfait standard',
          'traveler': 'voyageur',
          'travelers': 'voyageurs',
          'Traveler': 'Voyageur',
          'Travelers': 'Voyageurs'
        },
        'de': {
          'Adult': 'Erwachsene',
          'Child': 'Kinder',
          'Children': 'Kinder',
          'Infant': 'Kleinkind',
          'Passengers': 'Passagiere',
          'Student (with ID)': 'Student (mit Ausweis)',
          'Standard Package': 'Standardpaket',
          'Standard': 'Standardpaket',
          'traveler': 'Reisender',
          'travelers': 'Reisende',
          'Traveler': 'Reisender',
          'Travelers': 'Reisende'
        },
        'es': {
          'Adult': 'Adulto',
          'Child': 'Niño',
          'Children': 'Niños',
          'Infant': 'Bebé',
          'Passengers': 'Pasajeros',
          'Student (with ID)': 'Estudiante (con identificación)',
          'Standard Package': 'Paquete estándar',
          'Standard': 'Paquete estándar',
          'traveler': 'viajero',
          'travelers': 'viajeros',
          'Traveler': 'Viajero',
          'Travelers': 'Viajeros'
        },
        'tr': {
          'Adult': 'Yetişkin',
          'Child': 'Çocuk',
          'Children': 'Çocuklar',
          'Infant': 'Bebek',
          'Passengers': 'Yolcular',
          'Student (with ID)': 'Öğrenci (kimlik ile)',
          'Standard Package': 'Standart paket',
          'Standard': 'Standart paket',
          'traveler': 'Gezgin',
          'travelers': 'Gezginler',
          'Traveler': 'Gezgin',
          'Travelers': 'Gezginler'
        },
        'ru': {
          'Adult': 'Взрослый',
          'Child': 'Ребенок',
          'Children': 'Дети',
          'Infant': 'Младенец',
          'Passengers': 'Пассажиры',
          'Student (with ID)': 'Студент (с удостоверением)',
          'Standard Package': 'Стандартный пакет',
          'Standard': 'Стандартный пакет',
          'traveler': 'путешественник',
          'travelers': 'путешественники',
          'Traveler': 'Путешественник',
          'Travelers': 'Путешественники'
        },
        'ro': {
          'Adult': 'Adult',
          'Child': 'Copil',
          'Children': 'Copii',
          'Infant': 'Bebeluș',
          'Passengers': 'Pasageri',
          'Student (with ID)': 'Student (cu act de identitate)',
          'Standard Package': 'Pachet standard',
          'Standard': 'Pachet standard',
          'traveler': 'călător',
          'travelers': 'călători',
          'Traveler': 'Călător',
          'Travelers': 'Călători'
        },
        'zh-hans': {
          'Adult': '成人',
          'Child': '儿童',
          'Children': '儿童',
          'Infant': '婴儿',
          'Passengers': '乘客',
          'Student (with ID)': '学生（持证件）',
          'Standard Package': '标准套餐',
          'Standard': '标准套餐',
          'traveler': '旅客',
          'travelers': '旅客',
          'Traveler': '旅客',
          'Travelers': '旅客'
        },
        'uk': {
          'Adult': 'Дорослий',
          'Child': 'Дитина',
          'Children': 'Діти',
          'Infant': 'Немовля',
          'Passengers': 'Пасажири',
          'Student (with ID)': 'Студент (з посвідченням)',
          'Standard Package': 'Стандартний пакет',
          'Standard': 'Стандартний пакет',
          'traveler': 'мандрівник',
          'travelers': 'мандрівники',
          'Traveler': 'Мандрівник',
          'Travelers': 'Мандрівники'
        },
        'pt-br': {
          'Adult': 'Adulto',
          'Child': 'Criança',
          'Children': 'Crianças',
          'Infant': 'Bebê',
          'Passengers': 'Passageiros',
          'Student (with ID)': 'Estudante (com documento)',
          'Standard Package': 'Pacote padrão',
          'Standard': 'Pacote padrão',
          'traveler': 'viajante',
          'travelers': 'viajantes',
          'Traveler': 'Viajante',
          'Travelers': 'Viajantes'
        },
        'pl': {
          'Adult': 'Dorosły',
          'Child': 'Dziecko',
          'Children': 'Dzieci',
          'Infant': 'Niemowlę',
          'Passengers': 'Pasażerowie',
          'Student (with ID)': 'Student (z legitymacją)',
          'Standard Package': 'Pakiet standardowy',
          'Standard': 'Pakiet standardowy',
          'traveler': 'podróżnik',
          'travelers': 'podróżnicy',
          'Traveler': 'Podróżnik',
          'Travelers': 'Podróżnicy'
        },
        'nl': {
          'Adult': 'Volwassene',
          'Child': 'Kind',
          'Children': 'Kinderen',
          'Infant': 'Baby',
          'Passengers': 'Passagiers',
          'Student (with ID)': 'Student (met ID)',
          'Standard Package': 'Standaardpakket',
          'Standard': 'Standaardpakket',
          'traveler': 'reiziger',
          'travelers': 'reizigers',
          'Traveler': 'Reiziger',
          'Travelers': 'Reizigers'
        },
        'ko': {
          'Adult': '성인',
          'Child': '어린이',
          'Children': '어린이',
          'Infant': '유아',
          'Passengers': '승객',
          'Student (with ID)': '학생(신분증 지참)',
          'Standard Package': '기본 패키지',
          'Standard': '기본 패키지',
          'traveler': '여행자',
          'travelers': '여행자들',
          'Traveler': '여행자',
          'Travelers': '여행자들'
        },
        'ja': {
          'Adult': '大人',
          'Child': '子供',
          'Children': '子供',
          'Infant': '幼児',
          'Passengers': '乗客',
          'Student (with ID)': '学生（身分証明書提示）',
          'Standard Package': '標準パッケージ',
          'Standard': '標準パッケージ',
          'traveler': '旅行者',
          'travelers': '旅行者',
          'Traveler': '旅行者',
          'Travelers': '旅行者'
        },
        'it': {
          'Adult': 'Adulto',
          'Child': 'Bambino',
          'Children': 'Bambini',
          'Infant': 'Neonato',
          'Passengers': 'Passeggeri',
          'Student (with ID)': 'Studente (con documento)',
          'Standard Package': 'Pacchetto standard',
          'Standard': 'Pacchetto standard',
          'traveler': 'viaggiatore',
          'travelers': 'viaggiatori',
          'Traveler': 'Viaggiatore',
          'Travelers': 'Viaggiatori'
        },
        'hu': {
          'Adult': 'Felnőtt',
          'Child': 'Gyermek',
          'Children': 'Gyermekek',
          'Infant': 'Csecsemő',
          'Passengers': 'Utasok',
          'Student (with ID)': 'Diák (igazolvánnyal)',
          'Standard Package': 'Standard csomag',
          'Standard': 'Standard csomag',
          'traveler': 'utazó',
          'travelers': 'utazók',
          'Traveler': 'Utazó',
          'Travelers': 'Utazók'
        },
        'cs': {
          'Adult': 'Dospělý',
          'Child': 'Dítě',
          'Children': 'Děti',
          'Infant': 'Kojenec',
          'Passengers': 'Cestující',
          'Student (with ID)': 'Student (s průkazem)',
          'Standard Package': 'Standardní balíček',
          'Standard': 'Standardní balíček',
          'traveler': 'cestovatel',
          'travelers': 'cestovatelé',
          'Traveler': 'Cestovatel',
          'Travelers': 'Cestovatelé'
        }
      };

      var langMap = translations[c];
      if (langMap && langMap[l]) return langMap[l];
      return l;
    }

    function processPackage(pkgFields, linkedPrices) {
       var payload = {
         trip_id: wpTripId,
         title: (tripTitleForPackage && targetLang && targetLang !== 'en') ? tripTitleForPackage : (pkgFields.PackageTitle || ("Package for Trip " + wpTripId)),
         status: 'publish', 
         pricing_categories: [] 
       };

       var excerpt = (pkgFields && (pkgFields.excerpt || pkgFields.Excerpt || pkgFields.EXCERPT));
       var contentHtml = (pkgFields && (pkgFields.content_html || pkgFields.Content_HTML || pkgFields.CONTENT_HTML || pkgFields.Content_html));
       if (excerpt !== undefined && excerpt !== null) {
         var ex = String(excerpt).replace(/\s+/g, ' ').trim();
         if (ex) payload.excerpt = ex;
       }
       if (contentHtml !== undefined && contentHtml !== null) {
         var ch = String(contentHtml).trim();
         if (ch) payload.content_html = ch;
       }
       
       if (linkedPrices && linkedPrices.length > 0) {
          linkedPrices.forEach(function(prRecord) {
             var pr = prRecord.fields; // Access fields here
             
             // Normalize Pricing Type
             var pType = 'per-person'; // Fix: WTE expects 'per-person'
             if (pr.PricingType) {
                var rawType = String(pr.PricingType).toLowerCase();
                if (rawType.indexOf('group') !== -1) pType = 'per-group';
             }
             
             var catLabel = pr.Label || pr.Title || 'Standard';
             var catLabelDisplay = localizePackageLabel_(catLabel, targetLang);
             var cat = {
                label: catLabelDisplay,
                regular_price: (Number(pr.RegularPrice) || 0) === 0 ? "" : Number(pr.RegularPrice),
                sale_price: (Number(pr.SalePrice) || 0) === 0 ? "" : Number(pr.SalePrice),
                min_pax: (pr.MinPax !== undefined && pr.MinPax !== null && pr.MinPax !== "") ? Number(pr.MinPax) : 1,
                max_pax: Number(pr.MaxPax) || 100,
                pricing_type: pType
             };
             
             // Inject ID if mapped
             if (CATEGORY_ID_MAP[catLabel]) {
                cat.id = CATEGORY_ID_MAP[catLabel];
             }
             
             if (pr.GroupPricing) {
                try { 
                   var gpData = JSON.parse(pr.GroupPricing);
                   if (Array.isArray(gpData) && gpData.length > 0) {
                      // Check for dummy group pricing (price 0) when regular price is set
                      var gpPrice = gpData[0].price;
                      var gpPriceNum = Number(gpPrice);
                      
                      // DEBUG: Log to diagnose why dummy check might fail
                      logVerbose_Updater_('Updater CHECK: ' + cat.label + ' | GP Len:' + gpData.length + ' | Price:' + gpPrice + ' | Reg:' + cat.regular_price + ' | Sale:' + cat.sale_price);

                      // Robust check: include loose equality for '0' string
                      // If either regular_price or sale_price is set, we consider this a priced package and skip dummy (0) group pricing.
                      var isDummy = (gpData.length === 1 && (cat.regular_price > 0 || cat.sale_price > 0) && (gpPrice == 0 || gpPriceNum === 0 || isNaN(gpPriceNum)));
                      
                      if (!isDummy) {
                         cat.group_pricing = gpData;
                      } else {
                         log('Updater: Skipping dummy group pricing for ' + cat.label + ' (Regular: ' + cat.regular_price + ')');
                      }
                   }
                } catch(e) {}
             }
             // Skip category if price is 0 (and no valid group pricing)
             var hasPrice = (cat.regular_price > 0 || cat.sale_price > 0);
             var hasValidGroupPrice = false;
             
             if (cat.group_pricing && Array.isArray(cat.group_pricing) && cat.group_pricing.length > 0) {
                 // Check if any group pricing entry has a price > 0
                 hasValidGroupPrice = cat.group_pricing.some(function(gp) {
                     var p = Number(gp.price);
                     return !isNaN(p) && p > 0;
                 });
             }
             
             if (hasPrice || hasValidGroupPrice) {
                payload.pricing_categories.push(cat);
             } else {
                log('Updater: Skipping category ' + cat.label + ' because price is 0 and no valid group pricing');
             }
          });
       } else {
          var mainCat = {
             label: localizePackageLabel_(pkgFields.PackageTitle || 'Standard Package', targetLang),
             regular_price: Number(pkgFields.RegularPrice) || 0,
             sale_price: Number(pkgFields.SalePrice) || 0,
             min_pax: (pkgFields.MinPax !== undefined && pkgFields.MinPax !== null && pkgFields.MinPax !== "") ? Number(pkgFields.MinPax) : 1,
             max_pax: Number(pkgFields.MaxPax) || 100,
             pricing_type: 'per-person' 
          };
          if (pkgFields.GroupPricing) {
             try { 
                var gpData = JSON.parse(pkgFields.GroupPricing);
                if (Array.isArray(gpData) && gpData.length > 0) {
                   // Check for dummy group pricing
                   var gpPrice = gpData[0].price;
                   var gpPriceNum = Number(gpPrice);
                   
                   // DEBUG: Log to diagnose why dummy check might fail
                   logVerbose_Updater_('Updater CHECK: Main Package | GP Len:' + gpData.length + ' | Price:' + gpPrice + ' | Reg:' + mainCat.regular_price + ' | Sale:' + mainCat.sale_price);

                   // Robust check for dummy/default group pricing
                   var isDummy = (gpData.length === 1 && (mainCat.regular_price > 0 || mainCat.sale_price > 0) && (gpPrice == 0 || gpPriceNum === 0 || isNaN(gpPriceNum)));
                   
                   if (!isDummy) {
                      mainCat.group_pricing = gpData;
                   } else {
                      log('Updater: Skipping dummy group pricing for Main Package (Regular: ' + mainCat.regular_price + ')');
                   }
                }
             } catch(e) {
                log('Updater: Error parsing GroupPricing for Main Package: ' + e.message);
             }
          }
          if (pkgFields.PricingCategories) {
             try { 
                var parsedCats = JSON.parse(pkgFields.PricingCategories);
                if (Array.isArray(parsedCats)) payload.pricing_categories = parsedCats;
                else payload.pricing_categories.push(mainCat);
             } catch(e) { payload.pricing_categories.push(mainCat); }
          } else {
             payload.pricing_categories.push(mainCat);
          }
       }
       
      logVerbose_Updater_('Updater: Built Package Payload: ' + JSON.stringify(payload));
       return payload;
    }

    // 2. Process Existing Packages
    if (pkgRecords.length > 0) {
        for (var pk = 0; pk < pkgRecords.length; pk++) {
           var pkg = pkgRecords[pk];
           var f = pkg.fields || {};
           var pkId = pkg.id; // Airtable Record ID
           var pkTextId = f.PackageID; // Text/Number ID
           if (pkTextId) pkTextId = String(pkTextId).trim(); // Normalize
           var existingWpPkgId = (pkTextId && /^\d+$/.test(pkTextId)) ? pkTextId : '';

           // Get linked prices - Match by Record ID OR Text ID
           var linked = [];
           if (pricesByPkgId[pkId]) linked = linked.concat(pricesByPkgId[pkId]);
           if (pkTextId && pricesByPkgId[pkTextId]) {
               // Avoid duplicates if both match
               pricesByPkgId[pkTextId].forEach(function(p) {
                   var exists = linked.some(function(l) { return l.id === p.id; });
                   if (!exists) linked.push(p);
               });
           }
           
           // Fallback: If ONLY ONE package exists, assume ALL prices for this trip belong to it.
           if (pkgRecords.length === 1) {
               log('Updater: Single package detected. Linking ALL ' + priceRecords.length + ' prices to it.');
               linked = priceRecords;
           }

           var payload = processPackage(f, linked); // Pass linked prices!
           if (existingWpPkgId) {
             payload.id = Number(existingWpPkgId);
             log('CACHE HIT - CREATE SKIPPED, UPDATE CONTINUES (package ' + String(targetLang || '') + '): ' + existingWpPkgId);
           } else {
             log('NEW OBJECT CREATED BECAUSE NO EXISTING TARGET FOUND (package ' + String(targetLang || '') + '): airtable_pkg=' + pkId);
           }
           log('Updater: Sending package "' + payload.title + '" to WP...');
           log('Updater: Package copy -> excerpt_chars=' + (payload.excerpt ? String(payload.excerpt).length : 0) + ', content_html_chars=' + (payload.content_html ? String(payload.content_html).length : 0));
           var sendRes = await sendPackageToWp_Updater_(payload, { lang: targetLang })
           var newId = sendRes && sendRes.id ? String(sendRes.id) : ''
           if (!newId && existingWpPkgId && sendRes && String(sendRes.error_code || '') === 'not_found') {
             log('STALE PACKAGE ID DETECTED (package ' + String(targetLang || '') + '): ' + existingWpPkgId + ' -> attempting recreate')
             var createPayload = JSON.parse(JSON.stringify(payload || {}))
             delete createPayload.id
             var createRes = await sendPackageToWp_Updater_(createPayload, { lang: targetLang })
             if (createRes && createRes.id) {
               newId = String(createRes.id)
               log('PACKAGE RECREATED AFTER NOT_FOUND (package ' + String(targetLang || '') + '): newId=' + newId)
             } else {
               log('PACKAGE RECREATE FAILED AFTER NOT_FOUND (package ' + String(targetLang || '') + '): ' + JSON.stringify(createRes || {}))
             }
           }
           
           if (newId) {
              if (existingWpPkgId && String(existingWpPkgId) === String(newId)) {
                log('EXISTING OBJECT REUSED AND REFRESHED (package ' + String(targetLang || '') + '): ' + newId);
              } else {
                log('Updater: Package created with ID: ' + newId + '. Updating Airtable...');
              }
              generatedPackageIds.push(newId);
              
              // 1. Update Package Record
              if (!skipAirtableSync) {
                try {
                    if (!existingWpPkgId || String(existingWpPkgId) !== String(newId)) {
                      await airtableUpdate_('Packages', pkg.id, { PackageID: String(newId) });
                      log('Updater: Updated Packages table for record ' + pkg.id);
                    } else {
                      log('EXISTING TRANSLATED CONTENT REFRESHED (package airtable record ' + pkg.id + ')');
                    }
                } catch (e) {
                    log('Updater: ERROR updating Packages table: ' + e.message);
                }
              }
              
              // 2. Update Linked Prices Records
              // If single package mode, use ALL priceRecords, otherwise use 'linked' subset
              var pricesToUpdate = (pkgRecords.length === 1) ? priceRecords : linked;
              
              if (!skipAirtableSync && pricesToUpdate.length > 0) {
                  log('Updater: Updating ' + pricesToUpdate.length + ' prices with new PackageID ' + newId + '...');
                  for (var pi = 0; pi < pricesToUpdate.length; pi++) {
                      var prRecord = pricesToUpdate[pi];
                      try {
                          var currentPid = prRecord.fields.PackageID;
                          // Force update if ID is different OR if it's missing
                           if (String(currentPid) !== String(newId)) {
                              await airtableUpdate_('Prices', prRecord.id, { PackageID: String(newId) });
                              log('Updater: Updated Price ' + prRecord.id + ' with PackageID ' + newId);
                              // Add delay to avoid Airtable rate limits (5 req/sec)
                              await sleep(400);
                           } else {
                             log('Updater: Price ' + prRecord.id + ' already has correct PackageID');
                          }
                      } catch(e) {
                          log('Updater: Warning - Failed to update Price ' + prRecord.id + ': ' + e.message);
                      }
                  }
              }
           } else {
              log('Updater: ERROR - Failed to create package on WordPress. Skipping Airtable updates.');
           }
        }
    } else if (priceRecords.length > 0) {
       // 3. Fallback: If NO Packages table records but we have Prices records
       log('Updater: Found Prices but no Packages. Creating default package.');
       var payload = processPackage({ PackageTitle: "Standard Options" }, priceRecords);
       var res2 = await sendPackageToWp_Updater_(payload, { lang: targetLang })
       var newId2 = res2 && res2.id ? String(res2.id) : ''
       if (newId2) generatedPackageIds.push(newId2);
    }

    // 4. Link Packages to Trip
    if (generatedPackageIds.length > 0) {
       var metaUpdate = {
         meta: {
           packages_ids: generatedPackageIds,
           wp_travel_engine_setting: {
             packages_ids: generatedPackageIds
           }
         }
       };
       await pushToWordPress_Updater_(wpTripId, metaUpdate);
       log('Updater: Linked packages ' + generatedPackageIds.join(',') + ' to Trip ' + wpTripId);
    }

  } catch (e) {
    log('Updater: Error in publishPackagesForTrip - ' + e.message);
  }
}

async function sendPackageToWp_Updater_(payload, opts) {
      opts = opts || {};
      var isUpdate = payload && payload.id;
      var options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        headers: {
          'Authorization': 'Basic ' + base64Encode(CONFIG.WP_API_USER + ':' + CONFIG.WP_API_PASS)
        },
        muteHttpExceptions: true
      };
      
      var baseUrl = CONFIG.WP_API_BASE;
      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
      // Fix: If base URL ends with /trips, remove it to get the root API path
      // This is crucial because packages endpoint is likely /wp-json/wp/v2/trip_packages or similar
      // BUT based on the logic, the user expects /wp-json/fts/v1/packages
      if (baseUrl.endsWith('/trips')) baseUrl = baseUrl.slice(0, -6);

      function appendLang_(u) {
        if (opts.lang) return u + '?lang=' + encodeURIComponent(String(opts.lang))
        return u
      }

      var attempts = []
      if (isUpdate) attempts.push(appendLang_(baseUrl + '/packages/' + encodeURIComponent(String(payload.id))))
      attempts.push(appendLang_(baseUrl + '/packages'))

      for (var ai = 0; ai < attempts.length; ai++) {
        var url = attempts[ai]
        if (ai === 0) log('PACKAGE ENDPOINT ATTEMPT: ' + url)
        else log('PACKAGE ENDPOINT FALLBACK ATTEMPT: ' + url)
        var resp = await fetchUrl(url, options)
        var code = resp.getResponseCode()
        var text = resp.getContentText()
        var json = null
        try { json = JSON.parse(text) } catch (eJson) { json = null }
        var errCode = (json && json.code) ? String(json.code) : ''

        if (json && json.id) {
          log('PACKAGE ENDPOINT RESOLVED: ' + url)
          if (isUpdate && ai === 0) log('Updater: Updated Package ' + json.id)
          else log('Updater: Created Package ' + json.id)
          return { id: json.id, http_code: code, error_code: errCode, body: json }
        }

        var noRoute = code === 404 && json && json.code === 'rest_no_route'
        if (noRoute) {
          log('Updater: Failed to send package (code=404): ' + JSON.stringify(json))
          continue
        }

        if (code >= 200 && code < 300 && isUpdate && ai === 0) {
          log('PACKAGE ENDPOINT RESOLVED: ' + url)
          log('Updater: Updated Package ' + String(payload.id))
          return { id: payload.id, http_code: code, error_code: errCode, body: json }
        }

        log('Updater: Failed to send package (code=' + code + '): ' + (json ? JSON.stringify(json) : text))
        return { id: null, http_code: code, error_code: errCode, body: (json || { raw: text }) }
      }

      return { id: null, http_code: 0, error_code: '', body: null }
}

async function publishImagesSafe_Updater_(tripId, wpTripId, tripFields) {
   var imageTranslationMapForAttachments = parseImageTranslationMap_Updater_(tripFields && tripFields.Image_Translation_Map);
   // 1. Fetch Improvement Records (for Metadata & Gallery)
   var impRecords = await findRecordsByLinkedId_Updater_(UPDATER_IMAGES_IMPROVEMENT_TABLE, 'Trip', tripId);
   var impState = getLookupState_Updater_(UPDATER_IMAGES_IMPROVEMENT_TABLE, 'Trip', tripId, 'multi');
   if (isLookupStateIncomplete_Updater_(impState)) {
      throw new Error(
        'Updater: Image publish aborted for Trip ' + tripId +
        ' because Images Improvement dataset is incomplete. ' + describeLookupState_Updater_(impState)
      );
   }
   
   // 2. Fetch Raw Images Records (for Featured Image Matching by Attachment)
   // We need this because Improvement table has IDs but NOT the attachment files for matching
   var rawImagesRecords = await findImageRecordsForTrip_Updater_(tripId, wpTripId);
   var rawImagesTable = getRawImagesTableName_Updater_();
   var rawImagesState = getLookupState_Updater_(rawImagesTable, 'SourceTrip|Trip', tripId || wpTripId, 'image_lookup');
   if (isLookupStateIncomplete_Updater_(rawImagesState)) {
      throw new Error('Updater: Raw image lookup is incomplete for Trip ' + tripId + '. ' + describeLookupState_Updater_(rawImagesState));
   }
   
   if (rawImagesRecords && rawImagesRecords.length > 0) {
       logVerbose_Updater_('Updater: Found ' + rawImagesRecords.length + ' raw images. First record fields: ' + JSON.stringify(rawImagesRecords[0].fields));
   }

   // Map Airtable Record ID -> WP Media ID
   var imageMap = {};
   if (rawImagesRecords) {
       rawImagesRecords.forEach(function(r) {
           var wpId = r.fields.ImageID || r.fields.IMAGE || r.fields.ID;
           if (Array.isArray(wpId)) wpId = wpId[0];
           if (wpId) imageMap[r.id] = wpId;
       });
   }
   
   if (!impRecords || impRecords.length === 0) {
      log('Updater: No Images Improvement records found for Trip ' + tripId + '. Skipping image publishing because Type is the only source of truth.');
      return;
   }
   
   var galleryIds = [];
   var featId = null;
   var featuredRawRecId = null;

   if (impRecords && impRecords.length > 0) {
       for (var ir = 0; ir < impRecords.length; ir++) {
           var imgRec = impRecords[ir];
           var f = imgRec.fields;
           var wpMediaId = f.ImageID || f.IMAGE; 
           var linkedIdForRaw = null;
           
           if (Array.isArray(wpMediaId)) wpMediaId = wpMediaId[0];
           
           // If it looks like an Airtable ID (starts with rec), try to resolve it
           if (wpMediaId && String(wpMediaId).indexOf('rec') === 0) {
               if (imageMap[wpMediaId]) {
                   wpMediaId = imageMap[wpMediaId];
               } else {
                   wpMediaId = null; // Can't use Airtable ID directly
               }
           }
           
           // If no direct WP ID, try to resolve via Linked Record
           if (!wpMediaId) {
               var linkedImage = f.Image || f.Images;
               if (Array.isArray(linkedImage) && linkedImage.length > 0) {
                   var linkedId = linkedImage[0];
                   linkedIdForRaw = linkedId;
                   if (!featuredRawRecId) featuredRawRecId = linkedId;
                   if (imageMap[linkedId]) {
                       wpMediaId = imageMap[linkedId];
                   } else {
                       try {
                         var remoteRawRec = await airtableGetRecordById_Updater_(rawImagesTable, linkedId);
                         if (remoteRawRec && remoteRawRec.fields) {
                           var remoteWpId = remoteRawRec.fields.ImageID || remoteRawRec.fields.IMAGE || remoteRawRec.fields.ID;
                           if (Array.isArray(remoteWpId)) remoteWpId = remoteWpId[0];
                           if (remoteWpId) {
                             wpMediaId = remoteWpId;
                             imageMap[linkedId] = remoteWpId;
                             log('Updater: Resolved missing raw image mapping via direct fetch: ' + linkedId + ' -> ' + remoteWpId);
                           }
                         }
                       } catch (eDirectRaw) {}
                   }
               }
           }

           if (wpMediaId) {
             try {
               var existingMedia = await getMediaFromWordPress_Updater_(String(wpMediaId));
               if (!existingMedia) {
                 log('Updater: WP Media ' + wpMediaId + ' not found. Treating as missing and attempting re-upload from URL.');
                 wpMediaId = null;
               }
             } catch (eMediaCheck) {
               wpMediaId = null;
             }
           }
           
           // --- NEW: Upload from URL if ID missing but URL available ---
           // This handles gallery images that are in Airtable but not yet in WordPress
           if (!wpMediaId) {
              // Try to find the raw record to get the URL
              var linkedImage = f.Image || f.Images;
              if (Array.isArray(linkedImage) && linkedImage.length > 0) {
                 var linkedId = linkedImage[0];
                 linkedIdForRaw = linkedId;

                 // Find the raw record in rawImagesRecords
                 var rawRec = rawImagesRecords ? rawImagesRecords.find(function(r) { return r.id === linkedId; }) : null;
                 if (!rawRec) {
                    try {
                      rawRec = await airtableGetRecordById_Updater_(rawImagesTable, linkedId);
                      if (rawRec) log('Updater: Loaded raw image record via direct fetch for upload: ' + linkedId);
                    } catch (eRawFetch) {
                      rawRec = null;
                    }
                 }
                 
                 if (rawRec) {
                    var rawAtts = rawRec.fields.Image || rawRec.fields.Attachments || rawRec.fields.File;
                    var rawUrl = rawRec.fields.URL || rawRec.fields.Url || rawRec.fields.url;
                    
                    var targetUrl = null;
                    if (rawAtts && rawAtts.length > 0) targetUrl = rawAtts[0].url;
                    else if (rawUrl) targetUrl = rawUrl;
                    
                    if (targetUrl) {
                       log('Updater: Image ' + linkedId + ' missing WP ID. Uploading from URL...');
                       var newId = await uploadMediaFromUrl_Updater_(targetUrl, (tripFields.Title || 'trip') + '-image-' + linkedId);
                       if (newId) {
                          wpMediaId = newId;
                          // Update the mapping so we don't upload it again if referenced twice
                          imageMap[linkedId] = newId;
                          
                          // Optional: Update the Raw Images table with the new ID to avoid re-uploading next time
                          try {
                             await airtableUpdate_(rawImagesTable, linkedId, { ImageID: String(newId) });
                          } catch(e) {
                             log('Updater: Warning - Failed to save new ImageID to Images table: ' + e.message);
                          }
                       }
                    } else {
                       log('Updater: Raw image record found but no URL/attachment available for upload: ' + linkedId);
                    }
                 }
              }
           }
           
           if (wpMediaId) {
               if (!linkedIdForRaw) {
                 var linkedImage2 = f.Image || f.Images;
                 if (Array.isArray(linkedImage2) && linkedImage2.length > 0) {
                   linkedIdForRaw = linkedImage2[0];
                 }
               }

               try {
                 if (linkedIdForRaw) {
                   var rawRecForUrl = rawImagesRecords ? rawImagesRecords.find(function(r) { return r.id === linkedIdForRaw; }) : null;
                   if (!rawRecForUrl) {
                     try { rawRecForUrl = await airtableGetRecordById_Updater_(rawImagesTable, linkedIdForRaw); } catch (eR2) { rawRecForUrl = null; }
                   }
                   var existingUrl = '';
                   if (rawRecForUrl && rawRecForUrl.fields) {
                     existingUrl = rawRecForUrl.fields.URL || rawRecForUrl.fields.Url || rawRecForUrl.fields.url || '';
                   }
                   await maybeStoreStableImageUrl_Updater_(rawImagesTable, linkedIdForRaw, existingUrl, wpMediaId);
                 }
               } catch (eStableUrl) {}

              log('Updater: Image record ' + imgRec.id + ' Type raw value: ' + JSON.stringify(f.Type) + ', wpMediaId: ' + wpMediaId);

              var declaredType = getTypeNameFromAirtable_Updater_(f.Type).trim().toLowerCase();

              if (!declaredType && linkedIdForRaw) {
                var rawRecForType = rawImagesRecords ? rawImagesRecords.find(function(r) { return r.id === linkedIdForRaw; }) : null;
                if (!rawRecForType) {
                  try { rawRecForType = await airtableGetRecordById_Updater_(rawImagesTable, linkedIdForRaw); } catch (eR3) { rawRecForType = null; }
                }
                if (rawRecForType && rawRecForType.fields) {
                  var roleFromCaption = getImageRoleFromCaption_Updater_(rawRecForType.fields.Caption || rawRecForType.fields.Notes || '');
                  if (roleFromCaption) {
                    declaredType = roleFromCaption;
                    log('Updater: Type inferred from raw image caption: ' + declaredType);
                  }
                }
              }

              if (!declaredType) {
                declaredType = 'gallery';
                log('Updater: WARNING - Image ' + imgRec.id + ' has no Type. Defaulting to gallery.');
              }
               if (declaredType === 'featured') {
                   if (!featId) featId = wpMediaId;
               } else if (declaredType === 'gallery') {
                   galleryIds.push(wpMediaId);
               } else {
                  declaredType = 'gallery';
                  galleryIds.push(wpMediaId);
                  log('Updater: WARNING - Image ' + imgRec.id + ' has unexpected Type. Defaulting to gallery.');
               }

               // --- NEW: Update Image Metadata (Title, Caption, Alt) ---
               // We use the standard WordPress REST API for this: /wp-json/wp/v2/media/{id}
               var mediaJson2 = null
               try { mediaJson2 = await getMediaFromWordPress_Updater_(String(wpMediaId)) } catch (eMeta2) { mediaJson2 = null }
               var wpMeta2 = buildMediaMetaFromWpResponse_Updater_(mediaJson2) || { alt: '', title: '', caption: '', description: '' }
               var pref = buildPreferredEnglishImageMetadata_Updater_(f || {}, wpMeta2)
               var wpTitle2 = String(wpMeta2 && wpMeta2.title ? wpMeta2.title : '').trim()
               var wpCaption2 = String(wpMeta2 && wpMeta2.caption ? wpMeta2.caption : '').trim()
               var wpAlt2 = String(wpMeta2 && wpMeta2.alt ? wpMeta2.alt : '').trim()
               var wpDesc2 = String(wpMeta2 && wpMeta2.description ? wpMeta2.description : '').trim()
               var wpMissingAny = (!wpTitle2 || !wpCaption2 || !wpAlt2 || !wpDesc2)
               var aiAllEmpty2 = !!(pref && pref._ai_all_empty)

               if (pref && pref._source === 'airtable_ai') {
                 log('ENGLISH IMAGE METADATA SOURCE: airtable_ai')
                 if (pref._partial_merge) log('ENGLISH IMAGE METADATA PARTIAL MERGE APPLIED')
                 log('ENGLISH IMAGE METADATA FALLBACK SKIPPED BECAUSE AI TABLE HAS DATA')

                 var payloadAi = {}
                 if (pref._field_sources && pref._field_sources.title === 'airtable_ai' && pref.title) payloadAi.title = pref.title
                 if (pref._field_sources && pref._field_sources.caption === 'airtable_ai' && pref.caption) payloadAi.caption = pref.caption
                 if (pref._field_sources && pref._field_sources.alt_text === 'airtable_ai' && pref.alt_text) payloadAi.alt_text = pref.alt_text
                 if (pref._field_sources && pref._field_sources.description === 'airtable_ai' && pref.description) payloadAi.description = pref.description

                 if (payloadAi.title || payloadAi.caption || payloadAi.alt_text || payloadAi.description) {
                   await throttleMediaItem_Updater_('update media ' + wpMediaId)
                   await updateMediaOnWordPress_Updater_(wpMediaId, payloadAi)
                   if (payloadAi.title) {
                     await throttleStage_Updater_('ensure filename ' + wpMediaId, UPDATER_ENSURE_FILENAME_DELAY_MS)
                     try {
                       await ensureFilenameForMedia_Updater_(wpMediaId, payloadAi.title)
                     } catch (eEnsure) {
                       if (shouldSkipEnsureFilenameForError_Updater_(eEnsure)) {
                         log('Updater: Skipping ensure filename for Media ' + wpMediaId + ' due to quota/rate-limit: ' + (eEnsure && eEnsure.message ? eEnsure.message : String(eEnsure)))
                       } else {
                         throw eEnsure
                       }
                     }
                   }
                   await sleep(200)
                 }
               } else if (aiAllEmpty2 && wpMissingAny) {
                 log('ENGLISH IMAGE METADATA SOURCE: fallback_ai')
                 await ensureEnglishMediaMetadataForAttachment_Updater_(wpMediaId, tripFields, tripId, declaredType, '')
               } else {
                 log('ENGLISH IMAGE METADATA SOURCE: wordpress_existing')
               }
           }
       }
   }

   // --- Step C: Finalize Payload ---
   if (featId || galleryIds.length > 0) {
     // Deduplicate Gallery IDs
     var uniqueGalleryIds = [];
     var seenIds = {};
     for (var g = 0; g < galleryIds.length; g++) {
         var gid = String(galleryIds[g]);
         if (!seenIds[gid]) {
             seenIds[gid] = true;
             uniqueGalleryIds.push(galleryIds[g]);
         }
     }
     galleryIds = uniqueGalleryIds;

     var payload = { meta: { wp_travel_engine_setting: {} } };
     
     if (featId) {
        payload.meta._thumbnail_id = featId;
        // Remove featId from galleryIds to avoid duplication
        galleryIds = galleryIds.filter(function(id) { return String(id) !== String(featId); });
     }
     
     if (galleryIds.length) {
        var galObj = { "enable": "1" };
        galleryIds.forEach(function(id, idx) { galObj[String(idx)] = id; });
        payload.meta.wpte_gallery_id = galObj;
     }
     
     await pushToWordPress_Updater_(wpTripId, payload);
     log('Updater: Published Images for Trip ' + wpTripId + ' (Featured: ' + (featId || 'None') + ', Gallery: ' + galleryIds.length + ')');
   }
}

function buildPreferredEnglishImageMetadata_Updater_(aiFields, wpMeta) {
  var f = aiFields || {}
  var wp = wpMeta || { alt: '', title: '', caption: '', description: '' }
  function clean_(x) { return String(x == null ? '' : x).replace(/\s+/g, ' ').trim() }

  var aiTitle = clean_(f.AI_Title)
  var aiCaption = clean_(f.AI_Caption)
  var aiAlt = clean_(f.AI_Alt)
  var aiDesc = clean_(f.AI_Description)

  var wpTitle = clean_(wp.title)
  var wpCaption = clean_(wp.caption)
  var wpAlt = clean_(wp.alt)
  var wpDesc = clean_(wp.description)

  var out = { title: '', caption: '', alt_text: '', description: '' }
  var sources = { title: '', caption: '', alt_text: '', description: '' }

  out.title = aiTitle || wpTitle || ''
  sources.title = aiTitle ? 'airtable_ai' : (wpTitle ? 'wordpress_existing' : '')

  out.caption = aiCaption || wpCaption || ''
  sources.caption = aiCaption ? 'airtable_ai' : (wpCaption ? 'wordpress_existing' : '')

  out.alt_text = aiAlt || wpAlt || ''
  sources.alt_text = aiAlt ? 'airtable_ai' : (wpAlt ? 'wordpress_existing' : '')

  out.description = aiDesc || wpDesc || ''
  sources.description = aiDesc ? 'airtable_ai' : (wpDesc ? 'wordpress_existing' : '')

  var anyAi = !!(aiTitle || aiCaption || aiAlt || aiDesc)
  var anyWp = !!(wpTitle || wpCaption || wpAlt || wpDesc)
  var anyValue = !!(out.title || out.caption || out.alt_text || out.description)
  out._ai_all_empty = !anyAi
  out._wp_all_empty = !anyWp
  out._field_sources = sources
  out._partial_merge = anyAi && (sources.title === 'wordpress_existing' || sources.caption === 'wordpress_existing' || sources.alt_text === 'wordpress_existing' || sources.description === 'wordpress_existing')
  if (anyAi) out._source = 'airtable_ai'
  else if (anyWp) out._source = 'wordpress_existing'
  else if (anyValue) out._source = 'wordpress_existing'
  else out._source = 'none'
  return out
}

async function maybeStoreStableImageUrl_Updater_(rawImagesTable, rawRecId, currentUrl, wpMediaId) {
  var id = String(rawRecId || '').trim();
  if (!id) return;
  var wpId = String(wpMediaId || '').trim();
  if (!wpId) return;

  var cur = String(currentUrl || '').trim();
  if (cur && cur.indexOf('airtableusercontent.com') === -1) return;

  var mediaJson = null;
  try {
    mediaJson = await getMediaFromWordPress_Updater_(wpId);
  } catch (e) {
    mediaJson = null;
  }
  if (!mediaJson) return;

  var wpUrl = '';
  if (mediaJson.source_url) wpUrl = String(mediaJson.source_url).trim();
  if (!wpUrl && mediaJson.guid && mediaJson.guid.rendered) wpUrl = String(mediaJson.guid.rendered).trim();
  if (!wpUrl) return;

  try {
    await airtableUpdate_(rawImagesTable, id, { URL: wpUrl });
  } catch (e2) {}
}

/**
 * Update WordPress Media/Attachment Metadata
 * Uses standard WP API: POST /wp-json/wp/v2/media/{id}
 */
async function updateMediaOnWordPress_Updater_(mediaId, data) {
  // Construct standard WP API URL
  // Assume CONFIG.WP_API_BASE is like "https://site.com/wp-json/fts/v1"
  // We want "https://site.com/wp-json/wp/v2/media/{id}"
  
  var baseUrl = CONFIG.WP_API_BASE;
  var rootUrl = baseUrl;
  
  if (baseUrl.indexOf('/wp-json/') !== -1) {
    rootUrl = baseUrl.split('/wp-json/')[0];
  } else {
    // Fallback if structure is different
    log('Updater: Warning - Could not determine WP root URL from ' + baseUrl);
    return;
  }
  
  var mediaUrl = rootUrl + '/wp-json/wp/v2/media/' + mediaId;
  
  var payload = {};
  if (data.title) payload.title = data.title;
  if (data.slug) payload.slug = data.slug;
  if (data.caption) payload.caption = data.caption;
  if (data.alt_text) payload.alt_text = data.alt_text;
  if (data.description) payload.description = data.description;

  log('Updater: Media ' + mediaId + ' update payload: ' + JSON.stringify(payload));
  
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: {
      'Authorization': 'Basic ' + base64Encode(CONFIG.WP_API_USER + ':' + CONFIG.WP_API_PASS)
    },
    muteHttpExceptions: true
  };
  
  try {
      var resp = await fetchUrl(mediaUrl, options);
      if (resp.getResponseCode() === 200) {
          log('Updater: Updated Media ' + mediaId + ' metadata (Title: ' + (data.title ? 'Yes' : 'No') + ', Alt: ' + (data.alt_text ? 'Yes' : 'No') + ')');

          if (data.alt_text) {
            await sleep(500);
            try {
              var verifyJson = await getMediaFromWordPress_Updater_(String(mediaId));
              var savedAlt = verifyJson && verifyJson.alt_text ? String(verifyJson.alt_text).trim() : '';
              if (!savedAlt) {
                log('Updater: Alt text NOT saved for Media ' + mediaId + ' despite 200 OK. Retrying...');
                var retryPayload = JSON.stringify({ alt_text: data.alt_text });
                var retryResp = await fetchUrl(mediaUrl, {
                  method: 'post',
                  contentType: 'application/json',
                  payload: retryPayload,
                  headers: { 'Authorization': 'Basic ' + base64Encode(CONFIG.WP_API_USER + ':' + CONFIG.WP_API_PASS) },
                  muteHttpExceptions: true
                });
                if (retryResp.getResponseCode() === 200) {
                  log('Updater: Alt text retry for Media ' + mediaId + ' completed.');
                } else {
                  log('Updater: Alt text retry FAILED for Media ' + mediaId + ': ' + retryResp.getContentText());
                }
              }
            } catch (eVerify) {
              log('Updater: Could not verify alt for Media ' + mediaId + ': ' + eVerify.message);
            }
          }
      } else {
          log('Updater: Failed to update Media ' + mediaId + ': ' + resp.getContentText());
      }
  } catch (e) {
      log('Updater: Error updating Media ' + mediaId + ': ' + e.message);
  }
}

function ensureWebpAndRenameMedia_Updater_(mediaId, desiredTitle, langCode) {
  return;
}

async function ensureFilenameForMedia_Updater_(mediaId, desiredTitle) {
  var id = String(mediaId || '').trim();
  var title = String(desiredTitle || '').trim();
  if (!id || !title) return;

  var baseUrl = CONFIG.WP_API_BASE;
  if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
  if (baseUrl.endsWith('/trips')) baseUrl = baseUrl.slice(0, -6);
  var url = baseUrl + '/media/ensure-filename';

  var payload = { source_id: id, title: title };
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: {
      'Authorization': 'Basic ' + base64Encode(CONFIG.WP_API_USER + ':' + CONFIG.WP_API_PASS)
    },
    muteHttpExceptions: true
  };

  try {
    var resp = await fetchUrl(url, options);
    var code = resp.getResponseCode();
    if (code >= 200 && code < 300) {
      log('Updater: Filename ensured for Media ' + id);
    } else {
      log('Updater: Failed to ensure filename for Media ' + id + ': ' + resp.getContentText());
    }
  } catch (e) {
    log('Updater: Error ensuring filename for Media ' + id + ': ' + e.message);
  }
}

function getFilenameFromUrl_Updater_(url) {
  var u = String(url || '').trim();
  if (!u) return '';
  var q = u.indexOf('?');
  if (q !== -1) u = u.substring(0, q);
  var parts = u.split('/');
  return parts.length ? String(parts[parts.length - 1] || '') : '';
}

function guessTitleFromFilename_Updater_(filename) {
  var f = String(filename || '').trim();
  if (!f) return '';
  f = f.replace(/\.[a-z0-9]{2,5}$/i, '');
  f = f.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!f) return '';
  return f.charAt(0).toUpperCase() + f.slice(1);
}

async function ensureEnglishMediaMetadataForAttachment_Updater_(mediaId, tripFields, tripId, imageRole, fallbackName) {
  var id = String(mediaId || '').trim();
  if (!id) return;

  var mediaJson = null;
  try { mediaJson = await getMediaFromWordPress_Updater_(id); } catch (e) { mediaJson = null; }
  if (!mediaJson) return;

  var current = buildMediaMetaFromWpResponse_Updater_(mediaJson) || { alt: '', title: '', caption: '', description: '' };

  var needsTitle = !String(current.title || '').trim();
  var needsCaption = !String(current.caption || '').trim();
  var needsAlt = !String(current.alt || '').trim();
  var needsDescription = !String(current.description || '').trim();
  if (!needsTitle && !needsCaption && !needsAlt && !needsDescription) return;

  var sourceUrl = mediaJson.source_url ? String(mediaJson.source_url) : '';
  var filename = getFilenameFromUrl_Updater_(sourceUrl) || String(fallbackName || '').trim();
  var guessedTitle = guessTitleFromFilename_Updater_(filename);

  var fakeImageFields = {
    Title: current.title || guessedTitle || filename || ('Image ' + id),
    URL: sourceUrl || '',
    Caption: current.caption || '',
    Alt: current.alt || ''
  };

  var ctx = null;
  try { ctx = await buildImageContext_(fakeImageFields, tripFields || {}, id, tripId); } catch (e2) { ctx = null; }
  if (!ctx) return;

  var kwPlan = null
  try { kwPlan = extractKeywordsForTargetLanguage_Updater_(ctx.seoKeywords || '', 'en') } catch (eKw) { kwPlan = null }
  if (kwPlan && kwPlan.all && kwPlan.all.length) {
    var allow = {}
    kwPlan.all.forEach(function (k) { allow[String(k || '').toLowerCase()] = true })
    var rawPool = String(ctx.seoKeywords || '').split(',').map(function (s) { return String(s || '').replace(/\s+/g, ' ').trim() }).filter(function (s) { return !!s })
    var seenRm = {}
    rawPool.forEach(function (k) {
      var kk = String(k || '').toLowerCase()
      if (!allow[kk] && !seenRm[kk]) {
        seenRm[kk] = true
        log('CROSS-LANGUAGE IMAGE KEYWORD REMOVED: "' + k + '" from en')
      }
    })
    ctx.seoKeywords = kwPlan.all.join(', ')
    log('ENGLISH MEDIA KEYWORD POOL SOURCE: target_bucket_only (en)')
    log('ENGLISH MEDIA KEYWORD POOL PURIFIED: ' + JSON.stringify(kwPlan.all.slice(0, 12)) + (kwPlan.all.length > 12 ? (' (+ ' + (kwPlan.all.length - 12) + ' more)') : ''))
  } else {
    ctx.seoKeywords = ''
    log('ENGLISH MEDIA KEYWORD POOL SOURCE: target_bucket_only (en)')
    log('ENGLISH MEDIA KEYWORD POOL PURIFIED: []')
    var fallbackPrimary = String(ctx.seoTitle || ctx.tripTitle || '').replace(/\s+/g, ' ').trim()
    if (fallbackPrimary.length > 60) fallbackPrimary = fallbackPrimary.substring(0, 60).trim()
    if (fallbackPrimary) kwPlan = { primary: fallbackPrimary, secondary: [], all: [fallbackPrimary] }
  }
  log('ENGLISH MEDIA METADATA PATH NOW USING TARGET BUCKET ONLY')

  var prompt = '';
  try { prompt = buildImagesPrompt_(ctx, kwPlan || null); } catch (e3) { prompt = ''; }
  if (!prompt) return;

  var aiResult = null;
  try { aiResult = await callOpenai_(prompt); } catch (e4) { aiResult = null; }
  if (!aiResult || typeof aiResult !== 'object') return;

  var title = String(aiResult.title || '').trim();
  var caption = String(aiResult.caption || '').trim();
  var description = String(aiResult.description || '').trim();
  var alt = String(aiResult.alt || '').trim();

  if (title.length > 60) title = title.substring(0, 60).trim();
  if (caption.length > 150) caption = caption.substring(0, 150).trim();
  if (description.length > 300) description = description.substring(0, 300).trim();
  if (alt.length > 125) alt = alt.substring(0, 125).trim();

  var payload = {};
  if (needsTitle && title) payload.title = title;
  if (needsCaption && caption) payload.caption = caption;
  if (needsAlt && alt) payload.alt_text = alt;
  if (needsDescription) payload.description = description || caption;

  if (payload.title || payload.caption || payload.alt_text || payload.description) {
    await throttleMediaItem_Updater_('update media ' + id)
    await updateMediaOnWordPress_Updater_(id, payload);
    if (payload.title) {
      await throttleStage_Updater_('ensure filename ' + id, UPDATER_ENSURE_FILENAME_DELAY_MS)
      try {
        await ensureFilenameForMedia_Updater_(id, payload.title);
      } catch (eEnsure2) {
        if (shouldSkipEnsureFilenameForError_Updater_(eEnsure2)) {
          log('Updater: Skipping ensure filename for Media ' + id + ' due to quota/rate-limit: ' + (eEnsure2 && eEnsure2.message ? eEnsure2.message : String(eEnsure2)));
        } else {
          throw eEnsure2;
        }
      }
    }
    await sleep(150);
  }
}

function parseImageTranslationMap_Updater_(raw) {
  try {
    if (!raw) return {};
    var s = raw;
    if (Array.isArray(s)) s = s[0];
    if (typeof s !== 'string') s = String(s);
    s = s.trim();
    if (!s) return {};
    var obj = JSON.parse(s);
    if (!obj || typeof obj !== 'object') return {};
    return obj;
  } catch (e) {
    return {};
  }
}

function parseTranslationUrlMap_Updater_(raw) {
  try {
    if (!raw) return {}
    var s = raw
    if (Array.isArray(s)) s = s[0]
    if (typeof s === 'object') {
      if (!s || Array.isArray(s)) return {}
      return s
    }
    if (typeof s !== 'string') s = String(s)
    s = s.trim()
    if (!s) return {}
    var obj = JSON.parse(s)
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {}
    return obj
  } catch (e) {
    return {}
  }
}

function mergeTranslationUrlMap_Updater_(base, incoming) {
  var a = base && typeof base === 'object' ? base : {}
  var b = incoming && typeof incoming === 'object' ? incoming : {}
  var out = {}
  Object.keys(a).forEach(function(k) { out[k] = a[k] })
  Object.keys(b).forEach(function(k) { out[k] = b[k] })
  return out
}

function upsertTranslationUrlMapEntry_Updater_(mapObj, lang, postId, url) {
  var map = mapObj && typeof mapObj === 'object' ? mapObj : {}
  var l = String(lang || '').toLowerCase()
  if (!l) return map
  var pid = Number(postId || 0)
  var u = String(url || '').trim()
  if (!pid && !u) return map
  map[l] = {
    post_id: pid || (map[l] && map[l].post_id ? map[l].post_id : 0),
    url: u || (map[l] && map[l].url ? map[l].url : ''),
    last_synced_at: new Date().toISOString()
  }
  return map
}

async function storeTranslationUrlMap_Updater_(tripRecId, map) {
  try {
    await airtableUpdate_(UPDATER_TRIPS_TABLE, tripRecId, {
      'Translation_URL_Map': JSON.stringify(map || {})
    })
  } catch (e) {}
}

async function pushTranslationUrlMapMetaToWordPress_Updater_(wpTripId, map) {
  try {
    await pushToWordPress_Updater_(wpTripId, { meta: { translation_url_map: JSON.stringify(map || {}) } })
  } catch (e) {}
}

function getAirtableAttachmentKey_Updater_(attachmentId) {
  var id = String(attachmentId || '').trim();
  if (!id) return '';
  return 'att:' + id;
}

function getCachedAttachmentId_Updater_(map, attachmentId, lang) {
  var key = getAirtableAttachmentKey_Updater_(attachmentId);
  if (!key) return null;
  return getCachedTranslatedAttachmentId_Updater_(map, key, lang);
}

function setCachedAttachmentId_Updater_(map, attachmentId, lang, mediaId) {
  var key = getAirtableAttachmentKey_Updater_(attachmentId);
  if (!key) return;
  setCachedTranslatedAttachmentId_Updater_(map, key, lang, mediaId);
}

async function ensureEnglishImageIdsInTranslationMap_Updater_(tripRecId, map, sourceIds) {
  if (!tripRecId) return;
  if (!map || typeof map !== 'object') return;
  if (!sourceIds || !sourceIds.length) return;

  var changed = false;
  sourceIds.forEach(function(id) {
    var s = String(id || '').trim();
    if (!s) return;
    if (!map[s] || typeof map[s] !== 'object') {
      map[s] = { en: s };
      changed = true;
      return;
    }
    if (!map[s].en) {
      map[s].en = s;
      changed = true;
    }
  });

  if (changed) await storeImageTranslationMap_Updater_(tripRecId, map);
}

async function storeImageTranslationMap_Updater_(tripRecId, map) {
  try {
    await airtableUpdate_(UPDATER_TRIPS_TABLE, tripRecId, {
      'Image_Translation_Map': JSON.stringify(map || {})
    });
    log('TRANSLATED IMAGE STORED IN CACHE');
  } catch (e) {}
}

function getCachedTranslatedAttachmentId_Updater_(map, sourceId, lang) {
  var src = String(sourceId || '');
  var l = String(lang || '').toLowerCase();
  if (!src || !l) return null;
  if (!map || typeof map !== 'object') return null;
  if (!map[src] || typeof map[src] !== 'object') return null;
  var id = map[src][l];
  return id ? String(id) : null;
}

function setCachedTranslatedAttachmentId_Updater_(map, sourceId, lang, translatedId) {
  var src = String(sourceId || '');
  var l = String(lang || '').toLowerCase();
  var tid = String(translatedId || '');
  if (!src || !l || !tid) return;
  if (!map[src] || typeof map[src] !== 'object') map[src] = {};
  map[src][l] = tid;
}

async function createTranslatedAttachment_Updater_(sourceAttachmentId, targetLang) {
  log('CREATING TRANSLATED ATTACHMENT FOR IMAGE: ' + sourceAttachmentId);
  var baseUrl = CONFIG.WP_API_BASE;
  if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
  if (baseUrl.endsWith('/trips')) baseUrl = baseUrl.slice(0, -6);
  var url = baseUrl + '/media/clone';

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ source_id: String(sourceAttachmentId), lang: String(targetLang || '').toLowerCase() }),
    headers: {
      'Authorization': 'Basic ' + base64Encode(CONFIG.WP_API_USER + ':' + CONFIG.WP_API_PASS)
    },
    muteHttpExceptions: true
  };

  var resp = await fetchUrl(url, options);
  if (resp.getResponseCode() !== 200) {
    throw new Error('FTS media clone failed (' + resp.getResponseCode() + '): ' + resp.getContentText());
  }
  var json = JSON.parse(resp.getContentText());
  if (!json || !json.success || !json.new_id) {
    throw new Error('FTS media clone returned unexpected response: ' + resp.getContentText());
  }
  log('TRANSLATED ATTACHMENT CREATED: ' + json.new_id);
  return String(json.new_id);
}

async function ensureTranslatedAttachmentWithStatus_Updater_(tripRecId, map, sourceId, lang, imageRole) {
  if (map && typeof map === 'object') {
    if (!map[String(sourceId || '')] || typeof map[String(sourceId || '')] !== 'object') {
      map[String(sourceId || '')] = { en: String(sourceId || '') };
      await storeImageTranslationMap_Updater_(tripRecId, map);
    } else if (!map[String(sourceId || '')].en) {
      map[String(sourceId || '')].en = String(sourceId || '');
      await storeImageTranslationMap_Updater_(tripRecId, map);
    }
  }

  var cached = getCachedTranslatedAttachmentId_Updater_(map, sourceId, lang);
  if (cached) {
    var exists = null
    try { exists = await getMediaFromWordPress_Updater_(cached) } catch (eExists) { exists = null }
    if (exists) {
      log('CACHE HIT - CREATE SKIPPED, UPDATE CONTINUES (attachment ' + lang + '): ' + sourceId + ' -> ' + cached)
      return { id: cached, status: 'reuse', role: imageRole || '' }
    }
    log('CACHE HIT BUT TARGET MISSING - CREATE CONTINUES (attachment ' + lang + '): ' + sourceId + ' -> ' + cached)
  }
  log('IMAGE TRANSLATION CACHE MISS (' + lang + '): ' + sourceId);
  var newId = await createTranslatedAttachment_Updater_(sourceId, lang);
  setCachedTranslatedAttachmentId_Updater_(map, sourceId, lang, newId);
  await storeImageTranslationMap_Updater_(tripRecId, map);
  if (imageRole) {
    log(String(imageRole).toUpperCase() + ' IMAGE ATTACHMENT CREATED (' + lang + '): ' + newId);
  }
  log('NEW OBJECT CREATED BECAUSE NO EXISTING TARGET FOUND (attachment ' + lang + '): ' + sourceId + ' -> ' + newId)
  return { id: newId, status: 'new', role: imageRole || '' };
}

async function ensureTranslatedAttachmentId_Updater_(tripRecId, map, sourceId, lang, imageRole) {
  var res = await ensureTranslatedAttachmentWithStatus_Updater_(tripRecId, map, sourceId, lang, imageRole);
  return res && res.id ? res.id : null;
}

function formatImageMapSummary_Updater_(lang, featuredEntry, galleryEntries) {
  var l = String(lang || '').toLowerCase();
  var parts = [];
  if (featuredEntry && featuredEntry.src && featuredEntry.id) {
    parts.push('featured: ' + featuredEntry.src + ' -> ' + featuredEntry.id + ' [' + (featuredEntry.status || '') + ']');
  }
  if (galleryEntries && galleryEntries.length) {
    var g = galleryEntries.map(function(e) {
      return String(e.src) + ' -> ' + String(e.id) + ' [' + String(e.status || '') + ']';
    }).join(', ');
    parts.push('gallery: ' + g);
  }
  return 'IMAGE MAP SUMMARY (' + l + '): ' + parts.join(' | ');
}

function formatTranslatedImageSetSummary_Updater_(lang, tripWpId, featuredId, galleryCount) {
  var l = String(lang || '').toLowerCase();
  return 'TRANSLATED IMAGE SET SUMMARY (' + l + '): trip=' + String(tripWpId) + ' featured=' + String(featuredId || '') + ' gallery_count=' + String(galleryCount || 0);
}

async function getMediaFromWordPress_Updater_(mediaId) {
  var baseUrl = CONFIG.WP_API_BASE;
  var rootUrl = baseUrl;
  if (baseUrl.indexOf('/wp-json/') !== -1) {
    rootUrl = baseUrl.split('/wp-json/')[0];
  } else {
    log('Updater: Warning - Could not determine WP root URL from ' + baseUrl);
    return null;
  }

  var mediaUrl = rootUrl + '/wp-json/wp/v2/media/' + mediaId;
  var options = {
    method: 'get',
    headers: {
      'Authorization': 'Basic ' + base64Encode(CONFIG.WP_API_USER + ':' + CONFIG.WP_API_PASS)
    },
    muteHttpExceptions: true
  };

  var resp = await fetchUrl(mediaUrl, options);
  if (resp.getResponseCode() !== 200) return null;
  return JSON.parse(resp.getContentText());
}

function stripHtmlToText_Updater_(html) {
  var s = String(html || '');
  if (!s) return '';
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeTitleForDedupe_Updater_(text) {
  var s = stripHtmlToText_Updater_(text)
  if (!s) return ''
  s = s.replace(/[\u2600-\u27BF]|[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ' ')
  s = s.replace(/[^A-Za-z0-9\s\u00C0-\u024F\u0400-\u04FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]+/g, ' ')
  s = s.replace(/\s+/g, ' ').trim().toLowerCase()
  return s
}

function isNearDuplicateTitle_Updater_(a, b) {
  var x = normalizeTitleForDedupe_Updater_(a)
  var y = normalizeTitleForDedupe_Updater_(b)
  if (!x || !y) return false
  if (x === y) return true
  if (x.length < 8 || y.length < 8) return false
  if (x.indexOf(y) !== -1 && y.length >= Math.floor(x.length * 0.75)) return true
  if (y.indexOf(x) !== -1 && x.length >= Math.floor(y.length * 0.75)) return true
  return false
}

function dedupeRepeatedSectionIntroFromHtml_Updater_(sectionTitle, bodyHtml) {
  var title = String(sectionTitle || '').trim()
  var html = String(bodyHtml || '')
  if (!title || !html) return html

  var out = html

  var headingRe = /^\s*<(h[2-4])[^>]*>([\s\S]*?)<\/\1>\s*/i
  var mh = out.match(headingRe)
  if (mh) {
    var headingText = stripHtmlToText_Updater_(mh[2])
    if (isNearDuplicateTitle_Updater_(headingText, title)) {
      out = out.replace(headingRe, '')
    }
  }

  var pRe = /^\s*<p[^>]*>([\s\S]*?)<\/p>\s*/i
  var mp = out.match(pRe)
  if (mp) {
    var pText = stripHtmlToText_Updater_(mp[1])
    if (isNearDuplicateTitle_Updater_(pText, title)) {
      out = out.replace(pRe, '')
    }
  } else {
    var firstLine = out.replace(/^\s+/, '').split(/\r?\n|<br\s*\/?>/i)[0]
    var lineText = stripHtmlToText_Updater_(firstLine)
    if (isNearDuplicateTitle_Updater_(lineText, title)) {
      out = out.replace(/^\s*[\s\S]*?(?:\r?\n|<br\s*\/?>)/i, '')
    }
  }

  out = out.replace(/^\s+/, '')
  return out
}

function buildMediaMetaFromWpResponse_Updater_(mediaJson) {
  if (!mediaJson) return null;
  var title = mediaJson.title && mediaJson.title.rendered ? stripHtmlToText_Updater_(mediaJson.title.rendered) : '';
  var caption = mediaJson.caption && mediaJson.caption.rendered ? stripHtmlToText_Updater_(mediaJson.caption.rendered) : '';
  var description = mediaJson.description && mediaJson.description.rendered ? stripHtmlToText_Updater_(mediaJson.description.rendered) : '';
  var alt = mediaJson.alt_text ? String(mediaJson.alt_text).trim() : '';
  return { alt: alt, title: title, caption: caption, description: description };
}

function buildEnglishImageMetaMapFromTripInfo_Updater_(sourceTripInfo) {
  var map = {};
  var trip = sourceTripInfo || {};

  function add(id, meta) {
    if (!id) return;
    var key = String(id);
    var m = meta || {};
    map[key] = {
      alt: String(m.alt || '').trim(),
      title: String(m.title || '').trim(),
      caption: String(m.caption || '').trim(),
      description: String(m.description || '').trim()
    };
  }

  if (trip.featured_image && trip.featured_image.id) {
    add(trip.featured_image.id, {
      title: trip.featured_image.title || '',
      caption: trip.featured_image.caption || '',
      alt: trip.featured_image.alt || ''
    });
  }

  if (trip.gallery && Array.isArray(trip.gallery)) {
    trip.gallery.forEach(function(img) {
      if (!img || !img.id) return;
      add(img.id, {
        title: img.title || '',
        caption: img.caption || '',
        alt: img.alt || ''
      });
    });
  }

  return map;
}

function buildTripImagesMetaPayloadFromAttachmentIds_Updater_(featuredId, galleryIds) {
  var payload = { meta: {} };
  if (featuredId) payload.meta._thumbnail_id = String(featuredId);

  var ids = (galleryIds || []).map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x; });
  if (featuredId) {
    ids = ids.filter(function(x) { return x !== String(featuredId); });
  }
  if (ids.length) {
    var out = { enable: "1" };
    ids.forEach(function(id, idx) { out[String(idx)] = id; });
    payload.meta.wpte_gallery_id = out;
  }
  return payload;
}

async function translateImageMetadata_Updater_(meta, targetLang) {
  var m = meta || {};
  var alt = String(m.alt || '').trim();
  var title = String(m.title || '').trim();
  var caption = String(m.caption || '').trim();
  var description = String(m.description || '').trim();
  if (!alt && !title && !caption && !description) return null;

  var lang = String(targetLang || '').toLowerCase();
  var prompt =
    "You are an expert in Travel SEO and Multilingual Content Localization.\n\n" +
    "CRITICAL RULES:\n" +
    "1) TARGET LANGUAGE ONLY\n" +
    "You MUST return the result ONLY in the target language: " + lang + ".\n" +
    "Never output any other language.\n\n" +
    "2) CONTENT INTEGRITY\n" +
    "- Keep meaning identical.\n" +
    "- Keep proper nouns (places/brands) unchanged.\n" +
    "- Do not add new facts.\n\n" +
    "3) SEO\n" +
    "- Make the phrasing natural and image-SEO friendly.\n\n" +
    "FIELD RULES:\n" +
    "- alt: short descriptive phrase (8–15 words).\n" +
    "- title: short descriptive image title.\n" +
    "- caption: natural sentence.\n" +
    "- description: longer SEO description of the image.\n\n" +
    "SAFE OUTPUT:\n" +
    "Return ONLY valid JSON with this exact shape:\n" +
    "{ \"alt\": \"...\", \"title\": \"...\", \"caption\": \"...\", \"description\": \"...\" }\n\n" +
    "INPUT JSON:\n" + JSON.stringify({ alt: alt, title: title, caption: caption, description: description });

  var res = await callAiForTargetLangWithRetry_Updater_(prompt, lang);
  if (!res || typeof res !== 'object' || Array.isArray(res)) return null;

  var out = {
    alt: String(res.alt || alt).trim(),
    title: String(res.title || title).trim(),
    caption: String(res.caption || caption).trim(),
    description: String(res.description || description).trim()
  };

  if (out.alt) {
    var words = out.alt.split(/\s+/).filter(function(w) { return !!w; });
    if (words.length > 15) out.alt = words.slice(0, 15).join(' ').trim();
  }
  if (out.alt.length > 125) out.alt = out.alt.substring(0, 125).trim();
  if (out.title.length > 60) out.title = out.title.substring(0, 60).trim();
  if (out.caption.length > 150) out.caption = out.caption.substring(0, 150).trim();
  if (out.description.length > 300) out.description = out.description.substring(0, 300).trim();

  return out;
}

async function translateImageMetadataForLanguage_Updater_(imageMeta, targetLang, seoData, imageRole, opts) {
  var lang = String(targetLang || '').toLowerCase();
  var role = String(imageRole || '').toLowerCase();
  var meta = imageMeta || {};
  var ctx = opts || {};

  var primary = '';
  var secondary = [];
  if (seoData) {
    primary = String(seoData.primary || seoData.primary_keyword || '').trim();
    if (seoData.secondary && Array.isArray(seoData.secondary)) secondary = seoData.secondary;
    if (seoData.secondary_keywords && Array.isArray(seoData.secondary_keywords)) secondary = seoData.secondary_keywords;
  }
  primary = String(primary || '').trim();
  secondary = (secondary || []).map(function(s) { return String(s || '').trim(); }).filter(function(s) { return !!s; });
  if (secondary.length > 4) secondary = secondary.slice(0, 4);

  var preferredKeyword = String(ctx.preferredKeyword || '').trim();

  var input = {
    title: String(meta.title || '').trim(),
    caption: String(meta.caption || '').trim(),
    alt: String(meta.alt || '').trim(),
    description: String(meta.description || '').trim()
  };
  if (!input.title && !input.caption && !input.alt && !input.description) return null;

  var prompt =
    "You are generating localized image metadata for a travel website.\n\n" +
    "CRITICAL RULES:\n" +
    "1) TARGET LANGUAGE ONLY\n" +
    "You MUST return the result ONLY in the target language: " + lang + ".\n" +
    "Never output any other language.\n\n" +
    "2) CONTENT INTEGRITY\n" +
    "- Keep meaning identical.\n" +
    "- Do not change the visual meaning of the image.\n" +
    "- Preserve place names and trip context.\n" +
    "- Preserve activity names.\n" +
    "- Do not add new facts.\n\n" +
    "3) NATURAL SEO (NO STUFFING)\n" +
    "- Keywords are SEMANTIC GUIDANCE only. Do NOT copy-paste long keyword phrases.\n" +
    "- Avoid route-style phrases in title/alt (equivalent of: 'from', 'to', 'day tours').\n" +
    "- Do NOT add fixed suffixes like the equivalent of 'Part of ...' or 'Included in ...'.\n" +
    "- Do NOT output comma-separated keyword lists.\n" +
    "- Distribute mentions: title 0–1 keyword, alt 0–1 keyword, caption 0–1 keyword, description 1–2 mentions total.\n" +
    "- Preferred keyword for this image (use ONLY if it fits naturally): " + (preferredKeyword ? preferredKeyword : "(none)") + "\n\n" +
    "FIELD RULES:\n" +
    "- alt: visual-first, short descriptive phrase (8–15 words).\n" +
    "- title: short descriptive image title.\n" +
    "- caption: natural sentence.\n" +
    "- description: 2–3 sentences, natural, no stuffing.\n\n" +
    "CONTEXT:\n" +
    "image_role: " + role + "\n" +
    "trip_title: " + String(ctx.tripTitle || '') + "\n" +
    "location: " + String(ctx.location || '') + "\n" +
    "main_activity: " + String(ctx.activity || '') + "\n" +
    "primary_keyword: " + primary + "\n" +
    "secondary_keywords: " + JSON.stringify(secondary) + "\n\n" +
    "SAFE OUTPUT:\n" +
    "Return ONLY valid JSON with this exact shape:\n" +
    "{ \"title\": \"...\", \"caption\": \"...\", \"alt\": \"...\", \"description\": \"...\" }\n\n" +
    "ENGLISH SOURCE IMAGE METADATA (already optimized):\n" + JSON.stringify(input);

  var res = await callAiForTargetLangWithRetry_Updater_(prompt, lang);
  if (!res || typeof res !== 'object' || Array.isArray(res)) return null;

  var out = {
    title: String(res.title || input.title).trim(),
    caption: String(res.caption || input.caption).trim(),
    alt: String(res.alt || input.alt).trim(),
    description: String(res.description || input.description).trim()
  };

  if (out.alt) {
    var words = out.alt.split(/\s+/).filter(function(w) { return !!w; });
    if (words.length > 15) out.alt = words.slice(0, 15).join(' ').trim();
  }
  if (out.alt.length > 125) out.alt = out.alt.substring(0, 125).trim();
  if (out.title.length > 60) out.title = out.title.substring(0, 60).trim();
  if (out.caption.length > 150) out.caption = out.caption.substring(0, 150).trim();
  if (out.description.length > 300) out.description = out.description.substring(0, 300).trim();

  function norm_(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function lc_(s) { return norm_(s).toLowerCase(); }
  function wordCount_(s) { var x = norm_(s); return x ? x.split(' ').filter(function(w) { return !!w; }).length : 0; }
  function contains_(text, phrase) { return !!phrase && lc_(text).indexOf(lc_(phrase)) !== -1; }
  function isGenericKw_(phrase) {
    var x = lc_(phrase);
    if (!x) return true;
    if (x === 'tour' || x === 'tours' || x === 'day tour' || x === 'day tours') return true;
    return false;
  }
  function isRouteyKw_(phrase) {
    var x = lc_(phrase);
    if (!x) return false;
    if (/\bfrom\b|\bto\b/.test(x)) return true;
    if (/\bday\s+tours?\b/.test(x)) return true;
    return false;
  }
  function isAltKeywordOk_(phrase) {
    var x = norm_(phrase);
    if (!x) return false;
    if (isGenericKw_(x)) return false;
    if (isRouteyKw_(x)) return false;
    if (x.length > 28) return false;
    if (wordCount_(x) > 4) return false;
    return true;
  }
  function prepositionForLang_(langCode) {
    var l = String(langCode || '').toLowerCase().split('-')[0];
    if (l === 'ar') return 'في';
    if (l === 'fr') return 'à';
    if (l === 'es') return 'en';
    if (l === 'it') return 'a';
    if (l === 'de') return 'in';
    if (l === 'ru') return 'в';
    if (l === 'pt') return 'em';
    if (l === 'nl') return 'in';
    return '';
  }
  function fitWithSuffix_(base, suffix, maxLen) {
    var b = norm_(base);
    var s = norm_(suffix);
    if (!b) return '';
    if (!s) return b.length <= maxLen ? b : b.substring(0, maxLen).trim();
    var out2 = (b + ' ' + s).replace(/\s+/g, ' ').trim();
    if (out2.length <= maxLen) return out2;
    return '';
  }

  if (role === 'featured') {
    var altKeyword = '';
    if (preferredKeyword && isAltKeywordOk_(preferredKeyword)) altKeyword = preferredKeyword;
    else if (primary && isAltKeywordOk_(primary)) altKeyword = primary;
    else {
      for (var sk = 0; sk < secondary.length; sk++) {
        if (secondary[sk] && isAltKeywordOk_(secondary[sk])) { altKeyword = secondary[sk]; break; }
      }
    }

    if (altKeyword) {
      log('FEATURED ALT KEYWORD SELECTED (' + lang + '): ' + altKeyword);
      if (!contains_(out.alt, altKeyword)) {
        var prep = prepositionForLang_(lang);
        var suffix = prep ? (prep + ' ' + altKeyword) : altKeyword;
        var alt2 = fitWithSuffix_(out.alt || 'Travel photo', suffix, 125);
        if (alt2) {
          out.alt = alt2;
          log('FEATURED ALT KEYWORD INCLUDED (' + lang + '): ' + altKeyword);
        } else {
          log('FEATURED ALT KEYWORD SKIPPED (NO ROOM) (' + lang + '): ' + altKeyword);
        }
      } else {
        log('FEATURED ALT KEYWORD ALREADY PRESENT (' + lang + '): ' + altKeyword);
      }
    } else {
      log('FEATURED ALT KEYWORD SKIPPED (NOT SUITABLE) (' + lang + ')');
    }
  }

  var purity = validateSingleLanguagePurity_Updater_(lang, {
    title: out.title,
    caption: out.caption,
    alt: out.alt,
    description: out.description
  })
  if (!purity.ok) {
    log('LANGUAGE CONTAMINATION DETECTED (' + lang + '): image_metadata ' + JSON.stringify(purity.contaminated))
    log('REGENERATING CONTAMINATED FIELD: image_metadata (' + lang + ')')
    var forbid =
      "- Do NOT use Turkish words (kahire, turu, turları, mısır) or Turkish characters.\n" +
      "- Do NOT use English phrases like 'day tours', 'Egyptian Museum Cairo', 'cairo museum'.\n"
    var prompt2 =
      "You are an expert in Travel SEO and Multilingual Content Localization.\n\n" +
      "CRITICAL RULES:\n" +
      "1) TARGET LANGUAGE ONLY\n" +
      "You MUST return the result ONLY in the target language: " + lang + ".\n" +
      "Never output any other language.\n\n" +
      "FORBIDDEN (STRICT):\n" + forbid + "\n" +
      "2) CONTENT INTEGRITY\n" +
      "- Keep meaning identical.\n" +
      "- Do not change the visual meaning of the image.\n" +
      "- Preserve place names and trip context.\n" +
      "- Do not add new facts.\n\n" +
      "3) SEO KEYWORDS\n" +
      "- Do NOT keyword stuff.\n" +
      "- Preferred keyword to use for this image when possible: " + (preferredKeyword ? preferredKeyword : "(none)") + "\n\n" +
      "SAFE OUTPUT:\n" +
      "Return ONLY valid JSON with this exact shape:\n" +
      "{ \"title\": \"...\", \"caption\": \"...\", \"alt\": \"...\", \"description\": \"...\" }\n\n" +
      "ENGLISH SOURCE IMAGE METADATA:\n" + JSON.stringify(input) + "\n\n" +
      "CONTEXT:\n" +
      "image_role: " + role + "\n" +
      "trip_title: " + String(ctx.tripTitle || '') + "\n" +
      "location: " + String(ctx.location || '') + "\n" +
      "main_activity: " + String(ctx.activity || '') + "\n" +
      "primary_keyword: " + primary + "\n" +
      "secondary_keywords: " + JSON.stringify(secondary) + "\n"
    var res2 = await callAiForTargetLangWithRetry_Updater_(prompt2, lang)
    if (res2 && typeof res2 === 'object' && !Array.isArray(res2)) {
      out.title = String(res2.title || out.title).trim()
      out.caption = String(res2.caption || out.caption).trim()
      out.alt = String(res2.alt || out.alt).trim()
      out.description = String(res2.description || out.description).trim()
      log('IMAGE METADATA LANGUAGE PURITY FIXED (' + lang + ')')
    }
  } else {
    log('TARGET LANGUAGE PURITY PASSED (' + lang + '): image_metadata')
  }

  return out;
}

function parseFocusKeywordsString_Updater_(focusKeywords) {
  var raw = String(focusKeywords || '').trim();
  if (!raw) return { primary: '', secondary: [] };
  var parts = raw.split(',').map(function(s) { return String(s || '').trim(); }).filter(function(s) { return !!s; });
  var seen = {};
  var uniq = [];
  parts.forEach(function(s) {
    var key = s.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    uniq.push(s);
  });
  return { primary: uniq[0] || '', secondary: uniq.slice(1, 5) };
}

function pickTripLocationNameFromTripInfo_Updater_(tripInfo) {
  var d = tripInfo || {};
  if (d.taxonomies && typeof d.taxonomies === 'object') {
    var candidates = ['destination', 'destinations', 'trip_location', 'trip_locations', 'location', 'tour_location', 'tour_locations'];
    for (var i = 0; i < candidates.length; i++) {
      var key = candidates[i];
      if (d.taxonomies[key] && d.taxonomies[key].length && d.taxonomies[key][0] && d.taxonomies[key][0].name) {
        return String(d.taxonomies[key][0].name).trim();
      }
    }
  }
  return '';
}

function buildImageSeoContext_Updater_(opts) {
  var o = opts || {};
  var lang = String(o.lang || '').toLowerCase();
  var tripTitle = String(o.tripTitle || '').trim();
  var location = String(o.location || '').trim();
  var activity = String(o.activity || '').trim();

  var rawPrimary = '';
  var rawSecondary = [];
  if (o.seoData) {
    rawPrimary = String(o.seoData.primary || o.seoData.primary_keyword || '').trim();
    if (o.seoData.secondary && Array.isArray(o.seoData.secondary)) rawSecondary = o.seoData.secondary;
    if (o.seoData.secondary_keywords && Array.isArray(o.seoData.secondary_keywords)) rawSecondary = o.seoData.secondary_keywords;
  }
  rawPrimary = String(rawPrimary || '').trim();
  rawSecondary = (rawSecondary || []).map(function(s) { return String(s || '').trim(); }).filter(function(s) { return !!s; });

  var primary = '';
  var secondary = [];
  var targetExtracted = null;
  if (o.focusKeywordsString) targetExtracted = extractKeywordsForTargetLanguage_Updater_(o.focusKeywordsString, lang);
  if (targetExtracted && targetExtracted.primary) {
    var targetAll = (targetExtracted.all || []).map(function(s) { return String(s || '').trim(); }).filter(function(s) { return !!s; });
    var allow = {};
    targetAll.forEach(function(k) { allow[String(k || '').toLowerCase()] = true; });
    var rawPool = [rawPrimary].concat(rawSecondary || []).map(function(s) { return String(s || '').trim(); }).filter(function(s) { return !!s; });
    rawPool.forEach(function(k) {
      var kk = String(k || '').toLowerCase();
      if (!allow[kk]) log('CROSS-LANGUAGE IMAGE KEYWORD REMOVED: "' + String(k || '') + '" from ' + lang);
    });
    primary = targetExtracted.primary;
    secondary = targetExtracted.secondary || [];
    log('IMAGE KEYWORD POOL SOURCE: target_bucket_only (' + lang + ')');
    log('IMAGE KEYWORD POOL PURIFIED: ' + JSON.stringify(targetAll.slice(0, 12)) + (targetAll.length > 12 ? (' (+ ' + (targetAll.length - 12) + ' more)') : ''));
  } else {
    var pool = [rawPrimary].concat(rawSecondary || []).map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x; });
    if (pool.length) {
      var extractedPool = extractKeywordsForTargetLanguage_Updater_(pool, lang);
      if (extractedPool) {
        primary = extractedPool.primary;
        secondary = extractedPool.secondary;
        log('IMAGE SEO KEYWORD POOL FILTERED (' + lang + '): ' + JSON.stringify(extractedPool.all.slice(0, 12)) + (extractedPool.all.length > 12 ? (' (+ ' + (extractedPool.all.length - 12) + ' more)') : ''));
      } else {
        primary = '';
        secondary = [];
        log('IMAGE SEO KEYWORD POOL FILTERED (' + lang + '): []');
      }
    } else {
      log('IMAGE SEO KEYWORD POOL FILTERED (' + lang + '): []');
    }
  }

  if (secondary.length > 4) secondary = secondary.slice(0, 4);
  return { lang: lang, tripTitle: tripTitle, location: location, activity: activity, primary: primary, secondary: secondary };
}

async function generateLocalizedImageMetadata_Updater_(imageMeta, seoContext, lang, imageRole, keywordToUse) {
  var role = String(imageRole || '').toLowerCase();
  var m = imageMeta || {};
  var input = {
    title: String(m.title || '').trim(),
    caption: String(m.caption || '').trim(),
    alt: String(m.alt || '').trim(),
    description: String(m.description || '').trim()
  };
  if (!input.title && !input.caption && !input.alt && !input.description) return null;

  var ctx = seoContext || {};
  var primary = String(ctx.primary || '').trim();
  var secondary = (ctx.secondary || []).map(function(s) { return String(s || '').trim(); }).filter(function(s) { return !!s; });
  var useKw = String(keywordToUse || (role === 'featured' ? primary : '') || '').trim();

  var prompt =
    "You are generating localized image metadata for a travel website.\n\n" +
    "CRITICAL RULES:\n" +
    "1) TARGET LANGUAGE ONLY\n" +
    "You MUST return the result ONLY in the target language: " + lang + ".\n" +
    "Never output any other language.\n\n" +
    "2) CONTENT INTEGRITY\n" +
    "- Keep meaning identical.\n" +
    "- Preserve location names and activity names.\n" +
    "- Do not add new facts.\n\n" +
    "3) NATURAL SEO (NO STUFFING)\n" +
    "- Keywords are SEMANTIC GUIDANCE only. Do NOT copy-paste long keyword phrases.\n" +
    "- Avoid route-style phrases in title/alt (equivalent of: 'from', 'to', 'day tours').\n" +
    "- Do NOT add fixed suffixes like the equivalent of 'Part of ...' or 'Included in ...'.\n" +
    "- Do NOT output comma-separated keyword lists.\n" +
    "- Preferred keyword for this image (use ONLY if it fits naturally): " + (useKw ? useKw : "(none)") + "\n\n" +
    "FIELD RULES:\n" +
    "- alt: visual-first, short descriptive phrase (8–15 words).\n" +
    "- title: short descriptive image title.\n" +
    "- caption: natural sentence.\n" +
    "- description: 2–3 sentences, natural, no stuffing.\n\n" +
    "CONTEXT:\n" +
    "image_role: " + role + "\n" +
    "trip_title: " + String(ctx.tripTitle || '') + "\n" +
    "location: " + String(ctx.location || '') + "\n" +
    "activity: " + String(ctx.activity || '') + "\n" +
    "primary_keyword: " + primary + "\n" +
    "secondary_keywords: " + JSON.stringify(secondary) + "\n\n" +
    "SAFE OUTPUT:\n" +
    "Return ONLY valid JSON with this exact shape:\n" +
    "{ \"title\": \"...\", \"caption\": \"...\", \"alt\": \"...\", \"description\": \"...\" }\n\n" +
    "ORIGINAL IMAGE METADATA:\n" + JSON.stringify(input);

  var res = await callAiForTargetLangWithRetry_Updater_(prompt, lang);
  if (!res || typeof res !== 'object' || Array.isArray(res)) return null;

  var out = {
    title: String(res.title || input.title).trim(),
    caption: String(res.caption || input.caption).trim(),
    alt: String(res.alt || input.alt).trim(),
    description: String(res.description || input.description).trim()
  };

  if (out.alt) {
    var words = out.alt.split(/\s+/).filter(function(w) { return !!w; });
    if (words.length > 15) out.alt = words.slice(0, 15).join(' ').trim();
  }
  if (out.alt.length > 125) out.alt = out.alt.substring(0, 125).trim();
  if (out.title.length > 60) out.title = out.title.substring(0, 60).trim();
  if (out.caption.length > 150) out.caption = out.caption.substring(0, 150).trim();
  if (out.description.length > 300) out.description = out.description.substring(0, 300).trim();

  return out;
}

function collectSourceTripImageIds_Updater_(sourceTripInfo) {
  var ids = [];
  var featuredId = null;
  if (sourceTripInfo && sourceTripInfo.featured_image && sourceTripInfo.featured_image.id) {
    featuredId = String(sourceTripInfo.featured_image.id);
    ids.push(featuredId);
  }
  if (sourceTripInfo && sourceTripInfo.gallery && Array.isArray(sourceTripInfo.gallery)) {
    sourceTripInfo.gallery.forEach(function(img) {
      if (img && img.id) ids.push(String(img.id));
    });
  }
  var meta = sourceTripInfo && sourceTripInfo.meta ? sourceTripInfo.meta : {};
  var galObj = meta.wpte_gallery_id;
  if (Array.isArray(galObj)) galObj = galObj[0];
  if (typeof galObj === 'string') {
    var trimmed = galObj.trim();
    if (trimmed && trimmed.charAt(0) === '{') {
      try { galObj = JSON.parse(trimmed); } catch (e) {}
    }
  }
  if (galObj && typeof galObj === 'object') {
    for (var k in galObj) {
      if (!galObj.hasOwnProperty(k)) continue;
      if (k === 'enable') continue;
      var v = galObj[k];
      if (Array.isArray(v)) v = v[0];
      if (!v) continue;
      ids.push(String(v));
    }
  }
  var seen = {};
  var uniq = [];
  ids.forEach(function(id) {
    var s = String(id || '').trim();
    if (!s) return;
    if (seen[s]) return;
    seen[s] = true;
    uniq.push(s);
  });
  return { featuredId: featuredId, galleryIds: uniq.filter(function(x) { return !featuredId || x !== featuredId; }), allIds: uniq };
}

function enforceCanonicalMuseumFamilyFidelityInImageMetadata_Updater_(translatedMeta, targetLang, spec) {
  var lang = String(targetLang || '').toLowerCase()
  var s = spec || {}
  var fam = s.landmark_canonical_museum_family ? String(s.landmark_canonical_museum_family).toLowerCase() : ''
  if (fam !== 'civilization') return translatedMeta
  var civ = localizeForbiddenEnglishPhraseForLang_Updater_('civilization museum', lang)
  if (!civ) return translatedMeta

  var out = translatedMeta || {}
  function norm_(x) { return normalizeForSpecMatch_Updater_(String(x || '')) }
  function hasCiv_(x) { return textContainsAnyMarker_Updater_(String(x || ''), getCivilizationMuseumMarkersForLang_Updater_(lang).concat([civ, 'NMEC'])) }

  var egypt = localizeForbiddenEnglishPhraseForLang_Updater_('egyptian museum', lang)
  if (!egypt) egypt = 'egyptian museum'

  function fixField_(val) {
    var t = String(val || '').trim()
    if (!t) return t
    if (hasCiv_(t)) return t
    if (/\begyptian\s+museum\b/i.test(t)) {
      t = t.replace(/\begyptian\s+museum\b/ig, civ).trim()
      log('IMAGE ENTITY FIDELITY FIXED (' + lang + '): english_egyptian_museum -> civilization_museum')
      return t
    }
    if (egypt && new RegExp('\\b' + escapeRegex_Updater_(egypt) + '\\b', 'i').test(t)) {
      t = t.replace(new RegExp(escapeRegex_Updater_(egypt), 'ig'), civ).trim()
      log('IMAGE ENTITY FIDELITY FIXED (' + lang + '): localized_egyptian_museum -> civilization_museum')
      return t
    }
    if (/(?:ägyptisch|aegyptisch)\w*\s+museum/i.test(t)) {
      t = t.replace(/(?:ägyptisch|aegyptisch)\w*\s+museum/ig, civ).trim()
      log('IMAGE ENTITY FIDELITY FIXED (' + lang + '): aegyptisch* museum -> civilization_museum')
      return t
    }
    var n = norm_(t)
    var eNorm = norm_(egypt)
    if (eNorm && n.indexOf(eNorm) !== -1) {
      t = t.replace(new RegExp(escapeRegex_Updater_(egypt), 'ig'), civ).trim()
      log('IMAGE ENTITY FIDELITY FIXED (' + lang + '): egyptian_museum -> civilization_museum')
      return t
    }
    if (n.indexOf('egyptian museum') !== -1) {
      t = t.replace(/egyptian\s+museum/ig, civ).trim()
      log('IMAGE ENTITY FIDELITY FIXED (' + lang + '): English egyptian museum -> civilization_museum')
      return t
    }
    return t
  }

  out.title = fixField_(out.title)
  out.alt = fixField_(out.alt)
  out.caption = fixField_(out.caption)
  out.description = fixField_(out.description)

  out.title = finalizePublishText_Updater_(out.title, 90, lang, 'title')
  out.alt = finalizePublishText_Updater_(out.alt, 125, lang, 'alt')
  out.caption = finalizePublishText_Updater_(out.caption, 160, lang, 'caption')
  out.description = finalizePublishText_Updater_(out.description, 240, lang, 'description')
  return out
}

async function localizeTripImagesMetadataForLang_Updater_(sourceTripInfo, targetLang, opts) {
  var lang = String(targetLang || '').toLowerCase();
  if (!lang || lang === 'en') return;

  log('TRANSLATING IMAGE METADATA FOR LANGUAGE: ' + lang);

  var englishMap = buildEnglishImageMetaMapFromTripInfo_Updater_(sourceTripInfo);
  var images = collectSourceTripImageIds_Updater_(sourceTripInfo);
  if (!images || !images.allIds || images.allIds.length === 0) return;

  var o = opts || {};
  var attachmentIdMap = o.attachmentIdMap && typeof o.attachmentIdMap === 'object' ? o.attachmentIdMap : null;
  var ctx = buildImageSeoContext_Updater_({
    lang: lang,
    seoData: o.seoData || null,
    focusKeywordsString: o.focusKeywordsString || '',
    tripTitle: o.tripTitle || '',
    location: o.location || '',
    activity: o.activity || ''
  });

  if (o.tripFields) {
    var fromList = selectKeywordsFromSeoFocusKeywordsListForLang_Updater_(o.tripFields, lang);
    if (fromList && fromList.primary) {
      var purified = enforceKeywordsTargetLanguagePurity_Updater_(fromList, lang, { primary: '', secondary: [] });
      if (purified && purified.primary) {
        ctx.primary = purified.primary;
        ctx.secondary = (purified.secondary || []).map(function(s) { return String(s || '').trim(); }).filter(function(s) { return !!s; });
        log('IMAGE KEYWORD POOL SOURCE: target_bucket_only (' + lang + ')');
        log('IMAGE KEYWORD POOL PURIFIED: ' + JSON.stringify([ctx.primary].concat(ctx.secondary || []).slice(0, 12)));
      } else {
        log('LANGUAGE CONTAMINATION DETECTED (' + lang + '): image_keyword_list_override_skipped');
      }
    }
  }

  if (!ctx.location && o.tripInfo) {
    ctx.location = pickTripLocationNameFromTripInfo_Updater_(o.tripInfo);
  }

  var galleryRotation = [];
  if (ctx.secondary && ctx.secondary.length) {
    ctx.secondary.forEach(function(k) { galleryRotation.push(k); });
  } else if (ctx.primary) {
    galleryRotation.push(ctx.primary);
  }

  var processed = {};
  for (var ii = 0; ii < images.allIds.length; ii++) {
    var id = images.allIds[ii];
    var sourceId = String(id);
    var targetId = attachmentIdMap && attachmentIdMap[sourceId] ? String(attachmentIdMap[sourceId]) : sourceId;
    var key = lang + ':' + targetId;
    if (processed[key]) continue;
    processed[key] = true;

    var role = (images.featuredId && String(images.featuredId) === sourceId) ? 'featured' : 'gallery';
    var keywordToUse = '';
    if (role === 'featured') {
      keywordToUse = ctx.primary;
      if (ctx.primary) log('FEATURED IMAGE SEO KEYWORD USED (' + lang + '): ' + ctx.primary);
    } else if (galleryRotation.length) {
      var idx = images.galleryIds ? images.galleryIds.indexOf(sourceId) : -1;
      if (idx < 0) idx = 0;
      keywordToUse = galleryRotation[idx % galleryRotation.length];
      if (keywordToUse && ctx.primary && keywordToUse.toLowerCase() !== ctx.primary.toLowerCase()) {
        log('GALLERY IMAGE SEO KEYWORD USED (' + lang + '): ' + keywordToUse);
      } else if (keywordToUse) {
        log('GALLERY IMAGE SEO KEYWORD USED (' + lang + '): ' + keywordToUse);
      }
    }

    var mediaJson = null;
    try { mediaJson = await getMediaFromWordPress_Updater_(targetId); } catch (e) {}
    var current = buildMediaMetaFromWpResponse_Updater_(mediaJson);
    if (!current) continue;

    var hasEmptyFields = !current.alt || !current.title || !current.caption || !current.description;
    if (hasEmptyFields) {
      log('IMAGE METADATA INCOMPLETE (' + lang + '): ' + targetId + ' — will re-translate (alt: ' + (current.alt ? 'OK' : 'EMPTY') + ', title: ' + (current.title ? 'OK' : 'EMPTY') + ')');
    }

    var detectSample = [current.alt, current.title, current.caption, current.description].join(' ').trim();
    var detected = detectLanguageSafe_Updater_(detectSample);
    var keywordMissing = false;
    if (keywordToUse && role === 'featured') {
      var kw = String(keywordToUse || '').trim();
      var kwLow = kw.toLowerCase();
      var tooRoutey = /\bfrom\b|\bto\b/.test(kwLow) || /\bday\s+tours?\b/.test(kwLow) || /\btours?\b/.test(kwLow);
      var tooLong = kw.length > 28 || kw.split(/\s+/).filter(function(w) { return !!w; }).length > 4;
      if (!tooRoutey && !tooLong) {
        keywordMissing = current.alt.toLowerCase().indexOf(kwLow) === -1;
      }
    }
    if (!hasEmptyFields && detected && langMatchesOrBase_Updater_(detected, lang) && !keywordMissing) continue;

    var sourceEn = englishMap[sourceId] || null;
    if (!sourceEn || !sourceEn.title || !sourceEn.caption || !sourceEn.alt || !sourceEn.description) {
      var srcMediaJson = null;
      try { srcMediaJson = await getMediaFromWordPress_Updater_(sourceId); } catch (eSrc) {}
      var srcMeta = buildMediaMetaFromWpResponse_Updater_(srcMediaJson);
      if (srcMeta) {
        if (!sourceEn) {
          sourceEn = srcMeta;
        } else {
          if (!sourceEn.title && srcMeta.title) sourceEn.title = srcMeta.title;
          if (!sourceEn.caption && srcMeta.caption) sourceEn.caption = srcMeta.caption;
          if (!sourceEn.alt && srcMeta.alt) sourceEn.alt = srcMeta.alt;
          if (!sourceEn.description && srcMeta.description) sourceEn.description = srcMeta.description;
        }
      }
    }
    if (!sourceEn) {
      sourceEn = current;
    } else if (!sourceEn.description && current && current.description) {
      sourceEn.description = current.description;
    }
    var translated = await translateImageMetadataForLanguage_Updater_(sourceEn, lang, ctx, role, {
      preferredKeyword: keywordToUse,
      tripTitle: ctx.tripTitle,
      location: ctx.location,
      activity: ctx.activity
    });
    if (!translated) continue;
    translated = enforceCanonicalMuseumFamilyFidelityInImageMetadata_Updater_(translated, lang, o.specConstraints || null)
    log('IMAGE METADATA TRANSLATED (' + lang + '): ' + targetId);

    await throttleMediaItem_Updater_('update media ' + targetId)
    await updateMediaOnWordPress_Updater_(targetId, {
      alt_text: translated.alt,
      title: translated.title,
      caption: translated.caption,
      description: translated.description
    });
    var englishTitle = sourceEn && sourceEn.title ? String(sourceEn.title).trim() : (current && current.title ? String(current.title).trim() : '');
    var langPrefix = String(lang || '').toLowerCase().split('-')[0];
    if (englishTitle) {
      await throttleStage_Updater_('ensure filename ' + targetId, UPDATER_ENSURE_FILENAME_DELAY_MS)
      try {
        await ensureFilenameForMedia_Updater_(targetId, (langPrefix ? (langPrefix + '-') : '') + englishTitle);
      } catch (eEnsureTranslated) {
        if (shouldSkipEnsureFilenameForError_Updater_(eEnsureTranslated)) {
          log('Updater: Skipping ensure filename for Media ' + targetId + ' due to quota/rate-limit: ' + (eEnsureTranslated && eEnsureTranslated.message ? eEnsureTranslated.message : String(eEnsureTranslated)))
        } else {
          throw eEnsureTranslated
        }
      }
    }

    log('IMAGE METADATA UPDATED FOR WORDPRESS ATTACHMENT: ' + targetId);
    if (translated.alt) log('IMAGE ALT UPDATED (' + lang + '): ' + targetId);
    if (translated.caption) log('IMAGE CAPTION UPDATED (' + lang + '): ' + targetId);
    if (translated.description) log('IMAGE DESCRIPTION UPDATED (' + lang + '): ' + targetId);
    if (translated.alt) {
      if (role === 'featured') log('FEATURED IMAGE ALT GENERATED (' + lang + '): ' + translated.alt);
      else log('GALLERY IMAGE ALT GENERATED (' + lang + '): ' + translated.alt);
    }
  }
}

/**
 * Upload an image from an external URL to WordPress Media Library
 * @param {string} imageUrl - Direct URL to the image
 * @param {string} title - Optional title/filename for the image
 * @return {string|null} - The new WordPress Media ID, or null if failed
 */
async function uploadMediaFromUrl_Updater_(imageUrl, title) {
  if (!imageUrl) return null;
  
  // Clean URL
  imageUrl = imageUrl.trim();
  
  // CHECK: Is it a Google Drive FOLDER?
  if (imageUrl.indexOf('drive.google.com/drive/folders') !== -1 || imageUrl.indexOf('/folders/') !== -1) {
      log('Updater: ERROR - Cannot upload a Google Drive FOLDER URL. Please provide a direct FILE URL. (' + imageUrl + ')');
      return null;
  }
  
  // FIX: Convert Google Drive Viewer URL to Direct Download URL
  if (imageUrl.indexOf('drive.google.com') !== -1) {
    // Pattern: https://drive.google.com/file/d/[FILE_ID]/view...
    var idMatch = imageUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
      imageUrl = 'https://drive.google.com/uc?export=download&id=' + idMatch[1];
      log('Updater: Converted Google Drive URL to: ' + imageUrl);
    }
  }
  
  // Set filename
  var filename = 'image.jpg';
  if (title) {
    // Sanitize title for filename
    filename = title.toLowerCase().replace(/[^a-z0-9]/g, '-') + '.jpg';
  } else {
    // Try to get filename from URL
    var parts = imageUrl.split('/');
    var lastPart = parts[parts.length - 1];
    if (lastPart && lastPart.indexOf('.') !== -1) {
      filename = lastPart.split('?')[0]; // Remove query params
    }
  }
  
  log('Updater: Attempting to upload image from URL: ' + imageUrl);
  
  try {
    // 1. Download image from URL
    var dl = await http.raw.get(imageUrl, { responseType: 'arraybuffer' });
    var dlCode = dl && typeof dl.status === 'number' ? dl.status : 0;
    if (dlCode < 200 || dlCode >= 300) {
      log('Updater: ERROR - Failed to download image. Code: ' + dlCode + ', URL: ' + imageUrl);
      return null;
    }

    var contentType = (dl.headers && dl.headers['content-type']) ? String(dl.headers['content-type']) : '';
    if (contentType && contentType.indexOf('image') === -1) {
      log('Updater: ERROR - Fetched URL is not an image. Content-Type: ' + contentType + '. URL: ' + imageUrl);
      return null;
    }

    var imageBytes = Buffer.from(dl.data);
    
    // 2. Prepare upload to WordPress
    var baseUrl = CONFIG.WP_API_BASE;
    var rootUrl = baseUrl;
    if (baseUrl.indexOf('/wp-json/') !== -1) {
      rootUrl = baseUrl.split('/wp-json/')[0];
    }
    
    var uploadUrl = rootUrl + '/wp-json/wp/v2/media';
    
    var options = {
      headers: {
        'Authorization': 'Basic ' + base64Encode(CONFIG.WP_API_USER + ':' + CONFIG.WP_API_PASS),
        'Content-Disposition': 'attachment; filename="' + filename + '"',
        'Content-Type': contentType || 'image/jpeg'
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    };
    
    // 3. Send Request
    var resp = await http.raw.post(uploadUrl, imageBytes, options);
    var code = resp && typeof resp.status === 'number' ? resp.status : 0;
    var body = resp ? resp.data : null;
    
    if (code === 201 || code === 200) {
      if (body && body.id) {
        log('Updater: ✅ Successfully uploaded image. New WP ID: ' + body.id);
        return String(body.id);
      }
    }
    
    log('Updater: Failed to upload image. Code: ' + code + ', Response: ' + (typeof body === 'string' ? body : JSON.stringify(body)));
    return null;
    
  } catch (e) {
    log('Updater: Error uploading image from URL: ' + e.message);
    return null;
  }
}


function createUpdater(deps) {
  var inited = false;
  async function ensureInit() {
    if (inited) return;
    await initUpdater(deps);
    inited = true;
  }

  return {
    clearCaches: async () => {
      await ensureInit();
      clearUpdaterCaches_Updater_();
      return true;
    },
    runUpdaterBatch: async () => {
      await ensureInit();
      return runUpdaterBatch();
    }
  }
}

module.exports = { createUpdater }
