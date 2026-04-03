const { sleep } = require('../core/runtime')
const { escapeFormulaValue } = require('../core/airtable-client')
const mapper = require('./mapper')

function createUpsertService(options) {
  const airtable = options.airtable
  const config = options.config
  const logger = options.logger
  const fetchTripById = options.fetchTripById

  async function replaceChildRecordsForTrip(tableName, childRows, tripId, tripRecordId) {
    if (!tripRecordId) {
      logger.info(`No tripRecordId for table ${tableName}, skipping child replace.`)
      return
    }

    const linkFieldName = (config.LINK_FIELDS && config.LINK_FIELDS[tableName]) ? config.LINK_FIELDS[tableName] : config.DEFAULT_TRIP_LINK_FIELD

    if (!childRows || !childRows.length) {
      if (config.DEBUG) {
        logger.debug(`No child rows for ${tableName} (TripID=${tripId}), skipping delete & create.`)
      }
      return
    }

    const toDelete = []
    let offset = null

    do {
      const params = { pageSize: 100 }
      if (offset) params.offset = offset

      const existing = await airtable.airtableGet(tableName, params)
      const records = existing && existing.records ? existing.records : []
      offset = existing ? existing.offset : null

      for (const rec of records) {
        const fields = rec.fields || {}
        const linkVal = fields[linkFieldName]

        let match = false
        if (Array.isArray(linkVal)) {
          if (linkVal.indexOf(tripRecordId) !== -1) match = true
        } else if (typeof linkVal === 'string') {
          if (linkVal === tripRecordId) match = true
        }

        if (match) toDelete.push(rec.id)
      }
    } while (offset)

    if (toDelete.length && config.DEBUG) {
      logger.debug(`Deleting ${toDelete.length} existing records from ${tableName} for Trip record=${tripRecordId}`)
    }

    if (toDelete.length) await airtable.airtableBatchDelete(tableName, toDelete)

    const recordsFields = childRows.map((row) => {
      const fields = {}
      for (const k of Object.keys(row)) {
        if (k === 'TripID') continue
        fields[k] = row[k]
      }
      if (linkFieldName) fields[linkFieldName] = [tripRecordId]
      return fields
    })

    await airtable.airtableBatchCreate(tableName, recordsFields)
  }

  async function deleteChildRecordsForTripRecords(tableName, tripRecordIds) {
    if (!tripRecordIds || !tripRecordIds.length) return

    let linkFieldName = 'Trip'
    if (config.LINK_FIELDS && config.LINK_FIELDS[tableName]) linkFieldName = config.LINK_FIELDS[tableName]

    const toDelete = []
    let offset = null
    do {
      const params = { pageSize: 100 }
      if (offset) params.offset = offset
      const res = await airtable.airtableGet(tableName, params)
      const records = res && res.records ? res.records : []
      offset = res ? res.offset : null

      for (const rec of records) {
        const f = rec.fields || {}
        const linkVal = f[linkFieldName]
        let match = false

        if (Array.isArray(linkVal)) {
          for (const id of linkVal) {
            if (tripRecordIds.indexOf(id) !== -1) {
              match = true
              break
            }
          }
        } else if (typeof linkVal === 'string') {
          if (tripRecordIds.indexOf(linkVal) !== -1) match = true
        }

        if (match) toDelete.push(rec.id)
      }
    } while (offset)

    if (!toDelete.length) {
      if (config.DEBUG) logger.debug(`No child records to delete in ${tableName} for Trip record IDs: ${tripRecordIds.join(', ')}`)
      return
    }

    logger.info(`Deleting ${toDelete.length} records from ${tableName} for Trip record IDs: ${tripRecordIds.join(', ')}`)
    await airtable.airtableBatchDelete(tableName, toDelete)
  }

  async function deleteTripAndChildrenByTripId(tripId) {
    if (tripId === null || tripId === undefined) return
    const tripIdStr = String(tripId)
    logger.info(`deleteTripAndChildrenByTripId_: TripID=${tripIdStr}`)

    const formula = `({TripID} = "${escapeFormulaValue(tripIdStr)}")`
    const res = await airtable.airtableGet('Trips', { filterByFormula: formula, pageSize: 50 })
    const tripRecords = res && res.records ? res.records : []
    if (!tripRecords.length) {
      if (config.DEBUG) logger.debug(`No Trips records found for TripID=${tripIdStr} — nothing to delete.`)
      return
    }

    const tripRecordIds = tripRecords.map((r) => r.id)
    logger.info(`Found ${tripRecordIds.length} Trips record(s) for TripID=${tripIdStr} → deleting children + Trips.`)

    const childTables = [
      'TripHighlights',
      'ItinerarySteps',
      'TripFAQs',
      'TripIncludes',
      'TripExcludes',
      'AddOns',
      'PickupLocations',
      'TripDetails',
      'Packages',
      'Images',
      'Prices',
      'TripFacts'
    ]

    for (const tbl of childTables) {
      await deleteChildRecordsForTripRecords(tbl, tripRecordIds)
    }

    await airtable.airtableBatchDelete('Trips', tripRecordIds)
    logger.info(`Finished deleting Trip(s) and children for TripID=${tripIdStr}`)
  }

  async function buildSeoFocusKeywordsAggregateForTrip(trip) {
    const coreId = mapper.get_(trip, 'core.id', '')
    const seo = mapper.get_(trip, 'seo.rank_math', {}) || {}
    const meta = trip.meta || {}
    const baseFocus = seo.focus_keyword || meta.rank_math_focus_keyword || ''
    const baseList = mapper.parseCSV_(baseFocus)

    let primary = baseList.length ? baseList[0] : ''
    const all = [...baseList]

    const translations = mapper.get_(trip, 'language.translations', null)
    if (translations && typeof translations === 'object') {
      for (const lang of Object.keys(translations)) {
        const tid = translations[lang]
        if (!tid) continue
        if (String(tid) === String(coreId)) continue

        try {
          const tTrip = await fetchTripById(tid)
          const tSeo = mapper.get_(tTrip, 'seo.rank_math', {}) || {}
          const tMeta = tTrip.meta || {}
          const tFocus = tSeo.focus_keyword || tMeta.rank_math_focus_keyword || ''
          const tList = mapper.parseCSV_(tFocus)
          for (const k of tList) all.push(k)
        } catch (e) {
          logger.warn(`upsertTrip_: failed to fetch translation ${lang} (${tid}): ${String(e && e.message ? e.message : e)}`)
        }
      }
    }

    const seen = {}
    const deduped = []
    for (const x of all) {
      const s = String(x || '').trim()
      if (!s) continue
      const key = s.toLowerCase()
      if (seen[key]) continue
      seen[key] = true
      deduped.push(s)
    }

    if (!primary && deduped.length) primary = deduped[0]
    const list = deduped.filter((x) => x && x !== primary)

    return { primary, list }
  }

  async function upsertTrip(trip) {
    if (!trip) {
      logger.warn('upsertTrip_: trip is null/undefined, skipping.')
      return
    }

    const tripId = mapper.get_(trip, 'core.id', '')
    if (!tripId) {
      logger.warn('upsertTrip_: trip has no core.id, skipping.')
      return
    }

    try {
      trip._seoFocusKeywordsAggregate = await buildSeoFocusKeywordsAggregateForTrip(trip)
    } catch (eAgg) {
      logger.warn(`upsertTrip_: failed to build SEO_FocusKeywords_List aggregate: ${String(eAgg && eAgg.message ? eAgg.message : eAgg)}`)
    }

    const tripFields = mapper.mapTripToTripsRow_(trip)
    const formula = `({TripID} = "${escapeFormulaValue(String(tripId))}")`

    const existing = await airtable.airtableGet('Trips', { filterByFormula: formula, maxRecords: 1 })
    let tripRecordId = null

    if (existing.records && existing.records.length) {
      tripRecordId = existing.records[0].id
      if (config.DEBUG) logger.debug(`Updating Trips record ${tripRecordId} for TripID=${tripId}`)
      await airtable.airtableUpdate('Trips', tripRecordId, tripFields)
    } else {
      if (config.DEBUG) logger.debug(`Creating Trips record for TripID=${tripId}`)
      const created = await airtable.airtableCreate('Trips', tripFields)
      if (created && created.id) tripRecordId = created.id
      if (!tripRecordId && created && created.records && created.records.length) tripRecordId = created.records[0].id

      if (!tripRecordId) {
        const check = await airtable.airtableGet('Trips', { filterByFormula: formula, maxRecords: 1 })
        if (check.records && check.records.length) tripRecordId = check.records[0].id
      }
    }

    if (!tripRecordId) {
      logger.warn('upsertTrip_: no tripRecordId after create/update, skipping children.')
      return
    }

    await replaceChildRecordsForTrip('TripHighlights', mapper.extractHighlights_(trip), tripId, tripRecordId)
    await replaceChildRecordsForTrip('ItinerarySteps', mapper.extractItinerarySteps_(trip), tripId, tripRecordId)
    await replaceChildRecordsForTrip('TripFAQs', mapper.extractFAQs_(trip), tripId, tripRecordId)
    await replaceChildRecordsForTrip('TripIncludes', mapper.extractIncludes_(trip), tripId, tripRecordId)
    await replaceChildRecordsForTrip('TripExcludes', mapper.extractExcludes_(trip), tripId, tripRecordId)
    await replaceChildRecordsForTrip('AddOns', mapper.extractAddOns_(trip), tripId, tripRecordId)
    await replaceChildRecordsForTrip('PickupLocations', mapper.extractPickupLocations_(trip), tripId, tripRecordId)
    await replaceChildRecordsForTrip('TripDetails', mapper.extractTripDetails_(trip), tripId, tripRecordId)
    await replaceChildRecordsForTrip('Packages', mapper.extractPackages_(trip), tripId, tripRecordId)
    await replaceChildRecordsForTrip('Images', mapper.extractImages_(trip), tripId, tripRecordId)
    await replaceChildRecordsForTrip('Prices', mapper.extractPrices_(trip), tripId, tripRecordId)
    await replaceChildRecordsForTrip('TripFacts', mapper.extractTripFacts_(trip), tripId, tripRecordId)

    await sleep(50)
  }

  return {
    upsertTrip,
    deleteTripAndChildrenByTripId
  }
}

module.exports = { createUpsertService }

