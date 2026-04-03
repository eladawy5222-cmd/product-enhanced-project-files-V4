/************************************************************
 * HTTP UTILITIES
 * Generic helpers for calling external APIs (WordPress, Airtable).
 ************************************************************/

/**
 * Basic GET that returns JSON (parsed).
 */
function httpGetJson(url, headers, maxRetries, backoffMs) {
  return httpRequestJson(url, {
    method: 'get',
    headers: headers || {},
    muteHttpExceptions: true
  }, maxRetries, backoffMs);
}

/**
 * Basic POST that sends JSON and returns JSON.
 */
function httpPostJson(url, headers, bodyObj, maxRetries, backoffMs) {
  var opts = {
    method: 'post',
    headers: headers || {},
    muteHttpExceptions: true,
    payload: bodyObj ? JSON.stringify(bodyObj) : null,
    contentType: 'application/json'
  };
  return httpRequestJson(url, opts, maxRetries, backoffMs);
}

/**
 * Basic PATCH that sends JSON and returns JSON.
 */
function httpPatchJson(url, headers, bodyObj, maxRetries, backoffMs) {
  var opts = {
    method: 'patch',
    headers: headers || {},
    muteHttpExceptions: true,
    payload: bodyObj ? JSON.stringify(bodyObj) : null,
    contentType: 'application/json'
  };
  return httpRequestJson(url, opts, maxRetries, backoffMs);
}

/**
 * Basic DELETE that returns JSON or empty.
 */
function httpDelete(url, headers, maxRetries, backoffMs) {
  var opts = {
    method: 'delete',
    headers: headers || {},
    muteHttpExceptions: true
  };
  return httpRequestJson(url, opts, maxRetries, backoffMs);
}

/**
 * Core HTTP request with simple retry/backoff and JSON parsing.
 */
function httpRequestJson(url, options, maxRetries, backoffMs) {
  maxRetries = maxRetries || 3;
  backoffMs = backoffMs || 500;

  for (var attempt = 0; attempt < maxRetries; attempt++) {
    try {
      var resp = UrlFetchApp.fetch(url, options);
      var code = resp.getResponseCode();
      var text = resp.getContentText() || '';

      if (code >= 200 && code < 300) {
        if (!text) return {};
        try {
          return JSON.parse(text);
        } catch (e) {
          if (CONFIG.DEBUG) {
            Logger.log('JSON parse error for ' + url + ': ' + e + ' body=' + text);
          }
          return {};
        }
      }

      // non-2xx
      if (CONFIG.DEBUG) {
        Logger.log('HTTP ' + code + ' for ' + url + ' attempt ' + attempt + ' body=' + text);
      }
      // retry only on 5xx
      if (code >= 500 && attempt < maxRetries - 1) {
        Utilities.sleep(backoffMs * Math.pow(2, attempt));
        continue;
      }
      throw new Error('HTTP ' + code + ' ' + text);

    } catch (err) {
      if (CONFIG.DEBUG) {
        Logger.log('HTTP error for ' + url + ' attempt ' + attempt + ': ' + err);
      }
      if (attempt >= maxRetries - 1) {
        throw err;
      }
      Utilities.sleep(backoffMs * Math.pow(2, attempt));
    }
  }
  // should not reach here
  throw new Error('httpRequestJson exhausted retries for ' + url);
}
