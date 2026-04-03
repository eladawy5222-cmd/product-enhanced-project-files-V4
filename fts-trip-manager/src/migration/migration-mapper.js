const { MIGRATION_CONFIG } = require('../config/migration-config')

function createMigrationMapper(options) {
  const logger = options.logger
  const store = options.store

  if (!logger) throw new Error('createMigrationMapper: missing options.logger')
  if (!store) throw new Error('createMigrationMapper: missing options.store')

  function generateTripID() {
    const lastIdRaw = store.getProperty(MIGRATION_CONFIG.TRIP_ID_PROPERTY_KEY)
    const nextId = lastIdRaw ? Number.parseInt(String(lastIdRaw), 10) + 1 : MIGRATION_CONFIG.TRIP_ID_START

    store.setProperty(MIGRATION_CONFIG.TRIP_ID_PROPERTY_KEY, String(nextId))
    if (MIGRATION_CONFIG.DEBUG) logger.info(`Generated TripID: ${nextId}`)
    return String(nextId)
  }

  function resetTripIDCounter() {
    store.deleteProperty(MIGRATION_CONFIG.TRIP_ID_PROPERTY_KEY)
    logger.info(`TripID counter reset. Next ID will be: ${MIGRATION_CONFIG.TRIP_ID_START}`)
  }

  function getCurrentTripID() {
    const lastIdRaw = store.getProperty(MIGRATION_CONFIG.TRIP_ID_PROPERTY_KEY)
    if (!lastIdRaw) return null
    const n = Number.parseInt(String(lastIdRaw), 10)
    return Number.isFinite(n) ? n : null
  }

  function generateSlugFromTitle(title) {
    if (!title) return ''
    return String(title)
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  function inferDurationUnit(hours) {
    if (!hours) return 'hours'
    const h = Number.parseFloat(String(hours))
    if (!Number.isFinite(h)) return 'hours'
    if (h >= 24) return 'days'
    if (h < 1) return 'minutes'
    return 'hours'
  }

  function parseDuration(text) {
    if (!text) return ''
    const s = String(text)
    const hourMatch = s.match(/(\d+)\s*(hour|hr)/i)
    if (hourMatch) return hourMatch[1]
    const dayMatch = s.match(/(\d+)\s*day/i)
    if (dayMatch) return String(Number.parseInt(dayMatch[1], 10) * 8)
    return s
  }

  function parsePrice(text) {
    if (!text) return ''
    const s = String(text)
    const match = s.match(/[\d,]+\.?\d*/)
    if (match) return match[0].replace(/,/g, '')
    return s
  }

  function mapOldTripToNew(oldRecord) {
    const fields = (oldRecord && oldRecord.fields) ? oldRecord.fields : {}
    const newFields = {}

    const tripId = generateTripID()
    newFields.TripID = tripId

    const fieldMap = MIGRATION_CONFIG.FIELD_MAP.TRIPS
    for (const oldField of Object.keys(fieldMap)) {
      const newField = fieldMap[oldField]
      const value = fields[oldField] || ''
      if (oldField === 'Duration') newFields[newField] = parseDuration(value)
      else if (oldField === 'Price') newFields[newField] = parsePrice(value)
      else newFields[newField] = value
    }

    const overview = fields.Overview || ''
    const fullDesc = fields['Full description'] || ''
    if (overview && fullDesc && overview !== fullDesc) newFields.Trip_Description = `${overview}\n\n${fullDesc}`
    else newFields.Trip_Description = overview || fullDesc || ''

    newFields.StatusWorkflow = 'publish'
    if (newFields.Title) newFields.Slug = generateSlugFromTitle(newFields.Title)
    newFields.TripCode = `FTS-${tripId}`
    if (newFields.Duration_Hours) newFields.Duration_Unit = inferDurationUnit(newFields.Duration_Hours)
    newFields.LastSynced = new Date().toISOString()

    return { tripId, fields: newFields }
  }

  function splitText(text, pattern) {
    if (!text) return []
    return String(text)
      .split(pattern)
      .map((s) => String(s || '').trim())
      .filter((s) => s.length > 0)
  }

  function extractHighlightsFromOld(text, tripId) {
    const lines = splitText(text, MIGRATION_CONFIG.SPLIT_PATTERNS.HIGHLIGHTS)
    return lines.map((line, i) => ({ TripID: tripId, Highlight: line, Order: i + 1 }))
  }

  function extractItineraryFromOld(text, tripId) {
    const sections = splitText(text, MIGRATION_CONFIG.SPLIT_PATTERNS.ITINERARY)
    return sections.map((section, i) => {
      const dayMatch = String(section).match(/Day\s*(\d+)/i)
      const stepTitle = dayMatch ? `Day ${dayMatch[1]}` : `Step ${i + 1}`
      return { TripID: tripId, StepOrder: i + 1, StepTitle: stepTitle, StepDescription: section }
    })
  }

  function extractIncludesFromOld(text, tripId) {
    const items = splitText(text, MIGRATION_CONFIG.SPLIT_PATTERNS.INCLUDES)
    return items.map((item) => ({ TripID: tripId, IncludeItem: item }))
  }

  function extractExcludesFromOld(text, tripId) {
    const items = splitText(text, MIGRATION_CONFIG.SPLIT_PATTERNS.EXCLUDES)
    return items.map((item) => ({ TripID: tripId, ExcludeItem: item }))
  }

  function extractPackagesFromOld(oldRecord, tripId) {
    const fields = (oldRecord && oldRecord.fields) ? oldRecord.fields : {}
    const cfg = MIGRATION_CONFIG.FIELD_MAP.PACKAGES
    const out = []

    for (let i = 1; i <= cfg.maxOptions; i++) {
      const opt = fields[`${cfg.optionPrefix}${i}`]
      const price = fields[`${cfg.pricePrefix}${i}`]
      const optionText = String(opt || '').trim()
      const priceText = String(price || '').trim()
      if (!optionText && !priceText) continue

      const rec = {
        TripID: tripId,
        PackageName: optionText || `Option ${i}`,
        Price: priceText
      }
      out.push(rec)
    }
    return out
  }

  return {
    generateTripID,
    resetTripIDCounter,
    getCurrentTripID,
    mapOldTripToNew,
    extractHighlightsFromOld,
    extractItineraryFromOld,
    extractIncludesFromOld,
    extractExcludesFromOld,
    extractPackagesFromOld
  }
}

module.exports = { createMigrationMapper }

