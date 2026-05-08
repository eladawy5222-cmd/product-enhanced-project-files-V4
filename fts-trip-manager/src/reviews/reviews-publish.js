const { base64Encode } = require('../core/runtime')

function safeJsonParse(s) {
  if (!s) return null
  try {
    return JSON.parse(String(s))
  } catch {
    return null
  }
}

function getCfg(config, key, def) {
  const v = config && Object.prototype.hasOwnProperty.call(config, key) ? config[key] : undefined
  return v == null || String(v).trim() === '' ? def : v
}

function normalizeWpApiBase(base) {
  let b = String(base || '')
  const qIndex = b.indexOf('?')
  if (qIndex !== -1) b = b.substring(0, qIndex)
  if (b.endsWith('/')) b = b.slice(0, -1)
  if (b.endsWith('/trips')) b = b.slice(0, -6)
  if (b.endsWith('/trip')) b = b.slice(0, -5)
  return b
}

function toIsoDateMaybe(v) {
  if (!v) return ''
  const s = String(v).trim()
  if (!s) return ''
  const t = Date.parse(s)
  if (!Number.isNaN(t)) return new Date(t).toISOString()
  return s
}

function isContentUseful(s) {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  if (!t) return false
  if (t.length < 60) return false
  const letters = (t.match(/[a-z\u0600-\u06ff]/gi) || []).length
  if (letters < 20) return false
  const words = t.split(' ').filter(Boolean)
  if (words.length < 8) return false
  return true
}

function stripAiReplyFromContent(s) {
  const raw = String(s || '')
  if (!raw) return ''

  const m = raw.match(/[\s]*---[\s]*ai[\s]*reply[\s]*---/i)
  if (m && typeof m.index === 'number' && m.index >= 0) {
    return raw.slice(0, m.index).trim()
  }

  return raw.trim()
}

function pickPublishContent(content, summary, useSummaryFallback) {
  const c = String(content || '').trim()
  const s = String(summary || '').trim()
  if (useSummaryFallback && s && !isContentUseful(c)) return s
  return c
}

function fieldToText(v) {
  if (v == null) return ''
  if (typeof v === 'string') return v.trim()
  if (Array.isArray(v)) return v.map(x => fieldToText(x)).filter(Boolean).join(', ').trim()
  if (typeof v === 'object') {
    const t1 = typeof v.text === 'string' ? v.text.trim() : ''
    if (t1) return t1
    const t2 = typeof v.value === 'string' ? v.value.trim() : ''
    if (t2) return t2
    const t3 = typeof v.result === 'string' ? v.result.trim() : ''
    if (t3) return t3
    return ''
  }
  return String(v).trim()
}

function buildReviewsData(reviews, topN) {
  const cleaned = []
  let sum = 0
  for (const r of reviews) {
    const stars = Number.parseInt(String(r.stars || ''), 10)
    if (!Number.isFinite(stars) || stars < 1 || stars > 5) continue
    const author = String(r.author || '').trim()
    const content = String(r.content || '').trim()
    if (!content) continue
    const dateIso = toIsoDateMaybe(r.date || '')
    cleaned.push({
      title: author || 'Traveler',
      stars,
      content,
      date: dateIso ? dateIso.slice(0, 10) : ''
    })
    sum += stars
  }
  cleaned.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  const top = cleaned.slice(0, Math.max(1, Number.isFinite(topN) ? topN : 12))
  const out = {
    average: cleaned.length ? Math.round((sum / cleaned.length) * 10) / 10 : 0,
    count: cleaned.length,
    reviews: cleaned,
    top
  }
  return out
}

