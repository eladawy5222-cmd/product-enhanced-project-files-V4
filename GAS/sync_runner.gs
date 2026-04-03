/************************************************************
 * SYNC RUNNER — incremental safe import from WPTE → Airtable
 ************************************************************/

/**
 * Fetch a single page of trips from the WordPress / WPTE API.
 * Assumes the API returns JSON like:
 * { data: [trip, ...], pagination: { total_pages: N } }
 *
 * You MUST adjust this function if your WP endpoint is different.
 */
function fetchTripsPage_(page) {
  loadConfigSecrets_();
  var url = CONFIG.WP_API_BASE;
  var perPage = CONFIG.WP_PER_PAGE || 20;  // لو مش محدد في config هنستخدم 20

  var sep = url.indexOf('?') === -1 ? '?' : '&';
  url += sep + 'page=' + encodeURIComponent(page) +
         '&per_page=' + encodeURIComponent(perPage);

  var headers = {};
  if (CONFIG.WP_API_USER && CONFIG.WP_API_PASS) {
    var token = Utilities.base64Encode(CONFIG.WP_API_USER + ':' + CONFIG.WP_API_PASS);
    headers.Authorization = 'Basic ' + token;
  }

  if (CONFIG.DEBUG) {
    Logger.log('Fetching WPTE page ' + page + ' from ' + url);
  }

  var json = httpGetJson(url, headers);
  // هنا بنتوقع نفس اللي في الـ PHP: { pagination: {...}, data: [...] }
  return json;
}


/**
 * Manual full run for testing (be careful with limits).
 */
function runImportOnceForTesting() {
  CONFIG.DEBUG = true;
  runImportStepSafe();
}

function testFetchFirstPage() {
  var json = fetchTripsPage_(1);
  Logger.log(JSON.stringify(json, null, 2));
}
function resetWpImportStateForToday() {
  var props = PropertiesService.getScriptProperties();
  
  // نخلّي العداد بتاع النهاردة يبدأ من الصفر من جديد
  props.deleteProperty('wp_import_today_count');
  props.deleteProperty('wp_import_today_date');
  
  // ولو حابب كمان نرجّع المؤشر لأول صفحة وأول رحلة:
  // props.deleteProperty('wp_import_page');
  // props.deleteProperty('wp_import_index');
  
  Logger.log('WP import daily state has been reset.');
}
