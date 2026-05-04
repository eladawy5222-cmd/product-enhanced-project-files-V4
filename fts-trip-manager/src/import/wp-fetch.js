const { base64Encode } = require('../core/runtime')

function normalizeWpApiBase(base) {
  let b = String(base || '')
  const qIndex = b.indexOf('?')
  if (qIndex !== -1) b = b.substring(0, qIndex)
  if (b.endsWith('/')) b = b.slice(0, -1)
  if (b.endsWith('/trips')) b = b.slice(0, -6)
  if (b.endsWith('/trip')) b = b.slice(0, -5)
  return b
}

function normalizeWpTripEndpoint(base) {
  let b = normalizeWpApiBase(base)
  if (!b.endsWith('/trip')) b = b + '/trip'
  return b
}

function createWpClient(options) {
  const http = options.http
  const config = options.config

  function authHeaders() {
    const headers = {}
    if (config.WP_API_USER && config.WP_API_PASS) {
      headers.Authorization = `Basic ${base64Encode(config.WP_API_USER + ':' + config.WP_API_PASS)}`
    }
    return headers
  }

  async function fetchTripById(tripId) {
    const base = normalizeWpTripEndpoint(config.WP_API_BASE)
    const url = `${base}/${encodeURIComponent(String(tripId))}`
    const json = await http.getJson(url, authHeaders())
    if (!json || !json.core || !json.core.id) throw new Error(`Failed to fetch trip by ID: ${tripId}`)
    return json
  }

  async function fetchTripsPage(page) {
    const perPage = config.WP_PER_PAGE || 20
    const base = normalizeWpApiBase(config.WP_API_BASE) + '/trips'
    const sep = base.indexOf('?') === -1 ? '?' : '&'
    const url = `${base}${sep}page=${encodeURIComponent(String(page))}&per_page=${encodeURIComponent(String(perPage))}`
    return http.getJson(url, authHeaders())
  }

  return { fetchTripById, fetchTripsPage }
}

module.exports = { createWpClient }
