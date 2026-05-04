/**
 * Fetch a single trip by ID from:
 * https://ftstravels.com/wp-json/fts/v1/trip/{id}
 */
function fetchTripById_(tripId) {
  loadConfigSecrets_();
  var base = CONFIG.WP_API_BASE;
  if (!base) {
    throw new Error("CONFIG.WP_API_BASE is not defined");
  }

  base = normalizeWpApiBase_(base) + '/trip';
  var url = base + '/' + encodeURIComponent(tripId);

  var headers = {};
  if (CONFIG.WP_API_USER && CONFIG.WP_API_PASS) {
    var token = Utilities.base64Encode(CONFIG.WP_API_USER + ':' + CONFIG.WP_API_PASS);
    headers.Authorization = 'Basic ' + token;
  }

  var options = {
    method: 'get',
    headers: headers,
    muteHttpExceptions: true,
  };

  var response = UrlFetchApp.fetch(url, options);
  var status = response.getResponseCode();
  var text = response.getContentText();

  if (status < 200 || status >= 300) {
    Logger.log('fetchTripById_ HTTP ' + status + ' — ' + text);
    throw new Error('Failed to fetch trip by ID: ' + tripId);
  }

  var json = JSON.parse(text);
  return json;
}

/** مثال تجريبي */
function testFetchTripById_() {
  var trip = fetchTripById_(21262);
  Logger.log(JSON.stringify(trip, null, 2));
}

function fetchTrip7495() {
  return fetchTripById_(7495);
}

function syncSingleTripById(tripId) {
  // Fetch single trip from WordPress API
  var trip = fetchTripById_(tripId);
  if (!trip || !trip.core || !trip.core.id) {
    Logger.log('Trip not found for id=' + tripId);
    return;
  }

  var tripIdStr = String(trip.core.id);

  // ✅ Check if trip already exists in Airtable
  var existingRecordId = AirtableUtils.getTripRecordIdByTripID(tripIdStr);
  if (existingRecordId) {
    Logger.log('🔄 Trip ' + tripIdStr + ' already exists in Airtable (Record: ' + existingRecordId + '). Updating...');
  } else {
    Logger.log('➕ Importing new trip: ' + tripIdStr);
  }

  // Import/Update trip
  upsertTrip_(trip);
  
  // 🆕 Initialize enhancement pipeline
  var tripRecordId = AirtableUtils.getTripRecordIdByTripID(tripIdStr);
  if (tripRecordId && typeof initializeEnhancementPipeline_ === 'function') {
    initializeEnhancementPipeline_(tripRecordId);
    Logger.log('✅ Trip ' + tripIdStr + ' imported and pipeline initialized');
  } else {
    Logger.log('WARNING: Could not initialize enhancement pipeline for TripID=' + tripIdStr);
  }
}

/** مثال مباشر على 7495 */
function syncTrip7495() {
  syncSingleTripById(7495);
}

function debugTripExtract(tripId) {
  var trip = fetchTripById_(tripId);
  if (!trip || !trip.core || !trip.core.id) {
    Logger.log('Trip not found for id=' + tripId);
    return;
  }

  var tripIdStr = String(trip.core.id);
  Logger.log('=== DEBUG EXTRACT FOR TripID=' + tripIdStr + ' ===');

  // هنا تفك trip وتشوف المابنج:
  // trip.core, trip.seo, trip.itinerary, trip.highlights, etc.
  Logger.log(JSON.stringify(trip, null, 2));
}

/** دي بس نسخة خاصة للتست */
function debugTripExtract7495() {
  debugTripExtract(7495);
}

/**
 * DAILY_LIMIT — الحد الأقصى لعدد الرحلات في اليوم
 * ممكن تحطها في CONFIG لو حابب
 */
var WP_IMPORT_DAILY_LIMIT = 60;

/**
 * runImportStepSafe
 *
 * - يشتغل من Trigger كل X دقيقة (time-driven)
 * - بيكمّل من آخر مكان وقف فيه (state: page, index, todayCount)
 * - يحترم حد أقصى يومي DAILY_LIMIT
 * - لكل تشغيل، ما يعالجش أكتر من batchMax رحلات (مثلاً 3)
 * - لكل رحلة:
 *    - يحذف أي Trip + أولاده في Airtable لنفس TripID
 *    - بعدها يعمل upsertTrip_(trip) لاستيراد جديد
 */
