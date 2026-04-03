const axios = require('axios')
const { sleep } = require('./runtime')

function createHttpClient(options) {
  const logger = options && options.logger ? options.logger : null
  const debug = !!(options && options.debug)

  const client = axios.create({
    timeout: 60_000,
    validateStatus: () => true
  })

  async function requestJson(url, req, maxRetries, backoffMs) {
    const retries = Number(maxRetries || 3)
    const backoff = Number(backoffMs || 500)
    const method = req && req.method ? String(req.method).toLowerCase() : 'get'
    const headers = (req && req.headers) || {}
    const data = req && Object.prototype.hasOwnProperty.call(req, 'data') ? req.data : undefined

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
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
        const ra = err.headers && (err.headers['retry-after'] || err.headers['Retry-After'])
        if (ra != null) {
          const raw = String(ra).trim()
          const secs = Number.parseInt(raw, 10)
          if (Number.isFinite(secs)) err.retryAfterMs = Math.max(0, secs * 1000)
          else {
            const ts = Date.parse(raw)
            if (Number.isFinite(ts)) err.retryAfterMs = Math.max(0, ts - Date.now())
          }
        }

        if (status >= 500 && attempt < retries - 1) {
          await sleep(backoff * Math.pow(2, attempt))
          continue
        }
        throw err
      } catch (err) {
        if (debug && logger) logger.warn(`HTTP error for ${url} attempt ${attempt}: ${String(err && err.message ? err.message : err)}`)
        if (err && err.status === 429) throw err
        if (attempt >= retries - 1) throw err
        await sleep(backoff * Math.pow(2, attempt))
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
