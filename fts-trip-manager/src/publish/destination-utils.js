const destinationCacheByLang = {}

function normalizeKey(value) {
  return String(value == null ? '' : value).trim().toLowerCase()
}

function normalizeWpApiBase(raw) {
  let b = String(raw || '')
  const qIndex = b.indexOf('?')
  if (qIndex !== -1) b = b.substring(0, qIndex)
  if (b.endsWith('/')) b = b.slice(0, -1)
  if (b.endsWith('/trips')) b = b.slice(0, -6)
  if (b.endsWith('/trip')) b = b.slice(0, -5)
  return b
}

function slugify(value) {
  return normalizeKey(value)
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function uniq(arr) {
  const seen = new Set()
  const out = []
  for (const x of arr) {
    const v = Number.isFinite(Number(x)) ? Number(x) : x
    const k = String(v)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(v)
  }
  return out
}

function extractNamesFromMaybe(value) {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v == null ? '' : v).trim())
      .flatMap((s) => s.split(/\s*[,|\n]+\s*/g))
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return String(value)
    .split(/\s*[,|\n]+\s*/g)
    .map((s) => s.trim())
    .filter(Boolean)
}

function extractDestinationNames({ tripFields, tripDetails, wpTripInfo }) {
  const names = []

  if (wpTripInfo && wpTripInfo.taxonomies && Array.isArray(wpTripInfo.taxonomies.destination)) {
    for (const d of wpTripInfo.taxonomies.destination) {
      if (d && d.name) names.push(String(d.name))
    }
  }

  if (tripFields) {
    names.push(...extractNamesFromMaybe(tripFields.Destination))
    names.push(...extractNamesFromMaybe(tripFields.Destinations))
    names.push(...extractNamesFromMaybe(tripFields.TourLocation))
    names.push(...extractNamesFromMaybe(tripFields.Location))
    names.push(...extractNamesFromMaybe(tripFields.Cities))
  }

  if (tripDetails) {
    names.push(...extractNamesFromMaybe(tripDetails.Destination))
    names.push(...extractNamesFromMaybe(tripDetails.Destinations))
    names.push(...extractNamesFromMaybe(tripDetails.TourLocation))
    names.push(...extractNamesFromMaybe(tripDetails.Location))
    names.push(...extractNamesFromMaybe(tripDetails.City))
  }

  return uniq(names.map((n) => String(n).trim()).filter(Boolean))
}

async function fetchAllDestinations({ fetchUrl, config, base64Encode, lang }) {
  const wpBase = String(config.WP_API_BASE || '').replace(/\/fts\/v1.*$/, '').replace(/\/$/, '')
  if (!wpBase) throw new Error('Missing WP_API_BASE')

  const auth = 'Basic ' + base64Encode(String(config.WP_API_USER || '') + ':' + String(config.WP_API_PASS || ''))
  const out = []

  for (let page = 1; page <= 20; page++) {
    let url = wpBase + '/wp/v2/destination?per_page=100&page=' + page
    if (lang) url += '&lang=' + encodeURIComponent(String(lang))

    const resp = await fetchUrl(url, {
      method: 'get',
      headers: { Authorization: auth },
      muteHttpExceptions: true
    })

    const code = resp.getResponseCode()
    const text = resp.getContentText()
    if (code !== 200) {
      throw new Error('WP destinations fetch error (' + code + '): ' + String(text).slice(0, 200))
    }

    let json = []
    try { json = JSON.parse(text) } catch { json = [] }
    if (!Array.isArray(json) || json.length === 0) break
    out.push(...json)
    if (json.length < 100) break
  }

  return out
}

function indexDestinations(terms) {
  const byId = {}
  const byName = {}
  const bySlug = {}

  for (const t of terms) {
    if (!t || t.id == null) continue
    const id = Number(t.id)
    if (!Number.isFinite(id)) continue
    byId[id] = t

    if (t.name) byName[normalizeKey(t.name)] = id
    if (t.slug) bySlug[normalizeKey(t.slug)] = id
  }

  return { byId, byName, bySlug }
}

function collectParentIds(term, byId) {
  const ids = []
  let cur = term
  let guard = 0
  while (cur && cur.parent && guard < 10) {
    const pid = Number(cur.parent)
    if (!Number.isFinite(pid) || pid <= 0) break
    ids.push(pid)
    cur = byId[pid]
    guard += 1
  }
  return ids
}

async function ensureLangCache({ fetchUrl, config, base64Encode, lang }) {
  const lc = String(lang || 'en')
  if (destinationCacheByLang[lc]) return destinationCacheByLang[lc]
  const terms = await fetchAllDestinations({ fetchUrl, config, base64Encode, lang: lc })
  const index = indexDestinations(terms)
  destinationCacheByLang[lc] = { terms, index }
  return destinationCacheByLang[lc]
}

async function resolveDestinationIds({ fetchUrl, config, base64Encode, lang, wpTripInfo, tripFields, tripDetails }) {
  const lc = String(lang || 'en')
  const cache = await ensureLangCache({ fetchUrl, config, base64Encode, lang: lc })
  const byId = cache.index.byId

  const ids = []

  if (wpTripInfo && wpTripInfo.taxonomies && Array.isArray(wpTripInfo.taxonomies.destination) && wpTripInfo.taxonomies.destination.length) {
    for (const d of wpTripInfo.taxonomies.destination) {
      if (d && d.id != null) ids.push(Number(d.id))
    }
  } else {
    const names = extractDestinationNames({ tripFields, tripDetails, wpTripInfo })
    for (const name of names) {
      const k = normalizeKey(name)
      const slug = slugify(name)
      const id = cache.index.byName[k] || cache.index.bySlug[k] || cache.index.bySlug[slug] || null
      if (id) ids.push(Number(id))
    }
  }

  const withParents = []
  for (const id of ids) {
    if (!Number.isFinite(Number(id))) continue
    withParents.push(Number(id))
    const term = byId[Number(id)]
    if (term) withParents.push(...collectParentIds(term, byId))
  }

  const finalIds = uniq(withParents).filter((x) => Number.isFinite(Number(x)) && Number(x) > 0)
  return finalIds
}

function createDestinationService(options) {
  const fetchUrl = options.fetchUrl
  const config = options.config
  const base64Encode = options.base64Encode

  if (!fetchUrl) throw new Error('createDestinationService: missing fetchUrl')
  if (!config) throw new Error('createDestinationService: missing config')
  if (!base64Encode) throw new Error('createDestinationService: missing base64Encode')

  async function applyDestinationsToPayload(payload, ctx) {
    const ids = await resolveDestinationIds({
      fetchUrl,
      config,
      base64Encode,
      lang: ctx && ctx.lang ? ctx.lang : 'en',
      wpTripInfo: ctx && ctx.wpTripInfo ? ctx.wpTripInfo : null,
      tripFields: ctx && ctx.tripFields ? ctx.tripFields : null,
      tripDetails: ctx && ctx.tripDetails ? ctx.tripDetails : null
    })

    if (ids && ids.length) {
      payload.destinations = ids
    }
  }

  return { applyDestinationsToPayload }
}

module.exports = { createDestinationService, normalizeWpApiBase }
