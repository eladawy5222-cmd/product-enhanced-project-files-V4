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

function clearUpdaterCaches_Updater_() {
  UPDATER_WP_TRIP_INFO_CACHE = {};
  UPDATER_AIRTABLE_TABLE_CACHE = {};
  log('Updater: Cleared in-memory caches');
}

function logVerbose_Updater_(msg) {
  if (UPDATER_DEBUG_VERBOSE) log(msg);
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
  var all = [];
  var offset = null;
  do {
    var params = { pageSize: 100, filterByFormula: filterByFormula };
    if (offset) params.offset = offset;
    var res = await airtableGet_(tableName, params);
    if (res && res.records && res.records.length) all = all.concat(res.records);
    offset = res ? res.offset : null;
    if (offset) await sleep(50);
  } while (offset);
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
  if (!needles.length) return [];

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
      log('IMAGES LOOKUP FIELD USED: ' + field);
      if (recs && recs.length) return recs;
    } catch (e) {
      var msg = e && e.message ? String(e.message) : String(e);
      if (msg.indexOf('INVALID_FILTER_BY_FORMULA') !== -1 && msg.toLowerCase().indexOf('unknown field') !== -1) {
        missing.push(field);
        continue;
      }
      throw e;
    }
  }

  log('IMAGES LOOKUP FIELD NOT FOUND (checked: ' + candidates.join(', ') + ')');
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
  do {
    var params = { pageSize: 100 };
    if (offset) params.offset = offset;
    var res = await airtableGet_(t, params);
    if (res && res.records && res.records.length) {
      all = all.concat(res.records);
    }
    offset = res ? res.offset : null;
    if (offset) await sleep(50);
  } while (offset);

  UPDATER_AIRTABLE_TABLE_CACHE[t] = all;
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
      log('Updater: Warning - Failed to sync translated images for ' + langCode + ': ' + eImg.message);
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
      if (wantsPackages) await publishPackagesSafe_Updater_(tripId, primaryWpId);
      if (wantsImages) await publishImagesSafe_Updater_(tripId, primaryWpId, f);

      try {
        var primaryTripInfoForSchema = await getTripInfoFromWpCached_Updater_(primaryWpId);
        var primarySchema = generateTripSchema_Updater_(primaryTripInfoForSchema, primaryLang);
        await pushToWordPress_Updater_(primaryWpId, { meta: { schema_trip_data: JSON.stringify(primarySchema) } });
        log('TRIP SCHEMA GENERATED (' + primaryLang + ')');
      } catch (eSchemaPrimary) {
        log('Updater: Warning - Failed to generate schema for primary: ' + eSchemaPrimary.message);
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
        for (var i = 0; i < languagesToProcess.length; i++) {
          var targetLang = languagesToProcess[i];
          log('Updater: Processing translation for language: ' + targetLang);
          
          try {
            var providedForLang = await getMandatorySeoKeywordsForLang_Updater_(f, enhancedData, targetLang);
            if (providedForLang && providedForLang.primary) {
              log('MANDATORY SEO KEYWORDS (' + targetLang + '): ' + providedForLang.primary);
            }

            // Translate Content
            var translatedData = await translateTripData_Updater_(enhancedData, targetLang, providedForLang);

            var missingRequired = validateRequiredFieldsCompleteness_Updater_(enhancedData, translatedData);
            if (missingRequired && missingRequired.length) {
              fillMissingRequiredFromEnglish_Updater_(enhancedData, translatedData);
              missingRequired = validateRequiredFieldsCompleteness_Updater_(enhancedData, translatedData);
              if (missingRequired && missingRequired.length) {
                var skipReasonReq = 'required_fields_missing: ' + missingRequired.join(', ');
                log('Updater: SKIPPING LANGUAGE ' + targetLang + ' (required): ' + skipReasonReq);
                translationSkipped.push({ lang: targetLang, message: skipReasonReq });
                continue;
              }
            }

            var parityFails = validateParityCounts_Updater_(enhancedData, translatedData);
            if (parityFails && parityFails.length) {
              log('Updater: Parity count mismatch detected (' + targetLang + '): ' + JSON.stringify(parityFails));
              try {
                translatedData = await translateTripData_Updater_(enhancedData, targetLang, providedForLang);
                fillMissingRequiredFromEnglish_Updater_(enhancedData, translatedData);
              } catch (eParityRetry) {}
              parityFails = validateParityCounts_Updater_(enhancedData, translatedData);
              if (parityFails && parityFails.length) {
                parityFails.forEach(function(fail) {
                  var sec = fail.section;
                  var srcArr = enhancedData && enhancedData[sec] ? enhancedData[sec] : [];
                  var trArr = translatedData && translatedData[sec] ? translatedData[sec] : [];
                  if (Array.isArray(srcArr) && Array.isArray(trArr) && trArr.length < srcArr.length) {
                    translatedData[sec] = JSON.parse(JSON.stringify(srcArr));
                  }
                });
              }
              parityFails = validateParityCounts_Updater_(enhancedData, translatedData);
              if (parityFails && parityFails.length) {
                var skipReasonParity = 'parity_count_failed: ' + JSON.stringify(parityFails);
                log('Updater: SKIPPING LANGUAGE ' + targetLang + ' (parity): ' + skipReasonParity);
                translationSkipped.push({ lang: targetLang, message: skipReasonParity });
                continue;
              } else {
                log('Updater: Parity fixed using fallback (' + targetLang + ')');
              }
            }

            var sections = ['highlights', 'includes', 'excludes', 'faqs', 'itinerary'];
            var suspiciousSections = [];
            for (var qIdx = 0; qIdx < sections.length; qIdx++) {
              var sName = sections[qIdx];
              if (isSectionSuspiciousNotLocalized_Updater_(enhancedData, translatedData, sName)) suspiciousSections.push(sName);
            }
            if (suspiciousSections.length) {
              log('Updater: Suspicious not-localized sections (' + targetLang + '): ' + suspiciousSections.join(', '));
              try {
                translatedData = await translateTripData_Updater_(enhancedData, targetLang, providedForLang);
                fillMissingRequiredFromEnglish_Updater_(enhancedData, translatedData);
              } catch (eQualityRetry) {}
              for (var q2 = 0; q2 < suspiciousSections.length; q2++) {
                var secQ = suspiciousSections[q2];
                if (isSectionSuspiciousNotLocalized_Updater_(enhancedData, translatedData, secQ)) {
                  var skipReasonQuality = 'section_not_localized_' + secQ;
                  log('Updater: SKIPPING LANGUAGE ' + targetLang + ' (quality): ' + skipReasonQuality);
                  translationSkipped.push({ lang: targetLang, message: skipReasonQuality });
                  translatedData = null;
                  break;
                }
              }
              if (!translatedData) continue;
            }

            for (var sIdx = 0; sIdx < sections.length; sIdx++) {
              var sec = sections[sIdx];
              fillEmptySectionItemsFromEnglish_Updater_(enhancedData, translatedData, sec);
              if (hasEmptySectionItems_Updater_(enhancedData, translatedData, sec)) {
                var skipReasonSec = 'section_incomplete: ' + sec;
                log('Updater: SKIPPING LANGUAGE ' + targetLang + ' (section): ' + skipReasonSec);
                translationSkipped.push({ lang: targetLang, message: skipReasonSec });
                translatedData = null;
                break;
              }
            }
            if (!translatedData) continue;
            
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

            if (translatedPayload.meta) {
              var hasStrictProvidedKw = targetLang !== 'en' && providedForLang && (providedForLang.primary || (providedForLang.secondary && providedForLang.secondary.length));
              if (targetLang !== 'en') {
                if (providedForLang && (providedForLang.primary || (providedForLang.secondary && providedForLang.secondary.length))) {
                  var kwPartsStrict = [];
                  if (providedForLang.primary) kwPartsStrict.push(String(providedForLang.primary).trim());
                  if (providedForLang.secondary && providedForLang.secondary.length) {
                    providedForLang.secondary.forEach(function(k) {
                      var s = String(k || '').trim();
                      if (s) kwPartsStrict.push(s);
                    });
                  }
                  if (kwPartsStrict.length) {
                    translatedPayload.meta.rank_math_focus_keyword = kwPartsStrict.join(', ');
                    imageSeoDataForLang = { primary: providedForLang.primary || '', secondary: providedForLang.secondary || [] };
                    imageFocusKeywordsStringForLang = translatedPayload.meta.rank_math_focus_keyword;
                  }
                } else {
                  delete translatedPayload.meta.rank_math_focus_keyword;
                }
              }
              var assets = await generateLocalizedSEOAssets_Updater_(translatedData, targetLang, providedForLang);
              if (assets) {
                log('SEO ASSETS GENERATED (' + targetLang + ')');
                if (assets.primary_keyword) {
                  log('LOCALIZED PRIMARY KEYWORD GENERATED (' + targetLang + '): ' + assets.primary_keyword);
                }
                if (assets.secondary_keywords && assets.secondary_keywords.length) {
                  log('LOCALIZED SECONDARY KEYWORDS GENERATED (' + targetLang + '): ' + assets.secondary_keywords.join(', '));
                }
                if (assets.title) {
                  translatedPayload.meta.rank_math_title = assets.title;
                  log('SEO TITLE GENERATED (' + targetLang + ')');
                  log('LOCALIZED SEO TITLE GENERATED (' + targetLang + '): ' + assets.title);
                  log('LOCALIZED SEO TITLE (' + targetLang + '): ' + assets.title);
                }
                if (assets.description) {
                  translatedPayload.meta.rank_math_description = assets.description;
                  log('META DESCRIPTION GENERATED (' + targetLang + ')');
                  log('LOCALIZED META DESCRIPTION GENERATED (' + targetLang + '): ' + assets.description);
                  log('LOCALIZED META DESCRIPTION (' + targetLang + '): ' + assets.description);
                }
                var keywordsParts = [];
                if (assets.primary_keyword) keywordsParts.push(assets.primary_keyword);
                if (assets.secondary_keywords && assets.secondary_keywords.length) {
                  assets.secondary_keywords.forEach(function(k) {
                    var s = String(k || '').trim();
                    if (s) keywordsParts.push(s);
                  });
                }
                if (keywordsParts.length && !hasStrictProvidedKw) {
                  translatedPayload.meta.rank_math_focus_keyword = keywordsParts.join(', ');
                  log('LOCALIZED FOCUS KEYWORDS (' + targetLang + '): ' + translatedPayload.meta.rank_math_focus_keyword);
                  imageSeoDataForLang = { primary: assets.primary_keyword, secondary: assets.secondary_keywords };
                  imageFocusKeywordsStringForLang = translatedPayload.meta.rank_math_focus_keyword;
                }
                if (assets.image_alt) {
                  translatedPayload.meta.localized_image_alt = assets.image_alt;
                  log('IMAGE ALT GENERATED (' + targetLang + '): ' + assets.image_alt);
                }
                if (assets.slug) {
                  translatedPayload.core = translatedPayload.core || {};
                  translatedPayload.core.slug = sanitizeTranslatedSlug_(assets.slug);
                  log('LOCALIZED SLUG GENERATED (' + targetLang + '): ' + translatedPayload.core.slug);
                }
                var wte = translatedPayload.meta.wp_travel_engine_setting;
                if (wte && wte.tab_content && wte.tab_content['1_wpeditor']) {
                  wte.tab_content['1_wpeditor'] = applySeoEnhancementsToOverviewHtml_Updater_(wte.tab_content['1_wpeditor'], assets, targetLang);
                  translatedPayload.core = translatedPayload.core || {};
                  translatedPayload.core.content = wte.tab_content['1_wpeditor'];
                  translatedPayload.content = wte.tab_content['1_wpeditor'];
                }
              }
            }
            
            // Link to Primary - IMPORTANT: We just send the parent ID here
            // The full linking happens in the FINAL step to avoid race conditions
            translatedPayload.translation_of = primaryWpId;

            var existingTransWpInfo = null;
            var slugLocked = false;
            try {
              if (existingTranslations[targetLang]) {
                existingTransWpInfo = await getTripInfoFromWpCached_Updater_(existingTranslations[targetLang]);
              }
            } catch (eSlugCheck) {}
            if (existingTransWpInfo && existingTransWpInfo.core && existingTransWpInfo.core.slug) {
              var existingTransSlug = String(existingTransWpInfo.core.slug).trim();
              if (existingTransSlug) {
                translatedPayload.core = translatedPayload.core || {};
                translatedPayload.core.slug = existingTransSlug;
                slugLocked = true;
                log('Updater: PRESERVING existing slug for ' + targetLang + ' translation: ' + existingTransSlug);
              }
            }

            var primaryKw = providedForLang && providedForLang.primary ? String(providedForLang.primary).trim() : '';
            if (primaryKw) {
              var kwCheck = validatePrimaryKeywordInSeo_Updater_(translatedPayload, primaryKw);
              if (!kwCheck.ok) {
                try {
                  assets = await generateLocalizedSEOAssets_Updater_(translatedData, targetLang, providedForLang);
                  if (assets) {
                    if (assets.title) translatedPayload.meta.rank_math_title = assets.title;
                    if (assets.description) translatedPayload.meta.rank_math_description = assets.description;
                    if (assets.image_alt) translatedPayload.meta.localized_image_alt = assets.image_alt;
                    if (assets.slug && !slugLocked) {
                      translatedPayload.core = translatedPayload.core || {};
                      translatedPayload.core.slug = sanitizeTranslatedSlug_(assets.slug);
                    }
                    var wteRetry = translatedPayload.meta && translatedPayload.meta.wp_travel_engine_setting;
                    if (wteRetry && wteRetry.tab_content && wteRetry.tab_content['1_wpeditor']) {
                      wteRetry.tab_content['1_wpeditor'] = applySeoEnhancementsToOverviewHtml_Updater_(wteRetry.tab_content['1_wpeditor'], assets, targetLang);
                      translatedPayload.core = translatedPayload.core || {};
                      translatedPayload.core.content = wteRetry.tab_content['1_wpeditor'];
                      translatedPayload.content = wteRetry.tab_content['1_wpeditor'];
                    }
                  }
                } catch (eSeoRetry) {}
                kwCheck = validatePrimaryKeywordInSeo_Updater_(translatedPayload, primaryKw);
              }
              if (!kwCheck.ok) {
                translatedPayload = forcePrimaryKeywordFallbackOnSeo_Updater_(translatedPayload, primaryKw, payload, slugLocked);
                kwCheck = validatePrimaryKeywordInSeo_Updater_(translatedPayload, primaryKw);
              }
              if (!kwCheck.ok) {
                var reasonKw = 'keyword_validation_failed: ' + kwCheck.reasons.join(', ');
                log('Updater: SKIPPING LANGUAGE ' + targetLang + ' (SEO/keywords): ' + reasonKw);
                translationSkipped.push({ lang: targetLang, message: reasonKw });
                continue;
              }
            }
            
            // Check if translation already exists
            var transWpId = null;
            if (existingTranslations[targetLang]) {
                transWpId = existingTranslations[targetLang];
                log('UPDATING EXISTING TRANSLATION: ' + targetLang + ' -> ' + transWpId);
                
                try {
                  await pushToWordPress_Updater_(transWpId, translatedPayload);
                  log('Updater: Successfully UPDATED translation ' + transWpId);
                } catch (eUpdateTrans) {
                  log('Updater: Update failed for ' + targetLang + ' (WP ID ' + transWpId + '): ' + (eUpdateTrans && eUpdateTrans.message ? eUpdateTrans.message : String(eUpdateTrans)));
                  log('Updater: Translation post may have been deleted. Falling back to CREATE...');
                  translatedPayload.translation_of = primaryWpId;
                  transWpId = await createNewTripOnWordPress_Updater_(translatedPayload);
                  log('Updater: Successfully CREATED replacement translation ' + transWpId + ' for ' + targetLang);
                }
            } else {
                log('CREATING TRANSLATION: ' + targetLang + ' (parent=' + primaryWpId + ')');
                
                // Ensure translation_of is set for NEW translations
                translatedPayload.translation_of = primaryWpId;
                
                transWpId = await createNewTripOnWordPress_Updater_(translatedPayload);
                log('Updater: Successfully CREATED translation ' + transWpId);
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
              var transSchema = generateTripSchema_Updater_(transTripInfoForSchema, targetLang);
              await pushToWordPress_Updater_(transWpId, { meta: { schema_trip_data: JSON.stringify(transSchema) } });
              log('TRIP SCHEMA GENERATED (' + targetLang + ')');
            } catch (eSchemaTrans) {
              log('Updater: Warning - Failed to generate schema for ' + targetLang + ': ' + eSchemaTrans.message);
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
                  attachmentIdMap: attachmentIdMap
                });
              }
            } catch (eImgMeta) {
              log('Updater: Warning - Failed to localize image metadata for ' + targetLang + ': ' + eImgMeta.message);
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
    "- If it visits museums/temples, include 'Pyramids & History'.";

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
      throw e;
    }
    var records = (res && res.records) ? res.records : [];
    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      var links = rec.fields[linkFieldName];
      if (Array.isArray(links)) {
        if (links.indexOf(targetId) !== -1) return rec;
      } else if (typeof links === 'string') {
        if (links === targetId) return rec;
      }
    }
    offset = res ? res.offset : null;
    if (offset) await sleep(50);
  } while (offset);

  var cached = await getAllAirtableRecordsCached_Updater_(tableName);
  for (var j = 0; j < cached.length; j++) {
    var rec2 = cached[j];
    if (!rec2 || !rec2.fields) continue;
    var links2 = rec2.fields[linkFieldName];
    if (Array.isArray(links2)) {
      if (links2.indexOf(targetId) !== -1) return rec2;
    } else if (typeof links2 === 'string') {
      if (links2 === targetId) return rec2;
    }
  }
  return null;
}