function createReviewsPublisher(options) {
  const airtable = options.airtable
  const http = options.http
  const logger = options.logger
  const config = options.config

  if (!airtable) throw new Error('createReviewsPublisher: missing airtable')
  if (!http) throw new Error('createReviewsPublisher: missing http')
  if (!logger) throw new Error('createReviewsPublisher: missing logger')
  if (!config) throw new Error('createReviewsPublisher: missing config')

  const reviewsTable = getCfg(config, 'REVIEWS_TARGET_TABLE', 'TripReviews')
  const tripsTable = getCfg(config, 'REVIEWS_TRIPS_TABLE', 'Trips')
  const maxTrips = Number(getCfg(config, 'REVIEWS_PUBLISH_MAX_TRIPS_PER_RUN', 40))
  const topN = Number(getCfg(config, 'REVIEWS_PUBLISH_TOP_N', 12))
  const requireAllMatched = String(getCfg(config, 'REVIEWS_PUBLISH_REQUIRE_ALL_MATCHED', 'true')).trim().toLowerCase() === 'true'
  const useSummaryFallback = String(getCfg(config, 'REVIEWS_PUBLISH_USE_SUMMARY_FALLBACK', 'true')).trim().toLowerCase() === 'true'

  function authHeaders() {
    const headers = {}
    if (config.WP_API_USER && config.WP_API_PASS) {
      headers.Authorization = `Basic ${base64Encode(config.WP_API_USER + ':' + config.WP_API_PASS)}`
    }
    return headers
  }

  async function fetchChangedTrips_() {
    const formula = `AND({MatchStatus}='Matched', OR({WP_Published_At}='', {WP_Published_At}=BLANK()))`
    try {
      return airtable.airtableGet(reviewsTable, { filterByFormula: formula, maxRecords: 500, pageSize: 100 })
    } catch (e) {
      logger.warn(`ReviewsPublish: fetch failed (${String(e && e.message ? e.message : e)})`)
      return { records: [] }
    }
  }

  async function getTripWpId_(tripRecordId) {
    try {
      const res = await airtable.airtableGet(tripsTable, { filterByFormula: `RECORD_ID()='${String(tripRecordId).replace(/'/g, "\\'")}'`, maxRecords: 1, pageSize: 1 })
      const recs = res && res.records ? res.records : []
      if (!recs.length) return null
      const f = recs[0].fields || {}
      const wpId = String(f.TripID || '').trim()
      return wpId ? wpId : null
    } catch {
      return null
    }
  }

  async function fetchTripReviews_(tripRecordId, wpTripId) {
    const rid = String(tripRecordId || '').trim()
    const wid = String(wpTripId || '').trim()
    if (!rid && !wid) return { reviews: [], allRecordIds: [] }

    const parts = []
    if (wid) parts.push(`FIND('${String(wid).replace(/'/g, "\\'")}', ARRAYJOIN({Trip}))`)
    if (rid) parts.push(`FIND('${String(rid).replace(/'/g, "\\'")}', ARRAYJOIN({Trip}))`)

    const matchTrip = parts.length === 1 ? parts[0] : `OR(${parts.join(',')})`
    const formula = `AND({MatchStatus}='Matched', ${matchTrip})`
    try {
      const res = await airtable.airtableGet(reviewsTable, { filterByFormula: formula, maxRecords: 100, pageSize: 100 })
      const recs = res && res.records ? res.records : []
      const out = []
      const allRecordIds = []
      for (const r of recs) {
        allRecordIds.push(r.id)
        const f = r && r.fields ? r.fields : {}
        const summary = fieldToText(f.Content_Summary) || fieldToText(f['Content Summary'])
        const rawContent = fieldToText(f.Content)
        const cleanedContent = stripAiReplyFromContent(rawContent)
        const content = pickPublishContent(cleanedContent, summary, useSummaryFallback)
        out.push({
          recordId: r.id,
          author: f.CustomerName || '',
          date: f.ReviewDate || '',
          stars: f.Stars || '',
          content
        })
      }
      return { reviews: out, allRecordIds }
    } catch {
      return { reviews: [], allRecordIds: [] }
    }
  }

  async function pushToWordPress_(wpTripId, reviewsData) {
    const baseUrl = normalizeWpApiBase(config.WP_API_BASE)
    const url = `${baseUrl}/trip/${encodeURIComponent(String(wpTripId))}`
    const payload = {
      meta: {
        fts_reviews_data: {
          ...reviewsData,
          updated_at: new Date().toISOString()
        }
      }
    }
    return http.postJson(url, authHeaders(), payload)
  }

  async function markPublished_(reviewRecordIds) {
    const now = new Date().toISOString()
    for (const id of reviewRecordIds) {
      try {
        await airtable.airtableUpdate(reviewsTable, id, { WP_Published_At: now })
      } catch (e) {
        logger.warn(`ReviewsPublish: mark published failed (${String(e && e.message ? e.message : e)})`)
      }
    }
  }

  async function checkUnmatchedBeforePublish_() {
    if (!requireAllMatched) return { ok: true, pending: 0, truncated: false }
    const formula = `OR({MatchStatus}='Pending', {MatchStatus}='NeedsReview')`
    try {
      const res = await airtable.airtableGet(reviewsTable, { filterByFormula: formula, maxRecords: 50, pageSize: 50 })
      const recs = res && res.records ? res.records : []
      const truncated = !!(res && res.offset)
      const pending = recs.length
      if (pending > 0) {
        const suffix = truncated ? '+' : ''
        return { ok: false, pending, truncated, message: `Publish blocked: ${pending}${suffix} reviews are not matched (Pending/NeedsReview). Run Reviews Sync and resolve NeedsReview before publishing.` }
      }
      return { ok: true, pending: 0, truncated: false }
    } catch (e) {
      return { ok: false, pending: 0, truncated: false, message: `Publish blocked: failed to check unmatched reviews (${String(e && e.message ? e.message : e)})` }
    }
  }

  async function runPublish() {
    const gate = await checkUnmatchedBeforePublish_()
    if (!gate.ok) {
      logger.warn(`ReviewsPublish: ${gate.message}`)
      throw new Error(gate.message)
    }

    const changed = await fetchChangedTrips_()
    const recs = changed && changed.records ? changed.records : []
    if (!recs.length) {
      logger.info('ReviewsPublish: nothing to publish')
      return { trips: 0, reviews: 0 }
    }

    const tripSet = new Set()
    for (const r of recs) {
      const f = r && r.fields ? r.fields : {}
      const trip = Array.isArray(f.Trip) ? String(f.Trip[0] || '') : ''
      if (trip) tripSet.add(trip)
      if (tripSet.size >= maxTrips) break
    }

    let tripsPublished = 0
    let reviewsPublished = 0

    for (const tripRecordId of Array.from(tripSet)) {
      const wpTripId = await getTripWpId_(tripRecordId)
      if (!wpTripId) continue
      const tripFetch = await fetchTripReviews_(tripRecordId, wpTripId)
      const tripReviews = tripFetch && Array.isArray(tripFetch.reviews) ? tripFetch.reviews : []
      const allRecordIds = tripFetch && Array.isArray(tripFetch.allRecordIds) ? tripFetch.allRecordIds : []
      if (!tripReviews.length && !allRecordIds.length) continue

      const reviewsData = buildReviewsData(tripReviews, topN)
      if (!reviewsData.count) {
        if (allRecordIds.length) await markPublished_(allRecordIds)
        continue
      }

      try {
        await pushToWordPress_(wpTripId, reviewsData)
        await markPublished_(allRecordIds.length ? allRecordIds : tripReviews.map(x => x.recordId))
        tripsPublished++
        reviewsPublished += reviewsData.count
        logger.info(`ReviewsPublish: pushed trip=${wpTripId} count=${reviewsData.count} avg=${reviewsData.average}`)
      } catch (e) {
        logger.warn(`ReviewsPublish: push failed trip=${wpTripId} (${String(e && e.message ? e.message : e)})`)
      }
    }

    return { trips: tripsPublished, reviews: reviewsPublished }
  }

  async function runPublishTrip(tripRecordId, options) {
    const rid = String(tripRecordId || '').trim()
    if (!rid) throw new Error('Missing tripRecordId')

    const ov = options && typeof options === 'object' ? options : {}
    const ignoreGate = String(ov.ignoreGate || 'true').trim().toLowerCase() === 'true'

    if (!ignoreGate) {
      const gate = await checkUnmatchedBeforePublish_()
      if (!gate.ok) {
        logger.warn(`ReviewsPublish: ${gate.message}`)
        throw new Error(gate.message)
      }
    }

    const wpTripId = await getTripWpId_(rid)
    if (!wpTripId) {
      return { ok: false, message: 'Trip has no TripID/WP id (cannot publish)', tripRecordId: rid }
    }

    const tripFetch = await fetchTripReviews_(rid, wpTripId)
    const tripReviews = tripFetch && Array.isArray(tripFetch.reviews) ? tripFetch.reviews : []
    const allRecordIds = tripFetch && Array.isArray(tripFetch.allRecordIds) ? tripFetch.allRecordIds : []

    if (!tripReviews.length && !allRecordIds.length) {
      return { ok: true, trip: wpTripId, tripRecordId: rid, reviews: 0, skippedAll: true }
    }

    const reviewsData = buildReviewsData(tripReviews, topN)
    if (!reviewsData.count) {
      if (allRecordIds.length) await markPublished_(allRecordIds)
      return { ok: true, trip: wpTripId, tripRecordId: rid, reviews: 0, excludedByPolicy: allRecordIds.length }
    }

    await pushToWordPress_(wpTripId, reviewsData)
    await markPublished_(allRecordIds.length ? allRecordIds : tripReviews.map(x => x.recordId))
    logger.info(`ReviewsPublish: pushed trip=${wpTripId} count=${reviewsData.count} avg=${reviewsData.average}`)

    return { ok: true, trip: wpTripId, tripRecordId: rid, reviews: reviewsData.count, average: reviewsData.average, totalMatched: allRecordIds.length }
  }

  return { runPublish, runPublishTrip }
}

module.exports = { createReviewsPublisher }
