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

  async function scanImprovementRecordsByTripLink_(tableName, tripLinkField, tripRecordId) {
    if (!tripRecordId) return []
    const out = []
    let offset = null
    do {
      const params = { pageSize: 100 }
      if (offset) params.offset = offset
      const res = await airtable.airtableGet(tableName, params)
      const recs = res && res.records ? res.records : []
      for (const r of recs) {
        const f = r && r.fields ? r.fields : {}
        const links = f[tripLinkField]
        if (Array.isArray(links) ? links.indexOf(tripRecordId) !== -1 : String(links || '') === String(tripRecordId)) {
          out.push(r)
        }
      }
      offset = res && res.offset ? res.offset : null
    } while (offset)
    return out
  }

  async function fetchImprovementRecordForTripRobust_(opts) {
    const rec = await fetchImprovementRecordForTrip(opts)
    if (rec && rec.id) return rec
    const o = opts || {}
    const tripRecordId = o.tripRecordId || null
    const tableName = o.tableName || 'Improvement With AI'
    const tripLinkField = o.tripLinkField || 'Trip'
    if (!tripRecordId) return null

    const all = await scanImprovementRecordsByTripLink_(tableName, tripLinkField, String(tripRecordId))
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
    const rec = await fetchImprovementRecordForTripRobust_({
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
          await airtable.airtableUpdate('Trips', tripRecordId, { ImprovementRecordId: rec.id, 'Improvement With AI': [rec.id] })
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
        await airtable.airtableUpdate('Trips', tripRecordId, { ImprovementRecordId: createdId, 'Improvement With AI': [createdId] })
      } catch {
      }
      return created.records[0]
    }

    if (created && created.id) {
      try {
        await airtable.airtableUpdate('Trips', tripRecordId, { ImprovementRecordId: created.id, 'Improvement With AI': [created.id] })
      } catch {
      }
      return created
    }

    return null
  }

  return { fetchImprovementRecordForTrip: fetchImprovementRecordForTripRobust_, getOrCreateActive }
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

  function getStatusFieldForStageName_(stageName) {
    const s = String(stageName || '').trim()
    if (s === 'Content') return 'AI_Status'
    if (s === 'AddOns') return 'AI_AddOns_Status'
    if (s === 'Highlights') return 'AI_Highlights_Status'
    if (s === 'Itinerary') return 'AI_Itinerary_Status'
    if (s === 'Inc/Exc' || s === 'IncExc' || s === 'Includes/Excludes') return 'AI_IncExc_Status'
    if (s === 'Trip Facts' || s === 'TripFacts') return 'AI_TripFacts_Status'
    if (s === 'FAQs' || s === 'Faqs') return 'AI_FAQs_Status'
    if (s === 'Images') return 'AI_Images_Status'
    return ''
  }

  function getStageOrderIndex_(stageName) {
    const s = String(stageName || '').trim()
    if (s === 'Content') return 1
    if (s === 'AddOns') return 2
    if (s === 'Highlights') return 3
    if (s === 'Itinerary') return 4
    if (s === 'Inc/Exc' || s === 'IncExc' || s === 'Includes/Excludes') return 5
    if (s === 'Trip Facts' || s === 'TripFacts') return 6
    if (s === 'FAQs' || s === 'Faqs') return 7
    if (s === 'SEO') return 8
    if (s === 'Images') return 9
    return 0
  }

  async function isRecoverableStaleStageLease_(tripFields, requestedStage, nowMs, tripRecordId) {
    const f = tripFields || {}
    const now = Number(nowMs || Date.now())
    const leaseRaw = f.Stage_LeaseUntil
    let leaseMs = 0
    if (leaseRaw) {
      const d = new Date(leaseRaw)
      if (!Number.isNaN(d.getTime())) leaseMs = d.getTime()
    }
    if (!leaseMs || leaseMs <= now) return false
    const currentStage = String(f.Stage_Name || '').trim()
    const req = String(requestedStage || '').trim()
    if (!req) return false
    if (!currentStage) {
      if (req !== 'Images') return false
      if (String(f.AI_Images_Status || '') !== 'Pending') return false
      const statusFields = ['AI_Status','AI_AddOns_Status','AI_Highlights_Status','AI_Itinerary_Status','AI_IncExc_Status','AI_TripFacts_Status','AI_FAQs_Status','AI_Images_Status']
      for (const sf of statusFields) {
        if (String(f[sf] || '') === 'Processing') return false
      }
      try {
        const rec2 = await ImprovementRepository.fetchImprovementRecordForTrip({
          tripRecordId: String(tripRecordId || ''),
          tripPublicId: f.TripID || '',
          tripName: f.Title || '',
          tableName: 'Improvement With AI',
          tripLinkField: 'Trip'
        })
        const seoSt2 = rec2 && rec2.fields ? String(rec2.fields.AI_SEO_Status || '') : ''
        if (seoSt2 === 'Processing') return false
      } catch {
      }
      return true
    }
    if (currentStage === req) return false
    const curOrder = getStageOrderIndex_(currentStage)
    const reqOrder = getStageOrderIndex_(req)
    if (curOrder && reqOrder && reqOrder <= curOrder) return false

    if (currentStage === 'SEO') {
      try {
        const rec = await ImprovementRepository.fetchImprovementRecordForTrip({
          tripRecordId: String(tripRecordId || ''),
          tripPublicId: f.TripID || '',
          tripName: f.Title || '',
          tableName: 'Improvement With AI',
          tripLinkField: 'Trip'
        })
        const seoSt = rec && rec.fields ? String(rec.fields.AI_SEO_Status || '') : ''
        if (seoSt === 'Done' || seoSt === 'Error') return true
      } catch {
      }
      return false
    }

    const statusField = getStatusFieldForStageName_(currentStage)
    if (!statusField) return false
    const st = String(f[statusField] || '')
    if (!(st === 'Done' || st === 'Error')) return false
    return true
  }

  async function clearStageLeaseForTrip_(tripRecordId, reason) {
    try {
      await airtable.airtableUpdate('Trips', tripRecordId, {
        Stage_Name: '',
        Stage_Owner: '',
        Stage_RunId: '',
        Stage_LeaseUntil: ''
      })
      logger.info(`Stage lease cleared for Trip ${tripRecordId}${reason ? ' (' + reason + ')' : ''}`)
      return true
    } catch {
      return false
    }
  }

  async function clearStageLeaseIfRecoverableForRequestedStage(tripRecordId, requestedStage) {
    let res = null
    try {
      res = await airtable.airtableGet('Trips', { filterByFormula: `RECORD_ID() = '${String(tripRecordId)}'`, maxRecords: 1 })
    } catch {
      return false
    }
    const recs = res && res.records ? res.records : []
    if (!recs.length) return false
    const f = recs[0].fields || {}
    const now = Date.now()
    if (!(await isRecoverableStaleStageLease_(f, requestedStage, now, tripRecordId))) return false
    return await clearStageLeaseForTrip_(tripRecordId, `pre_${String(requestedStage || '')}_transition`)
  }

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
      const mismatch = (currentStage && currentStage !== stageName)
      const foreignOwner = (currentOwner && currentOwner !== workerId)
      if ((foreignOwner || mismatch) && (await isRecoverableStaleStageLease_(f, stageName, now, tripRecordId))) {
        await clearStageLeaseForTrip_(tripRecordId, `recoverable_stale_lease_for_${stageName}`)
      } else {
        if (foreignOwner) return false
        if (mismatch) return false
      }
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
    claimStage,
    clearStageLeaseIfRecoverableForRequestedStage
  }
}

module.exports = { createEnhancementHelpers, createImprovementRepository }