// Helper: Find MULTIPLE records by Linked Record ID (Client-Side)
// Modified to support PAGINATION to ensure we scan all records, not just the first page.
async function findRecordsByLinkedId_Updater_(tableName, linkFieldName, targetId, sortField) {
  var matches = [];
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
  if (g.AI_Trip_Description) wte.tab_content['1_wpeditor'] = g.AI_Trip_Description; // Assuming 1 is Overview
  
  if (g.AI_Why_People_Love_This_Trip_Section_Title) wte.tab_8_title = g.AI_Why_People_Love_This_Trip_Section_Title;
  if (g.AI_Tab_Content) wte.tab_content['8_wpeditor'] = g.AI_Tab_Content; // Assuming 8 is "Why People Love"

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
    wte.cost.cost_includes = data.includes.map(function(r){ return r.fields.IncludeItem; }).join('\n');
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
      wte.faq.faq_title.push(rec.fields.AI_Question);
      wte.faq.faq_content.push(rec.fields.AI_Answer);
      wte.faq_title.push(rec.fields.AI_Question);
      wte.faq_content.push(rec.fields.AI_Answer);
    });
  }
  
  // Itinerary
  // Note: JSON shows `trip_itinerary_title` (section title) vs `itinerary_title` (object of day titles)
  if (g.AI_Itinerary_Section_Title) wte.trip_itinerary_title = g.AI_Itinerary_Section_Title; 
  if (g.AI_Itinerary_Description) wte.trip_itinerary_description = g.AI_Itinerary_Description;
  
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

  var accepted = [lang];
  if (lang === 'pt-br') accepted.push('pt');

  var picked = [];
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    var parsed = parseKeywordWithLangPrefix_Updater_(item);
    if (parsed && accepted.indexOf(parsed.lang) !== -1) {
      picked.push(parsed.phrase);
      continue;
    }
    var detected = detectLangHeuristicForKeyword_Updater_(item);
    if (detected && accepted.indexOf(detected) !== -1) {
      picked.push(item);
    }
  }

  picked = picked.map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x; });
  if (!picked.length) return null;

  var seen = {};
  var uniq = [];
  picked.forEach(function(s) {
    var k = s.toLowerCase();
    if (seen[k]) return;
    seen[k] = true;
    uniq.push(s);
  });

  return {
    primary: uniq[0] || '',
    secondary: uniq.length > 1 ? uniq.slice(1) : [],
    all: uniq
  };
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

  var direct = [];
  list.forEach(function(item) {
    var parsed = parseKeywordWithLangPrefix_Updater_(item);
    if (parsed && parsed.lang === lang) direct.push(parsed.phrase);
  });
  if (direct.length) {
    return appendNeutralPlaceKeywords_Updater_({
      primary: direct[0],
      secondary: direct.slice(1, 4),
      all: direct
    }, list, lang);
  }

  var heuristic = list.filter(function(item) { return detectLangHeuristicForKeyword_Updater_(item) === lang; });
  if (heuristic.length) {
    return appendNeutralPlaceKeywords_Updater_({
      primary: heuristic[0],
      secondary: heuristic.slice(1, 4),
      all: heuristic
    }, list, lang);
  }

  var sample = list.slice(0, 40);
  var prompt =
    "You are an expert in Travel SEO and Multilingual Content Localization.\n\n" +
    "CRITICAL RULES:\n" +
    "1) TARGET LANGUAGE ONLY\n" +
    "You MUST return the result ONLY in the target language: " + lang + ".\n" +
    "Never output any other language.\n\n" +
    "TASK:\n" +
    "From the following keyword phrases list (mixed languages), pick ONLY the phrases that are already written in the target language (" + lang + ").\n" +
    "If a phrase is not clearly written in the target language, exclude it.\n" +
    "Do NOT translate phrases. Do NOT rewrite phrases. Select exact phrases from the list.\n" +
    "Then choose:\n" +
    "- primary (1)\n" +
    "- secondary (3)\n\n" +
    "Return ONLY valid JSON:\n" +
    "{ \"primary\": \"...\", \"secondary\": [\"...\", \"...\", \"...\"] }\n\n" +
    "KEYWORDS LIST:\n" + JSON.stringify(sample);

  var neutralTokens = list.filter(isNeutralPlaceKeyword_Updater_);
  var res = await callAiForTargetLangWithRetry_Updater_(prompt, lang, { neutralTokens: neutralTokens });
  if (res && typeof res === 'object' && !Array.isArray(res)) {
    var listSet = {};
    list.forEach(function(x) { listSet[String(x || '').trim().toLowerCase()] = true; });

    var primary = res.primary ? String(res.primary).trim() : '';
    var secondary = res.secondary && Array.isArray(res.secondary) ? res.secondary.map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x; }) : [];
    var selected = [primary].concat(secondary).map(function(x) { return String(x || '').trim(); }).filter(function(x) { return !!x; });

    selected = selected.filter(function(x) {
      var key = x.toLowerCase();
      if (!listSet[key]) return false;
      var detected = detectLangHeuristicForKeyword_Updater_(x);
      if (detected && !langMatchesOrBase_Updater_(detected, lang)) return false;
      return true;
    });

    if (selected.length) {
      return appendNeutralPlaceKeywords_Updater_({
        primary: selected[0],
        secondary: selected.slice(1, 4),
        all: selected
      }, list, lang);
    }
  }

  return null;
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

  if (outTitle && outTitle.length > 65) outTitle = outTitle.substring(0, 65).trim();
  if (outDesc && outDesc.length > 160) outDesc = outDesc.substring(0, 160).trim();

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

