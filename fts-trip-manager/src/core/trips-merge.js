function mergeSeoStatusFromImprovementRecords(trips, improvementRecords) {
  const statusByTripRecordId = {}
  const recs = improvementRecords || []
  for (const r of recs) {
    const f = r && r.fields ? r.fields : {}
    const tripLink = f.Trip
    const tripRecordId = Array.isArray(tripLink) ? tripLink[0] : tripLink
    if (!tripRecordId) continue
    const s = f.AI_SEO_Status
    if (s == null) continue
    statusByTripRecordId[String(tripRecordId)] = String(s)
  }

  const out = []
  for (const t of trips || []) {
    const id = t && t.id ? String(t.id) : ''
    const fields = t && t.fields && typeof t.fields === 'object' ? { ...t.fields } : {}
    if (id && statusByTripRecordId[id] != null) {
      fields.AI_SEO_Status = statusByTripRecordId[id]
    }
    out.push({ ...(t || {}), id, fields })
  }
  return out
}

module.exports = { mergeSeoStatusFromImprovementRecords }

