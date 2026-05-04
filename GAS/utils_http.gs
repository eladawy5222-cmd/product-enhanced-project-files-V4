/************************************************************
 * HTTP UTILITIES
 * Generic helpers for calling external APIs (WordPress, Airtable).
 ************************************************************/

var HTTP_LAST_REQUEST_TS_ = 0;
var HTTP_MIN_INTERVAL_MS_ = 350;
var HTTP_AIRTABLE_MIN_INTERVAL_MS_ = 650;
var HTTP_WORDPRESS_MIN_INTERVAL_MS_ = 500;
var HTTP_MAX_RETRY_DELAY_MS_ = 12000;

function httpGetHostType_(url) {
  var u = String(url || '').toLowerCase();
  if (u.indexOf('api.airtable.com') !== -1) return 'airtable';
  if (u.indexOf('/wp-json/') !== -1) return 'wordpress';
  return 'generic';
}

function httpGetMinIntervalForUrl_(url) {
  var hostType = httpGetHostType_(url);
  if (hostType === 'airtable') return HTTP_AIRTABLE_MIN_INTERVAL_MS_;
  if (hostType === 'wordpress') return HTTP_WORDPRESS_MIN_INTERVAL_MS_;
  return HTTP_MIN_INTERVAL_MS_;
}

function httpSleepWithJitter_(baseMs) {
  var ms = Math.max(0, Number(baseMs) || 0);
  var jitter = Math.floor(Math.random() * 250);
  Utilities.sleep(ms + jitter);
}

function httpThrottleBeforeRequest_(url) {
  var minInterval = httpGetMinIntervalForUrl_(url);
  var now = new Date().getTime();
  var elapsed = now - HTTP_LAST_REQUEST_TS_;
  if (elapsed < minInterval) {
    httpSleepWithJitter_(minInterval - elapsed);
  }
  HTTP_LAST_REQUEST_TS_ = new Date().getTime();
}

function httpGetRetryDelayMs_(attempt, backoffMs, retryAfterMs, url) {
  var base = Math.max(Number(backoffMs) || 500, httpGetMinIntervalForUrl_(url));
  if (retryAfterMs && Number(retryAfterMs) > 0) {
    return Math.min(Number(retryAfterMs), HTTP_MAX_RETRY_DELAY_MS_);
  }
  return Math.min(base * Math.pow(2, attempt), HTTP_MAX_RETRY_DELAY_MS_);
}

function httpLooksLikeQuotaError_(code, text) {
  var body = String(text || '').toLowerCase();
  if (code !== 403 && code !== 429) return false;
  return body.indexOf('bandwidth quota exceeded') !== -1 ||
         body.indexOf('rate limit') !== -1 ||
         body.indexOf('too many requests') !== -1 ||
         body.indexOf('quota exceeded') !== -1;
}

function httpExtractRetryAfterMs_(resp) {
  try {
    var headers = resp && resp.getAllHeaders ? resp.getAllHeaders() : null;
    if (!headers) return 0;
    var raw = headers['Retry-After'] || headers['retry-after'] || 0;
    if (!raw) return 0;
    var seconds = Number(raw);
    if (isFinite(seconds) && seconds > 0) return Math.floor(seconds * 1000);
  } catch (e) {}
  return 0;
}

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
  maxRetries = maxRetries || 4;
  backoffMs = backoffMs || 900;

  for (var attempt = 0; attempt < maxRetries; attempt++) {
    try {
      httpThrottleBeforeRequest_(url);
      var resp = UrlFetchApp.fetch(url, options);
      var code = resp.getResponseCode();
      var text = resp.getContentText() || '';
      var retryAfterMs = httpExtractRetryAfterMs_(resp);

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
      if (httpLooksLikeQuotaError_(code, text) && attempt < maxRetries - 1) {
        var quotaDelay = httpGetRetryDelayMs_(attempt, backoffMs, retryAfterMs, url);
        Logger.log('HTTP quota/rate-limit for ' + url + ' attempt ' + attempt + ', retrying after ' + quotaDelay + ' ms');
        httpSleepWithJitter_(quotaDelay);
        continue;
      }
      // retry on transient server errors
      if ((code >= 500 || code === 408) && attempt < maxRetries - 1) {
        var serverDelay = httpGetRetryDelayMs_(attempt, backoffMs, retryAfterMs, url);
        Logger.log('HTTP transient error ' + code + ' for ' + url + ', retrying after ' + serverDelay + ' ms');
        httpSleepWithJitter_(serverDelay);
        continue;
      }
      throw new Error('HTTP ' + code + ' ' + text);

    } catch (err) {
      Logger.log('HTTP error for ' + url + ' attempt ' + attempt + ': ' + err);
      if (attempt >= maxRetries - 1) {
        throw err;
      }
      var errDelay = httpGetRetryDelayMs_(attempt, backoffMs, 0, url);
      httpSleepWithJitter_(errDelay);
    }
  }
  // should not reach here
  throw new Error('httpRequestJson exhausted retries for ' + url);
}

function normalizeWpApiBase_(raw) {
  var b = String(raw || '');
  var qIndex = b.indexOf('?');
  if (qIndex !== -1) b = b.substring(0, qIndex);
  if (b.endsWith('/')) b = b.slice(0, -1);
  if (b.endsWith('/trips')) b = b.slice(0, -6);
  if (b.endsWith('/trip')) b = b.slice(0, -5);
  return b;
}
