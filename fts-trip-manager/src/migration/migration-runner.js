const { MIGRATION_CONFIG } = require('../config/migration-config')
const { escapeFormulaValue } = require('../core/airtable-client')
const { createMigrationMapper } = require('./migration-mapper')

function createMigrationRunner(options) {
  const airtable = options.airtable
  const http = options.http
  const config = options.config
  const logger = options.logger
  const store = options.store
  const lock = options.lock
  const orchestrator = options.orchestrator

  if (!airtable) throw new Error('createMigrationRunner: missing options.airtable')
  if (!http) throw new Error('createMigrationRunner: missing options.http')
  if (!config) throw new Error('createMigrationRunner: missing options.config')
  if (!logger) throw new Error('createMigrationRunner: missing options.logger')
  if (!store) throw new Error('createMigrationRunner: missing options.store')

  const mapper = createMigrationMapper({ logger, store })
  const effectiveLock = lock || {
    async tryLock() {
      return true
    },
    releaseLock() {
    }
  }

  function oldBaseHeaders() {
    if (!config.AIRTABLE_API_KEY) throw new Error('Missing AIRTABLE_API_KEY')
    return {
      Authorization: `Bearer ${config.AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    }
  }

  function oldBaseTableUrl() {
    return `https://api.airtable.com/v0/${encodeURIComponent(MIGRATION_CONFIG.OLD_BASE_ID)}/${encodeURIComponent(MIGRATION_CONFIG.OLD_TABLE_NAME)}`
  }

  async function fetchOldTrips(maxRecords) {
    let url = oldBaseTableUrl()
    const qs = []
    if (maxRecords) qs.push(`maxRecords=${encodeURIComponent(String(maxRecords))}`)
    if (MIGRATION_CONFIG.MARK_AS_MIGRATED) {
      const statusField = MIGRATION_CONFIG.MIGRATION_STATUS_FIELD
      const formula = `NOT({${statusField}})`
      qs.push(`filterByFormula=${encodeURIComponent(formula)}`)
    }
    if (qs.length) url += `?${qs.join('&')}`

    if (MIGRATION_CONFIG.DEBUG) logger.info(`Fetching from old base: ${url}`)
    const response = await http.getJson(url, oldBaseHeaders())
    if (!response || !response.records) throw new Error('Failed to fetch records from old base')
    if (MIGRATION_CONFIG.DEBUG) logger.info(`Fetched ${response.records.length} unmigrated records from old base`)
    return response.records
  }

  async function markTripAsMigrated(oldRecordId, tripId) {
    if (!oldRecordId) {
      logger.warn('Cannot mark as migrated: missing old record ID')
      return
    }

    try {
      const statusField = MIGRATION_CONFIG.MIGRATION_STATUS_FIELD
      const url = `${oldBaseTableUrl()}/${encodeURIComponent(String(oldRecordId))}`
      const body = { fields: { [statusField]: true } }
      await http.patchJson(url, oldBaseHeaders(), body)
      if (MIGRATION_CONFIG.DEBUG) logger.info(`Marked trip ${tripId} as migrated in old base`)
    } catch (err) {
      logger.warn(`Failed to mark trip as migrated in old base: ${String(err && err.message ? err.message : err)}`)
    }
  }

  async function createTripRecord(fields) {
    const created = await airtable.airtableCreate('Trips', fields)
    const recs = created && created.records ? created.records : []
    if (recs.length && recs[0].id) return recs[0].id

    if (fields && fields.TripID) {
      const formula = `({TripID} = "${escapeFormulaValue(fields.TripID)}")`
      const result = await airtable.airtableGet('Trips', { filterByFormula: formula, maxRecords: 1 })
      const rs = result && result.records ? result.records : []
      if (rs.length) return rs[0].id
    }
    return null
  }

  async function createChildRecordsForTrip(tableName, records, tripId, tripRecordId) {
    if (!records || !records.length) return

    const linkField = (config.LINK_FIELDS && config.LINK_FIELDS[tableName]) ? String(config.LINK_FIELDS[tableName]) : (config.DEFAULT_TRIP_LINK_FIELD || 'Trip')
    const fieldsArray = records.map((r) => {
      const f = { ...(r || {}) }
      f[linkField] = [tripRecordId]
      if (!Object.prototype.hasOwnProperty.call(f, 'TripID')) f.TripID = tripId
      return f
    })

    await airtable.airtableBatchCreate(tableName, fieldsArray)
  }

  async function migrateSingleTrip(oldRecord) {
    const mapped = mapper.mapOldTripToNew(oldRecord)
    const tripId = mapped.tripId
    const tripFields = mapped.fields

    logger.info(`Generated TripID: ${tripId}`)

    const existingRecordId = await airtable.getTripRecordIdByTripID(tripId)
    if (existingRecordId) {
      logger.warn(`Trip ${tripId} already exists (Record: ${existingRecordId}). Skipping.`)
      return { tripId, tripRecordId: existingRecordId, skipped: true }
    }

    logger.info('Creating Trips record...')
    const tripRecordId = await createTripRecord(tripFields)
    if (!tripRecordId) throw new Error('Failed to create Trips record')
    logger.info(`Created Trips record: ${tripRecordId}`)

    const oldFields = oldRecord && oldRecord.fields ? oldRecord.fields : {}

    const highlights = mapper.extractHighlightsFromOld(oldFields.Highlights, tripId)
    if (highlights.length) {
      logger.info(`Creating ${highlights.length} highlights...`)
      await createChildRecordsForTrip('TripHighlights', highlights, tripId, tripRecordId)
    }

    const itinerary = mapper.extractItineraryFromOld(oldFields.Itinerary, tripId)
    if (itinerary.length) {
      logger.info(`Creating ${itinerary.length} itinerary steps...`)
      await createChildRecordsForTrip('ItinerarySteps', itinerary, tripId, tripRecordId)
    }

    const includes = mapper.extractIncludesFromOld(oldFields.Includes, tripId)
    if (includes.length) {
      logger.info(`Creating ${includes.length} includes...`)
      await createChildRecordsForTrip('TripIncludes', includes, tripId, tripRecordId)
    }

    const excludes = mapper.extractExcludesFromOld(oldFields['Not Includes'], tripId)
    if (excludes.length) {
      logger.info(`Creating ${excludes.length} excludes...`)
      await createChildRecordsForTrip('TripExcludes', excludes, tripId, tripRecordId)
    }

    const packages = mapper.extractPackagesFromOld(oldRecord, tripId)
    if (packages.length) {
      logger.info(`Creating ${packages.length} packages...`)
      await createChildRecordsForTrip('Packages', packages, tripId, tripRecordId)
    }

    logger.info('Initializing AI enhancement pipeline...')
    try {
      if (orchestrator && typeof orchestrator.initializeEnhancementPipeline_ === 'function') {
        await orchestrator.initializeEnhancementPipeline_(tripRecordId)
        logger.info('Trip migration complete and pipeline initialized')
      } else {
        logger.info('Trip migration complete (pipeline initialization skipped)')
      }
    } catch (e) {
      logger.warn(`Pipeline initialization failed: ${String(e && e.message ? e.message : e)}`)
    }

    if (MIGRATION_CONFIG.MARK_AS_MIGRATED) {
      await markTripAsMigrated(oldRecord.id, tripId)
    }

    return { tripId, tripRecordId, skipped: false }
  }

  async function migrateTrips(maxRecords) {
    if (!(await effectiveLock.tryLock(20000))) {
      logger.info('migrateTrips: lock busy, skipping')
      return { total: 0, success: 0, errors: 0, skipped: 0 }
    }

    const limit = maxRecords || MIGRATION_CONFIG.TEST_BATCH_SIZE
    logger.info('========================================')
    logger.info('STARTING MIGRATION')
    logger.info(`Max records: ${limit}`)
    logger.info('========================================')

    const results = { total: 0, success: 0, errors: 0, skipped: 0 }

    try {
      const oldRecords = await fetchOldTrips(limit)
      results.total = oldRecords.length

      for (let i = 0; i < oldRecords.length; i++) {
        const r = oldRecords[i]
        try {
          const res = await migrateSingleTrip(r)
          if (res.skipped) results.skipped += 1
          else results.success += 1
        } catch (e) {
          results.errors += 1
          logger.error(`Migration error for record ${String(r && r.id ? r.id : '')}: ${String(e && e.message ? e.message : e)}`)
        }
      }

      logger.info('========================================')
      logger.info('MIGRATION COMPLETE')
      logger.info(`Total: ${results.total} Success: ${results.success} Skipped: ${results.skipped} Errors: ${results.errors}`)
      logger.info('========================================')

      return results
    } finally {
      effectiveLock.releaseLock()
    }
  }

  async function runTestMigration() {
    return migrateTrips(MIGRATION_CONFIG.TEST_BATCH_SIZE)
  }

  async function runFullMigration() {
    return migrateTrips(MIGRATION_CONFIG.MAX_RECORDS_PER_RUN)
  }

  async function resetTripIDCounter() {
    mapper.resetTripIDCounter()
  }

  return { migrateTrips, runTestMigration, runFullMigration, resetTripIDCounter }
}

module.exports = { createMigrationRunner }