async function generateLocalizedSEOAssets_Updater_(translatedData, targetLang, providedKeywords) {
  var data = translatedData || {};
  var g = data.general || {};
  var kw = providedKeywords || null;

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
    "- The Primary Keyword MUST appear in: SEO Title, URL Slug, Meta Description.\n" +
    "- Secondary Keywords should be natural.\n" +
    "- Do NOT stuff keywords.\n\n" +
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

  if (out.title && out.title.length > 65) out.title = out.title.substring(0, 65).trim();
  if (out.description && out.description.length > 160) out.description = out.description.substring(0, 160).trim();

  return out;
}

function generateTripSchema_Updater_(tripData, targetLang) {
  var d = tripData || {};
  var core = d.core || {};
  var meta = d.meta || {};
  var pricing = d.pricing || {};
  var general = d.general || {};

  var title = String(core.title || '').trim();
  var url = String(core.permalink || core.link || '').trim();

  var descRaw = '';
  if (meta.rank_math_description) descRaw = meta.rank_math_description;
  else if (meta.rank_math_description && Array.isArray(meta.rank_math_description)) descRaw = meta.rank_math_description[0];
  else if (meta.rank_math_description && typeof meta.rank_math_description === 'object') descRaw = String(meta.rank_math_description);
  else if (core.excerpt) descRaw = core.excerpt;
  else if (meta.rank_math_description) descRaw = meta.rank_math_description;
  else if (core.content_html) descRaw = core.content_html;

  var description = String(descRaw || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

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

  var currency = String(pricing.currency || 'EUR');
  var priceVal = pricing.actual_price != null ? pricing.actual_price : pricing.base_price;
  var price = priceVal == null ? '' : String(priceVal);

  var durationText = '';
  if (general.duration && (general.duration.hours || general.duration.minutes)) {
    var h = Number(general.duration.hours || 0);
    var m = Number(general.duration.minutes || 0);
    if (h && m) durationText = h + 'h ' + m + 'm';
    else if (h) durationText = h + 'h';
    else if (m) durationText = m + 'm';
  }

  var destinationName = '';
  if (d.taxonomies && typeof d.taxonomies === 'object') {
    var candidates = ['destination', 'destinations', 'trip_location', 'trip_locations', 'location', 'tour_location', 'tour_locations'];
    for (var i = 0; i < candidates.length; i++) {
      var key = candidates[i];
      if (d.taxonomies[key] && d.taxonomies[key].length && d.taxonomies[key][0] && d.taxonomies[key][0].name) {
        destinationName = String(d.taxonomies[key][0].name).trim();
        break;
      }
    }
  }

  var schema = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    "name": title,
    "description": description,
    "image": images.length ? images : undefined,
    "touristType": "Adventure Travelers",
    "inLanguage": String(targetLang || '').trim() || undefined,
    "offers": {
      "@type": "Offer",
      "priceCurrency": currency,
      "price": price,
      "availability": "https://schema.org/InStock",
      "url": url || undefined
    },
    "itinerary": destinationName ? { "@type": "Place", "name": destinationName } : undefined,
    "duration": durationText || undefined
  };

  Object.keys(schema).forEach(function(k) { if (schema[k] === undefined) delete schema[k]; });
  if (schema.offers) {
    Object.keys(schema.offers).forEach(function(k) { if (schema.offers[k] === undefined || schema.offers[k] === '') delete schema.offers[k]; });
  }

  return schema;
}