function runImportStepSafe() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    Logger.log('runImportStepSafe: lock busy, skipping');
    return;
  }

  try {
  loadConfigSecrets_();
  var state = StateService.wpImport.load();

  // 1) لو يوم جديد → نرجّع العدّاد للصفر
  var today = new Date().toDateString();
  if (state.todayDate !== today) {
    state.page = 1;
    state.index = 0;
    state.todayCount = 0;
    state.todayDate = today;
  }

  // 2) لو وصلنا للحد اليومي → نوقف
  if (state.todayCount >= WP_IMPORT_DAILY_LIMIT) {
    Logger.log("Daily limit reached: " + WP_IMPORT_DAILY_LIMIT + ". Stopping for today.");
    StateService.wpImport.save(state.page, state.index, state.todayCount);
    return;
  }

  // 3) نجيب صفحة من الـ API
  var perPage = CONFIG.WP_PER_PAGE || 20; // عدد الرحلات في كل صفحة من WP
  var apiURL = CONFIG.WP_API_BASE + "?page="
               + state.page + "&per_page=" + perPage;

  Logger.log("Fetching WPTE page " + state.page + " from " + apiURL);

  var response = UrlFetchApp.fetch(apiURL, { muteHttpExceptions: true });
  var statusCode = response.getResponseCode();
  if (statusCode < 200 || statusCode >= 300) {
    Logger.log("WP API error HTTP " + statusCode + " while fetching " + apiURL);
    StateService.wpImport.save(state.page, state.index, state.todayCount);
    return;
  }

  var text = response.getContentText();
  var json = JSON.parse(text);

  var list = json.data || [];
  var pagination = json.pagination || {};
  var totalPages = pagination.total_pages || 1;

  if (!list.length) {
    Logger.log("No trips found on page " + state.page + ". totalPages=" + totalPages);
    if (state.page >= totalPages) {
      Logger.log("Reached last page " + totalPages + ". Nothing more to import.");
    } else {
      state.page++;
      state.index = 0;
    }
    StateService.wpImport.save(state.page, state.index, state.todayCount);
    return;
  }

  // 4) نمر على الرحلات في هذه الصفحة مع حدود يومية وحد أقصى لكل تشغيل
  var batchMax = 200;      // ما نعالجش أكتر من 3 في كل run (تقدر تعدّلها)
  var batchCount = 0;

  while (state.index < list.length &&
         batchCount < batchMax &&
         state.todayCount < WP_IMPORT_DAILY_LIMIT) {

    var trip = list[state.index];

    if (!trip || !trip.core || !trip.core.id) {
      Logger.log("Skipping invalid trip at index " + state.index +
                 " on page " + state.page);
    } else {
      var tripIdStr = String(trip.core.id);

      // ✅ Check if trip already exists in Airtable
      var existingRecordId = AirtableUtils.getTripRecordIdByTripID(tripIdStr);
      if (existingRecordId) {
        Logger.log('⏭️  Trip ' + tripIdStr + ' already exists. Skipping.');
      } else {
        // ➕ Import new trip
        Logger.log('➕ Importing new trip: ' + tripIdStr);
        upsertTrip_(trip);
        
        // 🆕 Initialize enhancement pipeline
        var tripRecordId = AirtableUtils.getTripRecordIdByTripID(tripIdStr);
        if (tripRecordId && typeof initializeEnhancementPipeline_ === 'function') {
          initializeEnhancementPipeline_(tripRecordId);
          Logger.log('✅ Trip ' + tripIdStr + ' imported and pipeline initialized');
        }
      }
    }

    state.index++;
    state.todayCount++;
    batchCount++;
  }

  // 5) لو خلصنا الرحلات في الصفحة دي → ننتقل للصفحة اللي بعدها
  if (state.index >= list.length) {
    state.page++;
    state.index = 0;
    if (state.page > totalPages) {
      Logger.log("Reached last page " + totalPages + ". Nothing more to import.");
      // ممكن تسيب page = totalPages+1 عادي
    }
  }

  // 6) نحفظ الحالة الجديدة
  StateService.wpImport.save(state.page, state.index, state.todayCount);

  Logger.log("runImportStepSafe finished: page=" + state.page +
             ", index=" + state.index +
             ", todayCount=" + state.todayCount +
             ", batchCount=" + batchCount);
  } finally {
    lock.releaseLock();
  }
}

function updateTripInWordPress_(tripId, data) {
  var base = CONFIG.WP_API_URL_SINGLE;
  var url = base + '/' + encodeURIComponent(tripId);
  var headers = {};
  if (CONFIG.WP_API_USER && CONFIG.WP_API_PASS) {
    var token = Utilities.base64Encode(CONFIG.WP_API_USER + ':' + CONFIG.WP_API_PASS);
    headers.Authorization = 'Basic ' + token;
  }
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(data || {}),
    headers: headers,
    muteHttpExceptions: true,
  };
  var response = UrlFetchApp.fetch(url, options);
  var status = response.getResponseCode();
  var text = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error('WP update failed HTTP ' + status + ' — ' + text);
  }
  return JSON.parse(text);
}

function publishEnhancedTrip_(tripId, enhancedTrip) {
  if (!enhancedTrip || !enhancedTrip.core || !enhancedTrip.meta) {
    throw new Error('Enhanced payload is invalid');
  }
  return updateTripInWordPress_(tripId, enhancedTrip);
}

/**
 * Create time-driven trigger for automatic import
 * Run this once to set up automatic trip import from WordPress
 */
function createImportTrigger() {
  // Delete existing trigger first
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    var funcName = trigger.getHandlerFunction();
    if (funcName === 'runImportStepSafe') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('Deleted existing trigger: runImportStepSafe');
    }
  });
  
  // Create new trigger - runs every 10 minutes
  ScriptApp.newTrigger('runImportStepSafe')
    .timeBased()
    .everyMinutes(10)
    .create();
  
  Logger.log('✅ Created trigger: runImportStepSafe (every 10 minutes)');
  Logger.log('📊 Settings: ' + WP_IMPORT_DAILY_LIMIT + ' trips/day, 3 trips per run');
}
