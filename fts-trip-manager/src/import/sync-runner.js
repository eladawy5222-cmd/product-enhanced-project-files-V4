function createSyncRunner(options) {
  const logger = options.logger
  const config = options.config
  const lock = options.lock
  const state = options.state
  const wp = options.wp
  const upsert = options.upsert
  const getTripRecordIdByTripID = options.getTripRecordIdByTripID
  const initializePipeline = options.initializePipeline

  const WP_IMPORT_DAILY_LIMIT = 60

  async function syncSingleTripById(tripId) {
    const trip = await wp.fetchTripById(tripId)
    const tripIdStr = String(trip.core.id)
    const existingRecordId = await getTripRecordIdByTripID(tripIdStr)
    if (existingRecordId) logger.info(`Trip ${tripIdStr} already exists in Airtable (Record: ${existingRecordId}). Updating...`)
    else logger.info(`Importing new trip: ${tripIdStr}`)

    await upsert.upsertTrip(trip)

    const tripRecordId = await getTripRecordIdByTripID(tripIdStr)
    if (tripRecordId) {
      await initializePipeline(tripRecordId)
      logger.info(`Trip ${tripIdStr} imported and pipeline initialized`)
    } else {
      logger.warn(`Could not initialize enhancement pipeline for TripID=${tripIdStr}`)
    }
  }

  async function resetWpImportStateForToday() {
    state.wpImport.reset()
    logger.info('WP import state has been reset.')
  }

  async function runImportStepSafe() {
    if (!(await lock.tryLock(20000))) {
      logger.info('runImportStepSafe: lock busy, skipping')
      return
    }

    try {
      const st = state.wpImport.load()
      const today = new Date().toDateString()
      if (st.todayDate !== today) {
        st.page = 1
        st.index = 0
        st.todayCount = 0
        st.todayDate = today
      }

      if (st.todayCount >= WP_IMPORT_DAILY_LIMIT) {
        logger.info(`Daily limit reached: ${WP_IMPORT_DAILY_LIMIT}. Stopping for today.`)
        state.wpImport.save(st.page, st.index, st.todayCount)
        return
      }

      const json = await wp.fetchTripsPage(st.page)
      const list = (json && json.data) ? json.data : []
      const pagination = (json && json.pagination) ? json.pagination : {}
      const totalPages = pagination.total_pages || 1

      if (!list.length) {
        logger.info(`No trips found on page ${st.page}. totalPages=${totalPages}`)
        if (st.page < totalPages) {
          st.page += 1
          st.index = 0
        }
        state.wpImport.save(st.page, st.index, st.todayCount)
        return
      }

      const batchMax = 200
      let batchCount = 0

      while (st.index < list.length && batchCount < batchMax && st.todayCount < WP_IMPORT_DAILY_LIMIT) {
        const trip = list[st.index]
        if (!trip || !trip.core || !trip.core.id) {
          logger.warn(`Skipping invalid trip at index ${st.index} on page ${st.page}`)
        } else {
          const tripIdStr = String(trip.core.id)
          const existingRecordId = await getTripRecordIdByTripID(tripIdStr)
          if (existingRecordId) {
            logger.info(`Trip ${tripIdStr} already exists. Skipping.`)
          } else {
            logger.info(`Importing new trip: ${tripIdStr}`)
            await upsert.upsertTrip(trip)
            const tripRecordId = await getTripRecordIdByTripID(tripIdStr)
            if (tripRecordId) {
              await initializePipeline(tripRecordId)
              logger.info(`Trip ${tripIdStr} imported and pipeline initialized`)
            }
          }
        }

        st.index += 1
        st.todayCount += 1
        batchCount += 1
      }

      if (st.index >= list.length) {
        st.page += 1
        st.index = 0
      }

      state.wpImport.save(st.page, st.index, st.todayCount)
      logger.info(`runImportStepSafe finished: page=${st.page}, index=${st.index}, todayCount=${st.todayCount}, batchCount=${batchCount}`)
    } finally {
      lock.releaseLock()
    }
  }

  return {
    runImportStepSafe,
    syncSingleTripById,
    resetWpImportStateForToday
  }
}

module.exports = { createSyncRunner }

