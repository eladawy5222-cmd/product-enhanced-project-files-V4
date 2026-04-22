let airtable
let http
let config
let logger
let lock
let store
let aiProvider

function initConversionEnforcer(options) {
  if (!options) throw new Error('createConversionEnforcer: missing options')
  airtable = options.airtable
  http = options.http
  config = options.config
  logger = options.logger
  lock = options.lock
  store = options.store
  aiProvider = options.aiProvider

  if (!airtable) throw new Error('createConversionEnforcer: missing options.airtable')
  if (!http) throw new Error('createConversionEnforcer: missing options.http')
  if (!config) throw new Error('createConversionEnforcer: missing options.config')
  if (!logger) throw new Error('createConversionEnforcer: missing options.logger')
  if (!store) throw new Error('createConversionEnforcer: missing options.store')
  if (!aiProvider) throw new Error('createConversionEnforcer: missing options.aiProvider')

  if (!lock) {
    lock = {
      async tryLock() {
        return true
      },
      releaseLock() {
      }
    }
  }
}

function log(msg) {
  logger.info(String(msg == null ? '' : msg))
}

async function airtableGet_(tableName, params) {
  return airtable.airtableGet(tableName, params || {})
}

async function airtableUpdate_(tableName, recordId, fields) {
  return airtable.airtableUpdate(tableName, recordId, fields || {})
}

async function airtableBatchCreate_(tableName, fieldsArray) {
  return airtable.airtableBatchCreate(tableName, fieldsArray || [])
}

async function airtableBatchDelete_(tableName, ids) {
  return airtable.airtableBatchDelete(tableName, ids || [])
}

async function callAi_(prompt) {
  return aiProvider.callDeepseek(String(prompt || ''))
}

async function runConversionEnforcer(data) {
  try {
    const trip = await convEnf_normalizeTripRecord_(data)
    if (!trip || !trip.id) return
    const tripId = trip.id
    const tripFields = trip.fields || {}
    const tripNumber = tripFields.TripID || ''
    const imp = await convEnf_fetchMainImprovementRecord_(tripId, tripFields, tripNumber)
    if (!imp || !imp.id) return
    const impFields = imp.fields || {}
    const nowIso = new Date().toISOString()

    const existingHighlights = await convEnf_fetchHighlights_(tripId)
    const existingItinerary = await convEnf_fetchItinerary_(tripId)
    const existingIncludes = await convEnf_fetchIncExc_(tripId, 'TripIncludes Improvement With AI', 'IncludeItem')
    const existingExcludes = await convEnf_fetchIncExc_(tripId, 'TripExcludes Improvement With AI', 'ExcludeItem')

    const payload = {
      trip: {
        id: tripId,
        TripID: tripNumber || '',
        Title: tripFields.Title || '',
        Slug: tripFields.Slug || '',
        Duration_Hours: tripFields.Duration_Hours || '',
        Duration_Minutes: tripFields.Duration_Minutes || tripFields['Duration Minutes'] || '',
        Duration_Unit: tripFields.Duration_Unit || ''
      },
      description: String(impFields.AI_Trip_Description || ''),
      why_people_love: String(impFields.AI_Tab_Content || ''),
      highlights: existingHighlights.items,
      itinerary: existingItinerary.steps,
      included: existingIncludes.items,
      excluded: existingExcludes.items
    }

    const prompt = convEnf_buildPrompt_(payload)
    const ai = await callAi_(prompt)
    if (!ai || typeof ai !== 'object') return

    const updateMain = {}
    const descHtml = convEnf_getString_(ai, ['description', 'html'])
    if (descHtml && descHtml.length >= 80) updateMain.AI_Trip_Description = descHtml
    const whyHtml = convEnf_getString_(ai, ['why_people_love', 'html'])
    if (whyHtml && whyHtml.length >= 100) updateMain.AI_Tab_Content = whyHtml
    if (Object.keys(updateMain).length) {
      updateMain.AI_LastUpdated = nowIso
      await airtableUpdate_('Improvement With AI', imp.id, updateMain)
    }

    const newHighlights = convEnf_getArray_(ai, ['highlights', 'items'])
    if (newHighlights && newHighlights.length >= 3) {
      await convEnf_replaceHighlights_(tripId, newHighlights, nowIso)
    }

    const newItinerary = convEnf_getArray_(ai, ['itinerary', 'steps'])
    if (newItinerary && newItinerary.length >= 2) {
      await convEnf_replaceItinerary_(tripId, newItinerary, nowIso)
    }

    const newIncluded = convEnf_mergeOptionalItems_(ai, ['included', 'items'], ['included', 'optional_items'])
    if (newIncluded && newIncluded.length >= 3) {
      await convEnf_replaceIncExc_(tripId, 'TripIncludes Improvement With AI', 'IncludeItem', newIncluded, nowIso)
    }

    const newExcluded = convEnf_mergeOptionalItems_(ai, ['excluded', 'items'], ['excluded', 'optional_items'])
    if (newExcluded && newExcluded.length >= 2) {
      await convEnf_replaceIncExc_(tripId, 'TripExcludes Improvement With AI', 'ExcludeItem', newExcluded, nowIso)
    }
  } catch (e) {
    try {
      log('Conversion Enforcer error: ' + (e && e.message ? e.message : String(e)))
    } catch {
    }
  }
}

