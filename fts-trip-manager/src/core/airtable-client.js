function escapeFormulaValue(s) {
  return String(s || '').replace(/"/g, '\\"')
}

function chunkArray(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function createAirtableClient(options) {
  const http = options.http
  const logger = options.logger
  const apiKey = String(options.apiKey || '')
  const baseId = String(options.baseId || '')

  function baseUrl(tableName) {
    return `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`
  }

  function headers() {
    if (!apiKey) throw new Error('Missing AIRTABLE_API_KEY')
    if (!baseId) throw new Error('Missing AIRTABLE_BASE_ID')
    return {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  }

  function buildQuery(params) {
    if (!params) return ''
    const qs = []
    for (const k of Object.keys(params)) {
      const v = params[k]
      if (v == null) continue
      qs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    }
    return qs.length ? `?${qs.join('&')}` : ''
  }

  async function airtableGet(tableName, params) {
    const url = baseUrl(tableName) + buildQuery(params)
    return http.getJson(url, headers())
  }

  async function airtableCreate(tableName, fields) {
    const url = baseUrl(tableName)
    const body = { records: [{ fields }], typecast: true }
    return http.postJson(url, headers(), body)
  }

  async function airtableUpdate(tableName, recordId, fields) {
    const url = baseUrl(tableName)
    const body = { records: [{ id: recordId, fields }], typecast: true }
    return http.patchJson(url, headers(), body)
  }

  async function airtableBatchCreate(tableName, fieldsArray) {
    if (!fieldsArray || !fieldsArray.length) return
    const url = baseUrl(tableName)
    const chunks = chunkArray(fieldsArray, 10)
    for (const chunk of chunks) {
      const records = chunk.map((f) => ({ fields: f }))
      await http.postJson(url, headers(), { records, typecast: true })
    }
  }

  async function airtableBatchDelete(tableName, ids) {
    if (!ids || !ids.length) return
    const chunks = chunkArray(ids, 10)
    for (const chunk of chunks) {
      let url = baseUrl(tableName)
      const qs = chunk.map((id) => `records[]=${encodeURIComponent(String(id))}`).join('&')
      url += `?${qs}`
      await http.deleteJson(url, headers())
    }
  }

  async function airtableDelete(tableName, recordId) {
    if (!tableName || !recordId) return
    await airtableBatchDelete(tableName, [recordId])
  }

  async function airtableFindOneByField(tableName, fieldName, value) {
    const formula = `({${fieldName}} = "${escapeFormulaValue(String(value))}")`
    const resp = await airtableGet(tableName, { maxRecords: 1, filterByFormula: formula })
    const recs = resp && resp.records ? resp.records : []
    return recs.length ? recs[0] : null
  }

  async function airtableUpsertByField(tableName, matchField, matchValue, fields) {
    const existing = await airtableFindOneByField(tableName, matchField, matchValue)
    if (existing) {
      await airtableUpdate(tableName, existing.id, fields)
      return existing.id
    }
    const res = await airtableCreate(tableName, fields)
    const recs = res && res.records ? res.records : []
    return recs.length ? recs[0].id : null
  }

  async function getTripRecordIdByTripID(tripID) {
    if (!tripID) return null
    const existing = await airtableFindOneByField('Trips', 'TripID', tripID)
    return existing ? existing.id : null
  }

  return {
    escapeFormulaValue,
    airtableGet,
    airtableCreate,
    airtableUpdate,
    airtableBatchCreate,
    airtableBatchDelete,
    airtableDelete,
    airtableFindOneByField,
    airtableUpsertByField,
    getTripRecordIdByTripID,
    _headers: headers,
    _baseUrl: baseUrl,
    logger
  }
}

module.exports = { createAirtableClient, escapeFormulaValue }