/**
 * Translates enhanced trip data into a target language using AI (DeepSeek).
 * Focuses on user-facing content: Title, Slug, Meta, Description, Itinerary, FAQs.
 */
async function translateTripData_Updater_(data, targetLang, providedKeywords) {
  log('Updater: Translating trip data to ' + targetLang + ' using DeepSeek...');
  
  // Clone data to avoid modifying original
  var newData = JSON.parse(JSON.stringify(data));
  var g = newData.general || {};
  var kw = providedKeywords || null;

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
      "Provided SEO Keywords (optional):\n" +
      "Primary Keyword: " + kw.primary + "\n" +
      "Secondary Keywords:\n" +
      (kw.secondary && kw.secondary[0] ? ('- ' + kw.secondary[0] + '\n') : '') +
      (kw.secondary && kw.secondary[1] ? ('- ' + kw.secondary[1] + '\n') : '') +
      (kw.secondary && kw.secondary[2] ? ('- ' + kw.secondary[2] + '\n') : '');
  }

  var corePrompt = 
    "You are an expert travel translator using DeepSeek v3. Translate the following JSON content into " + targetLang.toUpperCase() + ".\n" +
    "RULES:\n" +
    "- TARGET LANGUAGE ONLY: Return the result ONLY in the target language (" + targetLang.toLowerCase() + "). Do NOT switch language.\n" +
    "- CONTENT INTEGRITY: Do NOT change itinerary steps, schedule, inclusions, exclusions, pricing facts, durations, logistics, or pickup details.\n" +
    "- Maintain HTML tags exactly as they are.\n" +
    "- Preserve all HTML tags exactly as they are. Do NOT add new HTML tags. Do NOT wrap text in <font>, <span>, or inline styles.\n" +
    (providedKwBlock ? (
      "- MANDATORY KEYWORD STRATEGY:\n" +
      "  - Use the provided Primary Keyword and Secondary Keywords EXACTLY as provided (do not translate or alter them).\n" +
      "  - Primary Keyword must appear in: title, meta_desc, slug (derived from it), and early in description.\n" +
      "  - Secondary keywords should appear naturally (no stuffing).\n"
    ) : "") +
    "- Keep tone professional, persuasive, and SEO-friendly.\n" +
    "- 'slug': Translate into a URL-friendly slug (lowercase, hyphens only, no special chars). Example: 'best-egypt-tour' -> 'meilleur-tour-egypte'.\n" +
    "- 'meta_desc': Translate and optimize for SEO (max 160 chars).\n" +
    "- Return ONLY valid JSON.\n\n" +
    (providedKwBlock ? (providedKwBlock + "\n") : "") +
    "INPUT JSON:\n" + JSON.stringify(contentToTranslate);
    
  var coreRes = await callAiForTargetLangWithRetry_Updater_(corePrompt, targetLang);
  if (coreRes) translatedJson.core = coreRes;

  // --- Chunk 2: Lists (Includes FAQs) ---
  var listPrompt = 
    "Translate these lists into " + targetLang.toUpperCase() + ". Return ONLY valid JSON matching input structure.\n" +
    "RULES:\n" +
    "- TARGET LANGUAGE ONLY: Return the result ONLY in the target language (" + targetLang.toLowerCase() + "). Do NOT switch language.\n" +
    "- CONTENT INTEGRITY: Do NOT change inclusions/exclusions/FAQ meaning or facts.\n" +
    "- Preserve all HTML tags exactly as they are. Do NOT add new HTML tags. Do NOT wrap text in <font>, <span>, or inline styles.\n" +
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
      "Translate this itinerary into " + targetLang.toUpperCase() + ". Return ONLY valid JSON.\n" +
      "RULES:\n" +
      "- TARGET LANGUAGE ONLY: Return the result ONLY in the target language (" + targetLang.toLowerCase() + "). Do NOT switch language.\n" +
      "- CONTENT INTEGRITY: Do NOT change itinerary steps, order, times, or any factual details.\n" +
      "- Preserve all HTML tags exactly as they are. Do NOT add new HTML tags. Do NOT wrap text in <font>, <span>, or inline styles.\n" +
      "- OUTPUT FORMAT: Return ONLY a JSON object with EXACTLY this shape: {\"itinerary\":[{\"title\":\"...\",\"desc\":\"...\",\"label\":\"...\"}, ...]}.\n" +
      "- LENGTH: The output itinerary array length MUST equal the input itinerary length exactly.\n" +
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
        "Translate this itinerary into " + targetLang.toUpperCase() + ". Return ONLY valid JSON.\n" +
        "CRITICAL:\n" +
        "- Return ONLY a JSON object with EXACTLY this shape: {\"itinerary\":[{\"title\":\"...\",\"desc\":\"...\",\"label\":\"...\"}, ...]}.\n" +
        "- The output itinerary array length MUST equal the input itinerary length exactly.\n" +
        "- Use the SAME order as input.\n" +
        "- Do NOT add, remove, merge, or split items.\n" +
        "- Preserve times, numbers, emojis, and punctuation exactly.\n" +
        "- Preserve HTML tags exactly.\n" +
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
      "Translate these fields into " + targetLang.toUpperCase() + ". Return ONLY valid JSON matching input structure.\n" +
      "RULES:\n" +
      "- TARGET LANGUAGE ONLY: Return the result ONLY in the target language (" + targetLang.toLowerCase() + "). Do NOT switch language.\n" +
      "- CONTENT INTEGRITY: Do NOT change numbers, prices, durations, logistics, or factual meaning.\n" +
      "- Preserve all HTML tags exactly as they are. Do NOT add new HTML tags. Do NOT wrap text in <font>, <span>, or inline styles.\n" +
      "- Trip facts: translate both 'label' and 'value'.\n" +
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
      var slugCandidate = c.slug ? sanitizeTranslatedSlug_(c.slug) : '';
      if (!slugCandidate) {
        slugCandidate = sanitizeTranslatedSlug_(c.title || g.AI_SEO_Title || '');
      }
      if (slugCandidate && sourceEnglishSlug && slugCandidate === sourceEnglishSlug) {
        slugCandidate = sanitizeTranslatedSlug_(c.title || g.AI_SEO_Title || '');
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
  return merged;
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
  if (title.length > 65) title = title.substring(0, 65).trim();
  out.meta.rank_math_title = title;

  var desc = String(out.meta.rank_math_description || '').trim();
  if (!desc) desc = String(enMeta.rank_math_description || '').trim();
  if (!desc) desc = primary;
  if (!containsKeyword_Updater_(desc, primary)) desc = (primary + ' - ' + desc).trim();
  if (desc.length > 160) desc = desc.substring(0, 160).trim();
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
      html = '<h2>' + primary + '</h2>' + html;
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
           
           log('Updater: Sending package "' + payload.title + '" to WP...');
           var newId = await sendPackageToWp_Updater_(payload, { lang: targetLang });
           
           if (newId) {
              log('Updater: Package created with ID: ' + newId + '. Updating Airtable...');
              generatedPackageIds.push(newId);
              
              // 1. Update Package Record
              if (!skipAirtableSync) {
                try {
                    await airtableUpdate_('Packages', pkg.id, { PackageID: String(newId) });
                    log('Updater: Updated Packages table for record ' + pkg.id);
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
       var newId = await sendPackageToWp_Updater_(payload, { lang: targetLang });
       if (newId) generatedPackageIds.push(newId);
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
      
      var url = baseUrl + '/packages';
      if (opts.lang) {
        url += '?lang=' + encodeURIComponent(String(opts.lang));
      }

      var resp = await fetchUrl(url, options);
      var json = JSON.parse(resp.getContentText());

      if (json && json.id) {
         log('Updater: Created Package ' + json.id);
         return json.id;
      } else {
         log('Updater: Failed to create package ' + JSON.stringify(json));
         return null;
      }
}

async function publishImagesSafe_Updater_(tripId, wpTripId, tripFields) {
   var imageTranslationMapForAttachments = parseImageTranslationMap_Updater_(tripFields && tripFields.Image_Translation_Map);
   // 1. Fetch Improvement Records (for Metadata & Gallery)
   var impRecords = await findRecordsByLinkedId_Updater_(UPDATER_IMAGES_IMPROVEMENT_TABLE, 'Trip', tripId);
   
   // 2. Fetch Raw Images Records (for Featured Image Matching by Attachment)
   // We need this because Improvement table has IDs but NOT the attachment files for matching
   var rawImagesRecords = await findImageRecordsForTrip_Updater_(tripId, wpTripId);
   var rawImagesTable = getRawImagesTableName_Updater_();
   
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
               if (f.AI_Title || f.AI_Caption || f.AI_Alt || f.AI_Description) {
                   await updateMediaOnWordPress_Updater_(wpMediaId, {
                       title: f.AI_Title,
                       caption: f.AI_Caption,
                       alt_text: f.AI_Alt,
                       description: f.AI_Description || f.AI_Caption // Use Description if available, else fallback to Caption
                   });
                   if (f.AI_Title) await ensureFilenameForMedia_Updater_(wpMediaId, f.AI_Title);
                   // Add a small delay to avoid overwhelming the server if many images
                   await sleep(200); 
               } else {
                   await ensureEnglishMediaMetadataForAttachment_Updater_(wpMediaId, tripFields, tripId, declaredType, '');
               }
           }
       }
   }

   // --- Step C: Finalize Payload ---
   if (featId || galleryIds.length > 0) {
     if (featId) {
        await ensureEnglishMediaMetadataForAttachment_Updater_(featId, tripFields, tripId, 'featured', '');
     }
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

  var prompt = '';
  try { prompt = buildImagesPrompt_(ctx); } catch (e3) { prompt = ''; }
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
    await updateMediaOnWordPress_Updater_(id, payload);
    if (payload.title) await ensureFilenameForMedia_Updater_(id, payload.title);
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
    log('IMAGE TRANSLATION CACHE HIT (' + lang + '): ' + sourceId + ' -> ' + cached);
    return { id: cached, status: 'cache', role: imageRole || '' };
  }
  log('IMAGE TRANSLATION CACHE MISS (' + lang + '): ' + sourceId);
  var newId = await createTranslatedAttachment_Updater_(sourceId, lang);
  setCachedTranslatedAttachmentId_Updater_(map, sourceId, lang, newId);
  await storeImageTranslationMap_Updater_(tripRecId, map);
  if (imageRole) {
    log(String(imageRole).toUpperCase() + ' IMAGE ATTACHMENT CREATED (' + lang + '): ' + newId);
  }
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
    "You are an expert in Travel SEO and Multilingual Content Localization.\n\n" +
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
    "3) SEO KEYWORDS\n" +
    "- Do NOT keyword stuff.\n" +
    "- Featured image: alt MUST include the Primary Keyword.\n" +
    "- Featured image: title and caption SHOULD include the Primary Keyword naturally.\n" +
    "- Gallery image: use either the Primary Keyword or ONE secondary keyword naturally (rotate between images).\n" +
    "- Preferred keyword to use for this image when possible: " + (preferredKeyword ? preferredKeyword : "(none)") + "\n\n" +
    "FIELD RULES:\n" +
    "- alt: short descriptive phrase (8–15 words).\n" +
    "- title: short descriptive image title.\n" +
    "- caption: natural sentence.\n" +
    "- description: longer SEO description of the image.\n\n" +
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

  if (role === 'featured' && primary) {
    if (out.alt.toLowerCase().indexOf(primary.toLowerCase()) === -1) {
      out.alt = (primary + ' ' + out.alt).trim();
      if (out.alt.length > 125) out.alt = out.alt.substring(0, 125).trim();
    }
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

  var primary = '';
  var secondary = [];
  if (o.seoData) {
    primary = String(o.seoData.primary || o.seoData.primary_keyword || '').trim();
    if (o.seoData.secondary && Array.isArray(o.seoData.secondary)) secondary = o.seoData.secondary;
    if (o.seoData.secondary_keywords && Array.isArray(o.seoData.secondary_keywords)) secondary = o.seoData.secondary_keywords;
  }
  primary = String(primary || '').trim();
  secondary = (secondary || []).map(function(s) { return String(s || '').trim(); }).filter(function(s) { return !!s; });
  if (!primary && o.focusKeywordsString) {
    var parsed = parseFocusKeywordsString_Updater_(o.focusKeywordsString);
    primary = parsed.primary;
    secondary = parsed.secondary;
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
    "You are an expert in Travel SEO and Multilingual Content Localization.\n\n" +
    "CRITICAL RULES:\n" +
    "1) TARGET LANGUAGE ONLY\n" +
    "You MUST return the result ONLY in the target language: " + lang + ".\n" +
    "Never output any other language.\n\n" +
    "2) CONTENT INTEGRITY\n" +
    "- Keep meaning identical.\n" +
    "- Preserve location names and activity names.\n" +
    "- Do not add new facts.\n\n" +
    "3) SEO KEYWORDS\n" +
    "- Do NOT keyword stuff.\n" +
    "- Featured image: alt MUST include the Primary Keyword.\n" +
    "- Featured image: title and caption SHOULD include the Primary Keyword naturally if possible.\n" +
    "- Gallery image: use either the Primary Keyword or ONE secondary keyword naturally (rotate between images).\n" +
    "- Use this preferred keyword for this image when possible: " + (useKw ? useKw : "(none)") + "\n\n" +
    "FIELD RULES:\n" +
    "- alt: short descriptive phrase (8–15 words).\n" +
    "- title: short descriptive image title.\n" +
    "- caption: natural sentence.\n" +
    "- description: longer SEO description of the image.\n\n" +
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

  if (role === 'featured' && primary) {
    if (out.alt.toLowerCase().indexOf(primary.toLowerCase()) === -1) {
      out.alt = (primary + ' ' + out.alt).trim();
      if (out.alt.length > 125) out.alt = out.alt.substring(0, 125).trim();
    }
  }

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
      ctx.primary = fromList.primary;
      ctx.secondary = (fromList.secondary || []).map(function(s) { return String(s || '').trim(); }).filter(function(s) { return !!s; });
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
    if (keywordToUse) {
      keywordMissing = current.alt.toLowerCase().indexOf(String(keywordToUse).toLowerCase()) === -1;
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
    log('IMAGE METADATA TRANSLATED (' + lang + '): ' + targetId);

    await updateMediaOnWordPress_Updater_(targetId, {
      alt_text: translated.alt,
      title: translated.title,
      caption: translated.caption,
      description: translated.description
    });
    var englishTitle = sourceEn && sourceEn.title ? String(sourceEn.title).trim() : (current && current.title ? String(current.title).trim() : '');
    var langPrefix = String(lang || '').toLowerCase().split('-')[0];
    if (englishTitle) {
      await ensureFilenameForMedia_Updater_(targetId, (langPrefix ? (langPrefix + '-') : '') + englishTitle);
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
