const { md5Base64 } = require('../core/runtime')

function normalizeText(s) {
  return String(s || '').replace(/\s+/g, ' ').trim()
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

function toIsoDateMaybe(v) {
  if (!v) return ''
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString()
  const s = String(v).trim()
  if (!s) return ''
  const t = Date.parse(s)
  if (!Number.isNaN(t)) return new Date(t).toISOString()
  return s
}

function getCfg(config, key, def) {
  const v = config && Object.prototype.hasOwnProperty.call(config, key) ? config[key] : undefined
  return v == null || String(v).trim() === '' ? def : v
}

function escapeFormulaValue(s) {
  return String(s || '').replace(/'/g, "\\'")
}

function createReviewsIngest(options) {
  const airtableSource = options.airtableSource
  const airtableTarget = options.airtableTarget
  const logger = options.logger
  const config = options.config
  const store = options.store

  if (!airtableSource) throw new Error('createReviewsIngest: missing airtableSource')
  if (!airtableTarget) throw new Error('createReviewsIngest: missing airtableTarget')
  if (!logger) throw new Error('createReviewsIngest: missing logger')
  if (!config) throw new Error('createReviewsIngest: missing config')
  if (!store) throw new Error('createReviewsIngest: missing store')

  const sourceTable = getCfg(config, 'REVIEWS_SOURCE_TABLE', 'List')
  const targetTable = getCfg(config, 'REVIEWS_TARGET_TABLE', 'TripReviews')
  const srcUpdatedAtField = getCfg(config, 'REVIEWS_SOURCE_UPDATED_AT_FIELD', 'UpdatedAt')
  const srcTripNameField = getCfg(config, 'REVIEWS_SOURCE_TRIP_NAME_FIELD', 'TripName')
  const srcBookingNrField = getCfg(config, 'REVIEWS_SOURCE_BOOKING_NR_FIELD', 'Booking Nr.')
  const srcCustomerField = getCfg(config, 'REVIEWS_SOURCE_CUSTOMER_NAME_FIELD', 'CustomerName')
  const srcDateField = getCfg(config, 'REVIEWS_SOURCE_REVIEW_DATE_FIELD', 'ReviewDate')
  const srcStarsField = getCfg(config, 'REVIEWS_SOURCE_STARS_FIELD', 'Stars')
  const srcContentField = getCfg(config, 'REVIEWS_SOURCE_CONTENT_FIELD', 'Content')
  const maxPerRun = Number(getCfg(config, 'REVIEWS_INGEST_MAX_PER_RUN', 200))
  const maxScan = Number(getCfg(config, 'REVIEWS_INGEST_MAX_SCAN', 5000))

  const storeKeyLegacy = 'REVIEWS_LAST_INGEST_ISO'
  const storeKeyBefore = 'REVIEWS_LAST_INGEST_BEFORE_ISO'
  const storeKeySince = 'REVIEWS_LAST_INGEST_SINCE_ISO'

  async function fetchSourcePage_(options) {
    const o = options && typeof options === 'object' ? options : {}
    const beforeIso = o.beforeIso ? String(o.beforeIso) : ''
    const sinceIso = o.sinceIso ? String(o.sinceIso) : ''
    const offset = o.offset ? String(o.offset) : ''

    const parts = []
    if (beforeIso) {
      parts.push(`IS_BEFORE({${srcUpdatedAtField}}, '${escapeFormulaValue(beforeIso)}')`)
    }
    if (sinceIso) {
      parts.push(`IS_AFTER({${srcUpdatedAtField}}, '${escapeFormulaValue(sinceIso)}')`)
    }
    const formula = parts.length ? `AND(${parts.join(',')})` : ''
    const params = {
      pageSize: 100,
      maxRecords: 100,
      'sort[0][field]': srcUpdatedAtField,
      'sort[0][direction]': 'desc'
    }
    if (offset) params.offset = offset
    if (formula) params.filterByFormula = formula
    return airtableSource.airtableGet(sourceTable, params)
  }

  function buildReviewHash_(src) {
    const key = [
      normalizeText(src.customerName).toLowerCase(),
      normalizeText(src.tripName).toLowerCase(),
      normalizeText(src.dateIso).slice(0, 10),
      String(src.stars || ''),
      normalizeText(src.content).toLowerCase()
    ].join('|')
    return md5Base64(key)
  }

  function mapSourceToTargetFields_(src, srcId, srcUpdatedAtIso) {
    const dateIso = toIsoDateMaybe(src.reviewDate)
    const stars = Number.parseInt(String(src.stars == null ? '' : src.stars), 10)
    const safeStars = Number.isFinite(stars) ? Math.max(1, Math.min(5, stars)) : 0
    const customerName = normalizeText(src.customerName)
    const tripName = normalizeText(src.tripName)
    const bookingNr = normalizeText(src.bookingNr)
    const content = normalizeText(stripAiReplyFromContent(src.content))

    const hash = buildReviewHash_({
      customerName,
      tripName,
      dateIso,
      stars: safeStars,
      content
    })

    const f = {}
    f.ReviewHash = hash
    f.SourceReviewId = String(srcId || '')
    f.SourceUpdatedAt = srcUpdatedAtIso ? String(srcUpdatedAtIso) : ''
    f.SourceTripName = tripName
    f['Booking Nr.'] = bookingNr
    f.CustomerName = customerName
    f.ReviewDate = dateIso
    f.Stars = safeStars || ''
    f.Content = content
    f.MatchStatus = 'Pending'
    f.LastSeenAt = new Date().toISOString()
    return f
  }

  async function upsertTarget_(fields) {
    const sourceId = String(fields.SourceReviewId || '').trim()
    if (sourceId) {
      return airtableTarget.airtableUpsertByField(targetTable, 'SourceReviewId', sourceId, fields)
    }
    const hash = String(fields.ReviewHash || '').trim()
    if (!hash) return null
    return airtableTarget.airtableUpsertByField(targetTable, 'ReviewHash', hash, fields)
  }

  async function runIngest() {
    let beforeIso = String(store.getProperty(storeKeyBefore) || '').trim()
    const legacy = String(store.getProperty(storeKeyLegacy) || '').trim()
    if (!beforeIso && legacy) beforeIso = legacy

    let sinceIso = String(store.getProperty(storeKeySince) || '').trim()
    if (!sinceIso && legacy) sinceIso = legacy

    logger.info(`ReviewsIngest: source=${sourceTable} target=${targetTable} since=${sinceIso || 'none'} before=${beforeIso || 'none'}`)

    let count = 0
    let scanned = 0
    let newestSeenIso = sinceIso || ''
    let oldestSeenIso = beforeIso || ''

    async function processPage_(page) {
      const recs = page && page.records ? page.records : []
      if (!recs.length) return

      for (const r of recs) {
        scanned++
        const id = r && r.id ? String(r.id) : ''
        const f = r && r.fields ? r.fields : {}
        const updatedAt = toIsoDateMaybe(f[srcUpdatedAtField] || '')
        if (updatedAt) {
          if (!newestSeenIso || updatedAt > newestSeenIso) newestSeenIso = updatedAt
          if (!oldestSeenIso || updatedAt < oldestSeenIso) oldestSeenIso = updatedAt
        }

        const src = {
          tripName: f[srcTripNameField] || '',
          bookingNr: f[srcBookingNrField] || '',
          customerName: f[srcCustomerField] || '',
          reviewDate: f[srcDateField] || '',
          stars: f[srcStarsField] || '',
          content: f[srcContentField] || ''
        }

        const mapped = mapSourceToTargetFields_(src, id, updatedAt)
        if (!mapped.ReviewHash || !mapped.Content || !mapped.Stars) {
          if (scanned >= maxScan || count >= maxPerRun) break
          continue
        }

        try {
          await upsertTarget_(mapped)
          count++
        } catch (e) {
          logger.warn(`ReviewsIngest: upsert failed hash=${mapped.ReviewHash} err=${String(e && e.message ? e.message : e)}`)
        }

        if (count >= maxPerRun) break
        if (scanned >= maxScan) break
      }
    }

    async function runPhase_(phase) {
      if (count >= maxPerRun || scanned >= maxScan) return

      let page
      try {
        page = await fetchSourcePage_(phase)
      } catch (e) {
        logger.warn(`ReviewsIngest: fetch failed (${String(e && e.message ? e.message : e)})`)
        return
      }

      while (page && scanned < maxScan && count < maxPerRun) {
        await processPage_(page)
        if (count >= maxPerRun || scanned >= maxScan) break
        if (!page.offset) break
        try {
          page = await fetchSourcePage_({ ...phase, offset: page.offset })
        } catch (e) {
          logger.warn(`ReviewsIngest: fetch next page failed (${String(e && e.message ? e.message : e)})`)
          break
        }
      }
    }

    if (!sinceIso) {
      await runPhase_({}) // initial run: start from newest (no filters), also sets both cursors
    } else {
      await runPhase_({ sinceIso }) // incremental: get new/updated records first
      if (count < maxPerRun && scanned < maxScan) {
        const backfillBefore = beforeIso || sinceIso
        await runPhase_({ beforeIso: backfillBefore })
      }
    }

    if (newestSeenIso && newestSeenIso !== sinceIso) store.setProperty(storeKeySince, newestSeenIso)
    if (oldestSeenIso && oldestSeenIso !== beforeIso) store.setProperty(storeKeyBefore, oldestSeenIso)

    logger.info(`ReviewsIngest: ingested=${count} scanned=${scanned} since=${newestSeenIso || sinceIso || 'none'} before=${oldestSeenIso || beforeIso || 'none'}`)
    return { ingested: count, updatedCursor: { sinceIso: newestSeenIso || sinceIso || null, beforeIso: oldestSeenIso || beforeIso || null } }
  }

  return { runIngest }
}

module.exports = { createReviewsIngest }
