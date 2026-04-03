const { getUuid } = require('../core/runtime')

function createImprovementRepository(options) {
  const airtable = options.airtable
  const http = options.http

  async function fetchImprovementRecordForTrip(opts) {
    const o = opts || {}
    const tripRecordId = o.tripRecordId || null
    const tripPublicId = o.tripPublicId || null
    const directRecordId = o.directRecordId || null
    const tripName = o.tripName || null
    const tableName = o.tableName || 'Improvement With AI'
    const tripLinkField = o.tripLinkField || 'Trip'

    if (directRecordId) {
      try {
        const url = `${airtable._baseUrl(tableName)}/${directRecordId}`
        const rec = await http.getJson(url, airtable._headers())
        if (rec && rec.id) return rec
      } catch {
      }
    }

    const conditions = []
    if (tripName) {
      const safeName = String(tripName).replace(/'/g, "\\'")
      conditions.push(`FIND('${safeName}', ARRAYJOIN({${tripLinkField}}))`)
    }

    if (tripPublicId) {
      conditions.push(`FIND('${String(tripPublicId)}', ARRAYJOIN({${tripLinkField}}))`)
    }

    if (tripRecordId) {
      conditions.push(`FIND('${String(tripRecordId)}', ARRAYJOIN({${tripLinkField}}))`)
    }

    if (!conditions.length) return null
    const formula = `OR(${conditions.join(', ')})`

    const all = []
    let offset = null
    do {
      const params = { filterByFormula: formula, pageSize: 100 }
      if (offset) params.offset = offset
      const res = await airtable.airtableGet(tableName, params)
      const recs = res && res.records ? res.records : []
      for (const r of recs) all.push(r)
      offset = res && res.offset ? res.offset : null
    } while (offset)

    if (!all.length) return null

    let newest = all[0]
    for (let i = 1; i < all.length; i++) {
      const ct = all[i].createdTime || ''
      const best = newest.createdTime || ''
      if (ct > best) newest = all[i]
    }
    return newest
  }

  async function getOrCreateActive(opts) {
    const o = opts || {}
    const tripRecordId = o.tripRecordId || null
    const tripFields = o.tripFields || null
    const tripPublicId = o.tripPublicId || (tripFields && tripFields.TripID ? String(tripFields.TripID) : null)
    const tripName = o.tripName || (tripFields && tripFields.Title ? String(tripFields.Title) : null)
    const tableName = o.tableName || 'Improvement With AI'
    const tripLinkField = o.tripLinkField || 'Trip'
    const initialFields = o.initialFields || null

    if (!tripRecordId) return null

    const directId = tripFields && tripFields.ImprovementRecordId ? String(tripFields.ImprovementRecordId) : ''
    const rec = await fetchImprovementRecordForTrip({
      tripRecordId,
      tripPublicId,
      tripName,
      directRecordId: directId || null,
      tableName,
      tripLinkField
    })

    if (rec && rec.id) {
      if (!directId) {
        try {
          await airtable.airtableUpdate('Trips', tripRecordId, { ImprovementRecordId: rec.id })
        } catch {
        }
      }
      return rec
    }

    const fields = {}
    fields[tripLinkField] = [tripRecordId]
    if (initialFields && typeof initialFields === 'object') {
      for (const k of Object.keys(initialFields)) fields[k] = initialFields[k]
    }

    const created = await airtable.airtableCreate(tableName, fields)
    if (created && created.records && created.records.length) {
      const createdId = created.records[0].id
      try {
        await airtable.airtableUpdate('Trips', tripRecordId, { ImprovementRecordId: createdId })
      } catch {
      }
      return created.records[0]
    }

    if (created && created.id) {
      try {
        await airtable.airtableUpdate('Trips', tripRecordId, { ImprovementRecordId: created.id })
      } catch {
      }
      return created
    }

    return null
  }

  return { fetchImprovementRecordForTrip, getOrCreateActive }
}

function createEnhancementHelpers(options) {
  const airtable = options.airtable
  const http = options.http
  const logger = options.logger
  const config = options.config
  const store = options.store

  async function updateEnhancementStatus(tripId, statusField, status) {
    if (!tripId || !statusField || !status) {
      logger.warn('updateEnhancementStatus: missing required parameters')
      return
    }

    const fields = {}
    fields[String(statusField)] = String(status)

    try {
      await airtable.airtableUpdate('Trips', tripId, fields)
      logger.info(`Updated ${statusField} = ${status} for Trip ${tripId}`)
    } catch (e) {
      logger.error(`Error updating status: ${String(e && e.message ? e.message : e)}`)
    }
  }

  function isStageComplete(tripFields, statusField) {
    if (!tripFields || !statusField) return false
    const status = tripFields[statusField]
    return status === 'Done' || status === 'Error'
  }

  function hasErrors(tripFields, statusFields) {
    if (!tripFields || !statusFields || !statusFields.length) return false
    for (const f of statusFields) {
      if (tripFields[f] === 'Error') return true
    }
    return false
  }

  async function getTripFields(tripId) {
    if (!tripId) return null
    try {
      const formula = `RECORD_ID() = '${tripId}'`
      const res = await airtable.airtableGet('Trips', { filterByFormula: formula, maxRecords: 1 })
      if (res && res.records && res.records.length) return res.records[0].fields
      return null
    } catch (e) {
      logger.error(`Error fetching trip fields: ${String(e && e.message ? e.message : e)}`)
      return null
    }
  }

  const ImprovementRepository = createImprovementRepository({ airtable, http })

  async function claimStage(tripRecordId, stageName, ttlSeconds) {
    if (!tripRecordId || !stageName) return true
    const ttlMs = Math.max(60, Number(ttlSeconds || 0)) * 1000
    const now = Date.now()
    const leaseUntil = new Date(now + ttlMs).toISOString()
    const workerId = store.getProperty('WORKER_ID') || config.WORKER_ID || 'node'
    const runId = getUuid()

    let res = null
    try {
      res = await airtable.airtableGet('Trips', { filterByFormula: `RECORD_ID() = '${String(tripRecordId)}'`, maxRecords: 1 })
    } catch {
      return true
    }
    const recs = res && res.records ? res.records : []
    if (!recs.length) return false
    const f = recs[0].fields || {}

    const currentLeaseRaw = f.Stage_LeaseUntil
    let currentLeaseMs = 0
    if (currentLeaseRaw) {
      const d = new Date(currentLeaseRaw)
      if (!Number.isNaN(d.getTime())) currentLeaseMs = d.getTime()
    }
    const currentOwner = String(f.Stage_Owner || '')
    const currentStage = String(f.Stage_Name || '')

    if (currentLeaseMs && currentLeaseMs > now) {
      if (currentOwner && currentOwner !== workerId) return false
      if (currentStage && currentStage !== stageName) return false
    }

    try {
      await airtable.airtableUpdate('Trips', tripRecordId, {
        Stage_Name: stageName,
        Stage_Owner: workerId,
        Stage_RunId: runId,
        Stage_LeaseUntil: leaseUntil
      })
    } catch {
      return true
    }

    try {
      const verify = await airtable.airtableGet('Trips', { filterByFormula: `RECORD_ID() = '${String(tripRecordId)}'`, maxRecords: 1 })
      const vr = verify && verify.records ? verify.records : []
      if (!vr.length) return false
      const vf = vr[0].fields || {}
      return String(vf.Stage_RunId || '') === runId
    } catch {
      return true
    }
  }

  return {
    updateEnhancementStatus,
    isStageComplete,
    hasErrors,
    getTripFields,
    ImprovementRepository,
    claimStage
  }
}

module.exports = { createEnhancementHelpers, createImprovementRepository }