function convEnf_mergeOptionalItems_(aiObj, itemsPath, optionalPath) {
  const items = convEnf_getArray_(aiObj, itemsPath) || []
  const optionalItems = convEnf_getArray_(aiObj, optionalPath) || []
  const out = []
  items.forEach((x) => {
    let s = String(x || '').replace(/\s+/g, ' ').trim()
    if (!s) return
    out.push(s)
  })
  optionalItems.forEach((x) => {
    let s = String(x || '').replace(/\s+/g, ' ').trim()
    if (!s) return
    if (!/^optional[:\s-]/i.test(s)) s = 'Optional: ' + s
    out.push(s)
  })
  return out
}

function convEnf_getString_(obj, pathArr) {
  const v = convEnf_getPath_(obj, pathArr)
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function convEnf_getArray_(obj, pathArr) {
  const v = convEnf_getPath_(obj, pathArr)
  return Array.isArray(v) ? v : null
}

function convEnf_getPath_(obj, pathArr) {
  let cur = obj
  for (let i = 0; i < pathArr.length; i++) {
    if (!cur || typeof cur !== 'object') return null
    cur = cur[pathArr[i]]
  }
  return cur
}

async function convEnf_normalizeTripRecord_(data) {
  if (!data) return null
  if (typeof data === 'object' && data.id) return data
  const id = String(data || '').trim()
  if (!id) return null
  const res = await airtableGet_('Trips', { filterByFormula: "RECORD_ID() = '" + convEnf_escapeFormulaString_(id) + "'", maxRecords: 1 })
  if (!res || !res.records || !res.records.length) return null
  return res.records[0]
}

async function convEnf_fetchMainImprovementRecord_(tripId, tripFields, tripNumber) {
  const linked = tripFields ? tripFields['Improvement With AI'] : null
  const directId = (Array.isArray(linked) && linked.length) ? String(linked[0] || '').trim() : ''
  if (directId) {
    const byId = await airtableGet_('Improvement With AI', { filterByFormula: "RECORD_ID() = '" + convEnf_escapeFormulaString_(directId) + "'", maxRecords: 1 })
    if (byId && byId.records && byId.records.length) return byId.records[0]
  }
  const conditions = []
  conditions.push("FIND('" + convEnf_escapeFormulaString_(tripId) + "', ARRAYJOIN({Trip}))")
  if (tripNumber) conditions.push("FIND('" + convEnf_escapeFormulaString_(String(tripNumber)) + "', ARRAYJOIN({Trip}))")
  const formula = (conditions.length > 1) ? ("OR(" + conditions.join(', ') + ")") : conditions[0]
  const res = await airtableGet_('Improvement With AI', { filterByFormula: formula, maxRecords: 1 })
  if (!res || !res.records || !res.records.length) return null
  return res.records[0]
}

async function convEnf_fetchHighlights_(tripId) {
  const res = await airtableGet_('Highlights Improvement With AI', {
    filterByFormula: "FIND('" + convEnf_escapeFormulaString_(tripId) + "', ARRAYJOIN({Trip}))",
    pageSize: 100
  })
  const recs = res && res.records ? res.records : []
  recs.sort((a, b) => {
    let ao = (a.fields || {}).Order
    let bo = (b.fields || {}).Order
    if (typeof ao !== 'number') ao = 999999
    if (typeof bo !== 'number') bo = 999999
    return ao - bo
  })
  const items = []
  recs.forEach((r) => {
    const t = String(((r.fields || {}).AI_Highlight || '')).trim()
    if (t) items.push(t)
  })
  return { records: recs, items }
}

async function convEnf_fetchItinerary_(tripId) {
  const res = await airtableGet_('Itinerary Improvement With AI', {
    filterByFormula: "FIND('" + convEnf_escapeFormulaString_(tripId) + "', ARRAYJOIN({Trip}))",
    pageSize: 100
  })
  const recs = res && res.records ? res.records : []
  recs.sort((a, b) => {
    let ao = (a.fields || {}).StepOrder
    let bo = (b.fields || {}).StepOrder
    if (typeof ao !== 'number') ao = 999999
    if (typeof bo !== 'number') bo = 999999
    return ao - bo
  })
  const steps = []
  recs.forEach((r) => {
    const f = r.fields || {}
    steps.push({
      step_title: String(f.AI_Step_Title || ''),
      step_description: String(f.AI_Step_Description || ''),
      step_label: String(f.AI_Step_Label || ''),
      duration_value: (f.AI_Duration_Value === null || f.AI_Duration_Value === undefined || f.AI_Duration_Value === '') ? null : f.AI_Duration_Value,
      duration_unit: String(f.AI_Duration_Unit || ''),
      meals_included: String(f.AI_Meals_Included || '')
    })
  })
  return { records: recs, steps }
}

async function convEnf_fetchIncExc_(tripId, tableName, textField) {
  const res = await airtableGet_(tableName, {
    filterByFormula: "FIND('" + convEnf_escapeFormulaString_(tripId) + "', ARRAYJOIN({Trip}))",
    pageSize: 100
  })
  const recs = res && res.records ? res.records : []
  const items = []
  recs.forEach((r) => {
    const f = r.fields || {}
    const t = String(f[textField] || '').trim()
    if (t) items.push(t)
  })
  return { records: recs, items }
}

async function convEnf_replaceHighlights_(tripId, items, nowIso) {
  await convEnf_deleteLinked_(tripId, 'Highlights Improvement With AI', 'Trip')
  const fieldsArray = []
  for (let i = 0; i < items.length; i++) {
    const t = String(items[i] || '').replace(/\s+/g, ' ').trim()
    if (!t) continue
    fieldsArray.push({
      Trip: [tripId],
      AI_Highlight: t,
      Order: i + 1,
      AI_Status: 'Done',
      AI_LastUpdated: nowIso
    })
  }
  await airtableBatchCreate_('Highlights Improvement With AI', fieldsArray)
}

async function convEnf_replaceItinerary_(tripId, steps, nowIso) {
  await convEnf_deleteLinked_(tripId, 'Itinerary Improvement With AI', 'Trip')
  const fieldsArray = []
  for (let i = 0; i < steps.length; i++) {
    const st = steps[i] || {}
    const title = String(st.step_title || '').trim()
    const desc = String(st.step_description || '').trim()
    if (!title && !desc) continue
    let durVal = st.duration_value
    if (durVal !== null && durVal !== undefined && durVal !== '') {
      const n = Number(durVal)
      durVal = isFinite(n) ? n : null
    } else {
      durVal = null
    }
    fieldsArray.push({
      Trip: [tripId],
      StepOrder: i + 1,
      AI_Step_Title: title,
      AI_Step_Description: desc,
      AI_Step_Label: String(st.step_label || '').trim(),
      AI_Duration_Value: durVal,
      AI_Duration_Unit: String(st.duration_unit || '').trim(),
      AI_Meals_Included: String(st.meals_included || '').trim(),
      AI_Status: 'Done',
      AI_LastUpdated: nowIso
    })
  }
  await airtableBatchCreate_('Itinerary Improvement With AI', fieldsArray)
}

async function convEnf_replaceIncExc_(tripId, tableName, textField, items, nowIso) {
  await convEnf_deleteLinked_(tripId, tableName, 'Trip')
  const fieldsArray = []
  for (let i = 0; i < items.length; i++) {
    const t = String(items[i] || '').replace(/\s+/g, ' ').trim()
    if (!t) continue
    const f = { Trip: [tripId], AI_Status: 'Done', AI_LastUpdated: nowIso }
    f[textField] = t
    fieldsArray.push(f)
  }
  await airtableBatchCreate_(tableName, fieldsArray)
}

async function convEnf_deleteLinked_(tripId, tableName, linkField) {
  const res = await airtableGet_(tableName, {
    filterByFormula: "FIND('" + convEnf_escapeFormulaString_(tripId) + "', ARRAYJOIN({" + linkField + "}))",
    pageSize: 200
  })
  const recs = res && res.records ? res.records : []
  if (!recs.length) return
  const ids = recs.map((r) => r.id).filter(Boolean)
  if (ids.length) await airtableBatchDelete_(tableName, ids)
}

function convEnf_escapeFormulaString_(s) {
  return String(s || '').replace(/'/g, "\\'")
}

function convEnf_buildPrompt_(payload) {
  return [
    "You are a conversion copywriting quality enforcer for tour pages. Return ONLY valid JSON.",
    "",
    "GOAL:",
    "- Make content consistently high-conversion like the best-performing tour pages.",
    "- Keep the existing content structure; improve quality and persuasion.",
    "",
    "QUALITY LOGIC:",
    "- For each section, rate strength 0-10.",
    "- If score >= 8: light polish only (keep most phrasing, sharpen benefits, remove fluff).",
    "- If score <= 7: rewrite for conversion (preserve facts, no hallucinations).",
    "",
    "TRANSFORMATION RULES:",
    "HIGHLIGHTS:",
    "- Convert features -> benefits with specific outcomes.",
    "- Remove generic verbs like 'visit'/'explore' and vague filler.",
    "- Keep each highlight 8-16 words, punchy, concrete.",
    "ITINERARY:",
    "- Convert schedule -> experience timeline with realistic flow.",
    "- Include clear sequence and what the traveler experiences.",
    "- Avoid invented places/times; keep what's plausible from inputs.",
    "INCLUDED/EXCLUDED:",
    "- Rewrite into value-driven bullets (traveler benefit).",
    "- Separate optional items clearly as optional_items[].",
    "DESCRIPTION:",
    "- Persuasive narrative focused on experience and outcomes.",
    "- No headings; output HTML paragraphs only.",
    "WHY PEOPLE LOVE:",
    "- Enforce emotional hooks, clear benefits, decision triggers.",
    "- 5-7 points, each as <p><strong>Title</strong> — ...</p> (HTML only).",
    "",
    "STRICT:",
    "- Do NOT add headings (no h2/h3/h4).",
    "- Do NOT invent new destinations or logistics not supported by input.",
    "- Output must be JSON only.",
    "",
    "INPUT JSON:",
    JSON.stringify(payload),
    "",
    "OUTPUT JSON SCHEMA:",
    JSON.stringify({
      description: { score: 0, action: "polish", html: "" },
      why_people_love: { score: 0, action: "polish", html: "" },
      highlights: { score: 0, action: "polish", items: [""] },
      itinerary: { score: 0, action: "polish", steps: [{ step_title: "", step_description: "", step_label: "", duration_value: null, duration_unit: "", meals_included: "" }] },
      included: { score: 0, action: "polish", items: [""], optional_items: [""] },
      excluded: { score: 0, action: "polish", items: [""], optional_items: [""] }
    })
  ].join("\n")
}

function createConversionEnforcer(options) {
  let inited = false
  async function ensureInit() {
    if (inited) return
    initConversionEnforcer(options)
    inited = true
  }

  return {
    runConversionEnforcer: async (...args) => {
      await ensureInit()
      return runConversionEnforcer(...args)
    }
  }
}

module.exports = { createConversionEnforcer }
