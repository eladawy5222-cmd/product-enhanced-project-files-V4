const axios = require('axios')
const { sleep } = require('./runtime')

let HTTP_LAST_REQUEST_TS = 0
const HTTP_MIN_INTERVAL_MS = 350
const HTTP_AIRTABLE_MIN_INTERVAL_MS = 650
const HTTP_WORDPRESS_MIN_INTERVAL_MS = 500
const HTTP_MAX_RETRY_DELAY_MS = 12000

function getHostType(url) {
  const u = String(url || '').toLowerCase()
  if (u.includes('api.airtable.com')) return 'airtable'
  if (u.includes('/wp-json/')) return 'wordpress'
  return 'generic'
}

function getMinIntervalForUrl(url) {
  const hostType = getHostType(url)
  if (hostType === 'airtable') return HTTP_AIRTABLE_MIN_INTERVAL_MS
  if (hostType === 'wordpress') return HTTP_WORDPRESS_MIN_INTERVAL_MS
  return HTTP_MIN_INTERVAL_MS
}

async function sleepWithJitter(baseMs) {
  const ms = Math.max(0, Number(baseMs) || 0)
  const jitter = Math.floor(Math.random() * 250)
  await sleep(ms + jitter)
}

async function throttleBeforeRequest(url) {
  const minInterval = getMinIntervalForUrl(url)
  const now = Date.now()
  const elapsed = now - HTTP_LAST_REQUEST_TS
  if (elapsed < minInterval) {
    await sleepWithJitter(minInterval - elapsed)
  }
  HTTP_LAST_REQUEST_TS = Date.now()
}

function getRetryDelayMs(attempt, backoffMs, retryAfterMs, url) {
  const base = Math.max(Number(backoffMs) || 500, getMinIntervalForUrl(url))
  if (retryAfterMs && Number(retryAfterMs) > 0) {
    return Math.min(Number(retryAfterMs), HTTP_MAX_RETRY_DELAY_MS)
  }
  return Math.min(base * Math.pow(2, attempt), HTTP_MAX_RETRY_DELAY_MS)
}

function looksLikeQuotaError(status, bodyText) {
  const body = String(bodyText || '').toLowerCase()
  if (status !== 403 && status !== 429) return false
  return body.includes('bandwidth quota exceeded') ||
    body.includes('rate limit') ||
    body.includes('too many requests') ||
    body.includes('quota exceeded')
}

function extractRetryAfterMs(headers) {
  const raw = headers && (headers['retry-after'] || headers['Retry-After'])
  if (raw == null) return 0
  const value = String(raw).trim()
  const secs = Number.parseInt(value, 10)
  if (Number.isFinite(secs) && secs > 0) return secs * 1000
  const ts = Date.parse(value)
  if (Number.isFinite(ts)) return Math.max(0, ts - Date.now())
  return 0
}

function createHttpClient(options) {
  const logger = options && options.logger ? options.logger : null
  const debug = !!(options && options.debug)

  const client = axios.create({
    timeout: 60_000,
    validateStatus: () => true
  })

  async function requestJson(url, req, maxRetries, backoffMs) {
    const retries = Number(maxRetries || 4)
    const backoff = Number(backoffMs || 900)
    const method = req && req.method ? String(req.method).toLowerCase() : 'get'
    const headers = (req && req.headers) || {}
    const data = req && Object.prototype.hasOwnProperty.call(req, 'data') ? req.data : undefined

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await throttleBeforeRequest(url)
        const resp = await client.request({ url, method, headers, data })
        const status = resp.status

        if (status >= 200 && status < 300) {
          if (resp.data == null) return {}
          return resp.data
        }

        const bodyText = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data)
        if (debug && logger) logger.warn(`HTTP ${status} for ${url} attempt ${attempt + 1} body=${bodyText}`)

        const err = new Error(`HTTP ${status} ${bodyText}`)
        err.status = status
        err.headers = resp.headers || {}
        err.body = resp.data
        err.isBandwidthQuotaExceeded = looksLikeQuotaError(status, bodyText)
        err.retryAfterMs = extractRetryAfterMs(err.headers)

        if (err.isBandwidthQuotaExceeded && attempt < retries - 1) {
          const waitMs = getRetryDelayMs(attempt, backoff, err.retryAfterMs, url)
          if (logger) logger.warn(`HTTP quota/rate-limit for ${url} attempt ${attempt + 1}, retrying after ${waitMs} ms`)
          await sleepWithJitter(waitMs)
          continue
        }
        if ((status >= 500 || status === 408) && attempt < retries - 1) {
          const waitMs = getRetryDelayMs(attempt, backoff, err.retryAfterMs, url)
          if (logger) logger.warn(`HTTP transient error ${status} for ${url}, retrying after ${waitMs} ms`)
          await sleepWithJitter(waitMs)
          continue
        }
        throw err
      } catch (err) {
        if (debug && logger) logger.warn(`HTTP error for ${url} attempt ${attempt}: ${String(err && err.message ? err.message : err)}`)
        if (attempt >= retries - 1) throw err
        const waitMs = getRetryDelayMs(attempt, backoff, err && err.retryAfterMs, url)
        await sleepWithJitter(waitMs)
      }
    }
    throw new Error(`httpRequestJson exhausted retries for ${url}`)
  }

  return {
    requestJson,
    getJson(url, headers, maxRetries, backoffMs) {
      return requestJson(url, { method: 'get', headers: headers || {} }, maxRetries, backoffMs)
    },
    postJson(url, headers, bodyObj, maxRetries, backoffMs) {
      return requestJson(url, { method: 'post', headers: headers || {}, data: bodyObj || null }, maxRetries, backoffMs)
    },
    patchJson(url, headers, bodyObj, maxRetries, backoffMs) {
      return requestJson(url, { method: 'patch', headers: headers || {}, data: bodyObj || null }, maxRetries, backoffMs)
    },
    deleteJson(url, headers, maxRetries, backoffMs) {
      return requestJson(url, { method: 'delete', headers: headers || {} }, maxRetries, backoffMs)
    },
    raw: client
  }
}

module.exports = { createHttpClient }
