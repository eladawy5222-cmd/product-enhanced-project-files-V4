require('dotenv').config()

const { getAppConfig } = require('../src/config/app-config')
const { createHttpClient } = require('../src/core/http-client')
const { createAirtableClient, escapeFormulaValue } = require('../src/core/airtable-client')
const { createAiProvider } = require('../src/ai/ai-provider')

function getArg(name) {
  const argv = process.argv.slice(2)
  const key = `--${String(name || '').trim()}`
  const idx = argv.indexOf(key)
  if (idx === -1) return null
  const val = argv[idx + 1]
  if (val == null || String(val).startsWith('--')) return ''
  return String(val)
}

function getCfg(config, key, def) {
  const v = config && Object.prototype.hasOwnProperty.call(config, key) ? config[key] : undefined
  return v == null || String(v).trim() === '' ? def : v
}

function parseCsvList(s) {
  const raw = String(s || '')
  if (!raw.trim()) return []
  return raw
    .split(',')
    .map(x => String(x || '').trim())
    .filter(Boolean)
}

async function fetchAllRecords(airtable, tableName, params, maxTotal) {
  const all = []
  let offset = null
  const limit = Math.min(Math.max(1, Number(maxTotal || 1000)), 10_000)
  while (all.length < limit) {
    const pageParams = { ...(params || {}) }
    if (offset) pageParams.offset = offset
    const resp = await airtable.airtableGet(tableName, pageParams)
    const recs = resp && resp.records ? resp.records : []
    all.push(...recs)
    offset = resp && resp.offset ? String(resp.offset) : null
    if (!offset || !recs.length) break
  }
  return all.slice(0, limit)
}

function safeJsonParse(s) {
  if (!s) return null
  try {
    return JSON.parse(String(s))
  } catch {
    return null
  }
}

function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[^a-z0-9\u0600-\u06ff\s-]/gi, ' ')
    .replace(/[\s_-]+/g, ' ')
    .trim()
}

function tokenize(s) {
  const t = normalizeText(s)
  if (!t) return []
  const stop = new Set(['the', 'and', 'with', 'from', 'tour', 'trip', 'day', 'days', 'to', 'in', 'of', 'a', 'an'])
  const out = []
  for (const w0 of t.split(' ')) {
    const w = String(w0 || '').trim()
    if (!w || w.length <= 1 || stop.has(w)) continue
    if (w === 'plane') out.push('flight')
    else if (w === 'flying') out.push('flight')
    else if (w === 'coach') out.push('bus')
    else if (w === 'transfer') out.push('transfer')
    else out.push(w)
  }
  return out
}

function jaccard(a, b) {
  const A = new Set(a)
  const B = new Set(b)
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  const union = A.size + B.size - inter
  return union > 0 ? inter / union : 0
}

function overlapCoeff(a, b) {
  const A = new Set(a)
  const B = new Set(b)
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  const denom = Math.min(A.size, B.size)
  return denom > 0 ? inter / denom : 0
}

function detectPlaceGroups(text) {
  const s = normalizeText(text)
  if (!s) return new Set()
  const groups = [
    { key: 'cairo_giza', tokens: ['cairo', 'giza', 'pyramids', 'pyramid', 'sphinx', 'egyptian', 'museum', 'tahrir', 'grand', 'gem'] },
    { key: 'luxor', tokens: ['luxor', 'karnak', 'valley', 'kings', 'queens', 'hatshepsut', 'tutankhamun', 'tutankhamuns', 'tomb'] },
    { key: 'aswan', tokens: ['aswan', 'philae', 'kom', 'ombo', 'nubian', 'abu', 'simbel'] },
    { key: 'hurghada', tokens: ['hurghada', 'elgouna', 'el gouna', 'gouna', 'makadi', 'sahl', 'hasheesh'] },
    { key: 'sharm', tokens: ['sharm', 'sheikh', 'ras', 'mohamed', 'sinai', 'naama'] },
    { key: 'marsa_alam', tokens: ['marsa', 'alam', 'port', 'ghalib', 'dolphin', 'house'] },
    { key: 'alexandria', tokens: ['alexandria', 'bibliotheca', 'catacombs', 'qaitbay'] }
  ]

  const out = new Set()
  for (const g of groups) {
    for (const t of g.tokens) {
      if (t && s.includes(t)) {
        out.add(g.key)
        break
      }
    }
  }
  return out
}

function isHardMismatchByPlaces(reviewText, tripText) {
  const r = detectPlaceGroups(reviewText)
  if (!r.size) return false
  const t = detectPlaceGroups(tripText)
  if (!t.size) return false
  for (const k of r) {
    if (t.has(k)) return false
  }
  return true
}

function scoreCandidates(reviewTripName, reviewText, trips) {
  const qTokens = tokenize(reviewTripName)
  const qNorm = normalizeText(reviewTripName)
  const rText = String(reviewText || '').trim()
  const rTokens = rText ? tokenize(rText) : []
  const scored = []
  const qSet = new Set(qTokens)

  function clamp01(n) {
    if (!Number.isFinite(n)) return 0
    if (n < 0) return 0
    if (n > 1) return 1
    return n
  }

  function simByTokens(aTokens, bTokens) {
    if (!aTokens || !aTokens.length || !bTokens || !bTokens.length) return 0
    return Math.max(jaccard(aTokens, bTokens), overlapCoeff(aTokens, bTokens))
  }

  for (const t of trips) {
    const seoBase = t && t.seoTitle ? String(t.seoTitle) : ''
    const rawBase = t && t.rawTitle ? String(t.rawTitle) : ''
    const base = String(t && t.title ? t.title : '').trim()

    const tripTextSeo = (seoBase ? seoBase : base) + ' ' + (t.cities || '') + ' ' + (t.slug || '')
    const tripTextRaw = (rawBase ? rawBase : base) + ' ' + (t.cities || '') + ' ' + (t.slug || '')

    const sTokensSeo = tokenize(tripTextSeo)
    const sTokensRaw = tokenize(tripTextRaw)
    const sSetSeo = new Set(sTokensSeo)
    const sSetRaw = new Set(sTokensRaw)

    const nameScoreSeo = simByTokens(qTokens, sTokensSeo)
    const nameScoreRaw = simByTokens(qTokens, sTokensRaw)
    let nameScore = Math.max(nameScoreSeo, nameScoreRaw)

    const titleNorm = normalizeText(String(base || ''))
    const rawNorm = normalizeText(String(rawBase || ''))
    const seoNorm = normalizeText(String(seoBase || ''))
    if (qNorm) {
      if ((titleNorm && titleNorm.includes(qNorm)) || (rawNorm && rawNorm.includes(qNorm)) || (seoNorm && seoNorm.includes(qNorm))) {
        nameScore = Math.max(nameScore, 0.92)
      }
    }

    if (qTokens.length >= 3 && qSet.size >= 3) {
      let allIn = true
      for (const qt of qSet) {
        if (!sSetSeo.has(qt) && !sSetRaw.has(qt)) {
          allIn = false
          break
        }
      }
      if (allIn) nameScore = Math.max(nameScore, 0.86)
    }

    if (nameScoreSeo >= 0.5 && nameScoreRaw >= 0.5) nameScore = clamp01(nameScore + 0.05)

    let contentScore = 0
    if (rTokens.length >= 4) {
      const sAllTokens = tokenize([seoBase, rawBase, base, t.cities || '', t.slug || ''].filter(Boolean).join(' '))
      contentScore = simByTokens(rTokens, sAllTokens)
    }

    const reviewPlaceKeys = detectPlaceGroups(reviewTripName + ' ' + rText)
    const tripPlaceKeys = detectPlaceGroups([seoBase, rawBase, base].filter(Boolean).join(' '))
    let placeBoost = 0
    for (const k of reviewPlaceKeys) {
      if (tripPlaceKeys.has(k)) {
        placeBoost = 0.15
        break
      }
    }

    const score = clamp01(nameScore + (0.35 * contentScore) + placeBoost)

    scored.push({
      tripRecordId: t.id,
      title: base,
      seoTitle: seoBase,
      rawTitle: rawBase,
      tripId: t.tripId,
      score,
      nameScore: clamp01(nameScore),
      contentScore: clamp01(contentScore),
      placeBoost
    })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, 12)
}

async function fetchTripLinked(airtable, tableName, tripRecordId, maxRecs) {
  const formula = `FIND('${String(tripRecordId).replace(/'/g, "\\'")}', ARRAYJOIN({Trip}))`
  const params = { pageSize: 100, maxRecords: Math.min(100, Math.max(1, Number(maxRecs || 25))), filterByFormula: formula }
  const resp = await airtable.airtableGet(tableName, params)
  return resp && resp.records ? resp.records : []
}

function extractTextFromRecord(tableName, fields) {
  const f = fields || {}
  const get = (...keys) => {
    for (const k of keys) {
      const v = f[k]
      if (typeof v === 'string') {
        const t = v.trim()
        if (t) return t
      }
    }
    return ''
  }

  if (tableName === 'Improvement With AI') {
    const chunks = []
    const preferred = [
      'AI_SEO_Title',
      'AI_SEO_Meta_Description',
      'AI_Bold_Promise',
      'AI_At_A_Glance',
      'AI_Trip_Overview',
      'AI_Important_Information',
      'AI_Safety_Information'
    ]
    for (const k of preferred) {
      const v = get(k)
      if (v) chunks.push(v)
    }
    for (const k of Object.keys(f)) {
      if (preferred.includes(k)) continue
      if (!String(k || '').startsWith('AI_')) continue
      const v = get(k)
      if (v) chunks.push(v)
    }
    return chunks.join('\n')
  }

  if (tableName === 'TripHighlights' || tableName === 'Highlights Improvement With AI') {
    return get('AI_Highlight', 'Highlight', 'Title', 'Name')
  }
  if (tableName === 'ItinerarySteps') {
    const t = get('AI_Step_Title', 'StepTitle', 'Title')
    const d = get('AI_Step_Description', 'StepDescription', 'Description')
    if (!t && !d) return ''
    return t ? (d ? `${t}: ${d}` : t) : d
  }
  if (tableName === 'Itinerary Improvement With AI') {
    const t = get('AI_Step_Title', 'StepTitle', 'Title')
    const d = get('AI_Step_Description', 'StepDescription', 'Description')
    const label = get('AI_Step_Label', 'StepLabel', 'Label')
    if (!t && !d && !label) return ''
    const head = label ? `${label}: ${t || ''}`.trim() : (t || '')
    if (!head && d) return d
    return d ? `${head}: ${d}` : head
  }
  if (tableName === 'TripIncludes' || tableName === 'TripIncludes Improvement With AI') {
    return get('IncludeItem', 'Title', 'Name')
  }
  if (tableName === 'TripExcludes' || tableName === 'TripExcludes Improvement With AI') {
    return get('ExcludeItem', 'Title', 'Name')
  }
  if (tableName === 'TripFacts Improvement With AI') {
    const label = get('AI_Fact_Label', 'FactLabel', 'Label')
    const value = get('AI_Fact_Value', 'FactValue', 'Value')
    if (!label && !value) return ''
    return label ? (value ? `${label}: ${value}` : label) : value
  }
  if (tableName === 'TripFAQs') {
    const q = get('Question', 'FAQ')
    const a = get('Answer')
    if (!q && !a) return ''
    return q ? (a ? `Q: ${q}\nA: ${a}` : `Q: ${q}`) : a
  }
  if (tableName === 'FAQs Improvement With AI') {
    const q = get('AI_Question', 'Question', 'FAQ')
    const a = get('AI_Answer', 'Answer')
    if (!q && !a) return ''
    return q ? (a ? `Q: ${q}\nA: ${a}` : `Q: ${q}`) : a
  }

  const chunks = []
  for (const k of Object.keys(f)) {
    const v = f[k]
    if (typeof v === 'string') {
      const t = v.trim()
      if (t) chunks.push(t)
    }
  }
  return chunks.join(' ')
}

function clampText(s, maxChars) {
  const t = String(s || '').trim()
  const lim = Math.max(0, Math.min(5000, Number(maxChars || 0)))
  if (!lim) return ''
  return t.length > lim ? t.slice(0, lim) : t
}

async function loadTripContext(airtable, config, tripRecordId, tripCandidate) {
  const parts = []
  const seo = tripCandidate && tripCandidate.seoTitle ? String(tripCandidate.seoTitle).trim() : ''
  const raw = tripCandidate && tripCandidate.rawTitle ? String(tripCandidate.rawTitle).trim() : ''
  const title = tripCandidate && tripCandidate.title ? String(tripCandidate.title).trim() : ''
  if (seo || raw || title) parts.push(`Title: ${seo || raw || title}`)

  const tables = parseCsvList(getCfg(config, 'REVIEWS_MATCH_TRIP_CONTEXT_TABLES', ''))
  const perTable = Number(getCfg(config, 'REVIEWS_MATCH_TRIP_CONTEXT_PER_TABLE_LIMIT', 25))
  const maxChars = Number(getCfg(config, 'REVIEWS_MATCH_TRIP_CONTEXT_MAX_CHARS', 1800))

  for (const tableName of tables) {
    const recs = await fetchTripLinked(airtable, tableName, tripRecordId, perTable)
    const lines = recs
      .map(r => extractTextFromRecord(tableName, r && r.fields ? r.fields : {}))
      .map(x => String(x || '').trim())
      .filter(Boolean)
    if (lines.length) parts.push(`${tableName}:\n${lines.join('\n')}`)
  }

  return clampText(parts.join('\n\n'), maxChars)
}

function pickAiCaller(aiProvider, config) {
  const hasOpenai = !!(config && config.OPENAI_API_KEY)
  const hasDeepseek = !!(config && config.DEEPSEEK_API_KEY)
  if (hasOpenai && aiProvider && typeof aiProvider.callOpenai === 'function') return (p) => aiProvider.callOpenai(p)
  if (hasDeepseek && aiProvider && typeof aiProvider.callDeepseek === 'function') return (p) => aiProvider.callDeepseek(p)
  return null
}

async function aiPick(callAi, config, reviewTripName, reviewText, candidates) {
  if (!callAi) return null
  if (!candidates || !candidates.length) return null

  const reviewTextMaxChars = Number(getCfg(config, 'REVIEWS_MATCH_REVIEW_TEXT_MAX_CHARS', 500))
  const trimmedReviewText = String(reviewText || '').trim().slice(0, Math.max(0, Math.min(2000, reviewTextMaxChars)))

  const list = candidates
    .map((c, i) => {
      const seo = String(c.seoTitle || '').trim()
      const raw = String(c.rawTitle || '').trim()
      const shown = seo || raw || String(c.title || '').trim()
      const extra = seo && raw && seo !== raw ? ` | raw: ${raw}` : ''
      const ctx = String(c.context || '').trim()
      const ctxLine = ctx ? `\nContext: ${ctx.replace(/\s+/g, ' ').slice(0, 600)}` : ''
      return `${i + 1}) ${shown}${extra}${ctxLine}`
    })
    .join('\n')

  const prompt = [
    'Return JSON only.',
    'Task: pick the best matching trip for a customer review. You must evaluate consistency using the candidate trip context provided (highlights/itinerary/includes/details/faq). If the review content does not fit the trip context, return null.',
    `Review trip name: ${JSON.stringify(String(reviewTripName || ''))}`,
    `Review text: ${JSON.stringify(trimmedReviewText)}`,
    'Candidates:',
    list,
    'Output schema:',
    '{ "pick": number|null, "also": number[], "confidence": number }',
    'Rules:',
    '- pick is 1..N based on the candidate list, or null',
    '- also is a list of extra candidate indices (excluding pick), max 2 items',
    '- confidence is 0..1',
    '- be strict: if ambiguous or review content contradicts the candidate, pick null',
    '- never pick a different destination than the review text clearly implies'
  ].join('\n')

  try {
    return await callAi(prompt)
  } catch (e) {
    return { error: String(e && e.message ? e.message : e) }
  }
}

async function loadTrips(airtable, config) {
  const tripsTable = getCfg(config, 'REVIEWS_TRIPS_TABLE', 'Trips')
  const tripsMaxFetch = Number(getCfg(config, 'REVIEWS_TRIPS_MAX_FETCH', 5000))
  const improvementTable = getCfg(config, 'REVIEWS_IMPROVEMENT_TABLE', 'Improvement With AI')
  const improvementTripLinkField = getCfg(config, 'REVIEWS_IMPROVEMENT_TRIP_LINK_FIELD', 'Trip')
  const improvementSeoTitleField = getCfg(config, 'REVIEWS_IMPROVEMENT_AI_SEO_TITLE_FIELD', 'AI_SEO_Title')
  const maxImp = Number(getCfg(config, 'REVIEWS_IMPROVEMENTS_MAX_FETCH', 5000))

  const seoTitleMap = {}
  {
    const formula = `AND({${improvementTripLinkField}}!=BLANK(), LEN(TRIM({${improvementSeoTitleField}}&\"\"))>0)`
    const params = { pageSize: 100, filterByFormula: formula, maxRecords: 100 }
    const recs = await fetchAllRecords(airtable, improvementTable, params, maxImp)
    for (const r of recs) {
      const f = r && r.fields ? r.fields : {}
      const tripLinks = f[improvementTripLinkField]
      if (!Array.isArray(tripLinks) || !tripLinks.length) continue
      const tripRecordId = String(tripLinks[0] || '').trim()
      const seoTitle = String(f[improvementSeoTitleField] || '').trim()
      if (!tripRecordId || !seoTitle) continue
      seoTitleMap[tripRecordId] = seoTitle
    }
  }

  const params = { pageSize: 100, 'sort[0][field]': 'Title', 'sort[0][direction]': 'asc' }
  const recs = await fetchAllRecords(airtable, tripsTable, params, Math.min(50_000, Math.max(1, Number(tripsMaxFetch || 5000))))
  const out = []
  for (const r of recs) {
    const id = r && r.id ? String(r.id) : ''
    const f = r && r.fields ? r.fields : {}
    const rawTitle = String(f.Title || '').trim()
    const seoTitle = String(seoTitleMap[id] || '').trim()
    const title = String(seoTitle || rawTitle || '').trim()
    if (!id || !title) continue
    const slug = String(f.Slug || '').trim()
    const cities = Array.isArray(f.Cities) ? f.Cities.join(', ') : String(f.Cities || '').trim()
    const tripId = String(f.TripID || '').trim()
    out.push({ id, title, seoTitle, rawTitle, slug, cities, tripId })
  }
  return out
}

async function main() {
  const unmatchedOnly = String(getArg('unmatched') || 'false').trim().toLowerCase() === 'true'
  const sentimentNoSummary = String(getArg('sentimentNoSummary') || 'false').trim().toLowerCase() === 'true'
  const checkPublishTripId = String(getArg('checkPublishTripId') || '').trim()
  const needle = String(getArg('contains') || 'Hurghada to Cairo').trim()
  const maxReviews = Number(getArg('max') || 200)
  const aiRecheck = String(getArg('ai') || 'false').trim().toLowerCase() === 'true'
  const aiMax = Math.min(20, Math.max(0, Number(getArg('aiMax') || 6)))

  const config = getAppConfig({ rootDir: process.cwd() })
  const logger = { info: () => {}, warn: () => {}, error: (m) => console.error(String(m)) }
  const http = createHttpClient({ logger })
  const airtable = createAirtableClient({ http, logger, apiKey: config.AIRTABLE_API_KEY, baseId: config.AIRTABLE_BASE_ID })
  const aiProvider = createAiProvider({ http, logger, config })
  const callAi = pickAiCaller(aiProvider, config)

  const tripsTable = getCfg(config, 'REVIEWS_TRIPS_TABLE', 'Trips')
  const reviewsTable = getCfg(config, 'REVIEWS_TARGET_TABLE', 'TripReviews')

  if (checkPublishTripId) {
    const tripId = checkPublishTripId
    const tripRes = await airtable.airtableGet(tripsTable, { filterByFormula: `{TripID}=${escapeFormulaValue(tripId)}`, maxRecords: 3, pageSize: 3 })
    const trips = tripRes && tripRes.records ? tripRes.records : []
    const t0 = trips[0]
    const rid = t0 && t0.id ? String(t0.id) : ''
    const wid = t0 && t0.fields && t0.fields.TripID ? String(t0.fields.TripID).trim() : ''

    const fWid = `AND({MatchStatus}='Matched', FIND('${String(wid).replace(/'/g, "\\'")}', ARRAYJOIN({Trip})))`
    const fRid = `AND({MatchStatus}='Matched', FIND('${String(rid).replace(/'/g, "\\'")}', ARRAYJOIN({Trip})))`
    const byWid = wid ? await fetchAllRecords(airtable, reviewsTable, { pageSize: 100, filterByFormula: fWid }, 200) : []
    const byRid = rid ? await fetchAllRecords(airtable, reviewsTable, { pageSize: 100, filterByFormula: fRid }, 200) : []

    console.log(JSON.stringify({
      mode: 'check_publish',
      TripID: tripId,
      tripRecordId: rid || null,
      wpTripId: wid || null,
      matchedByTripId: byWid.length,
      matchedByRecordId: byRid.length,
      sampleByTripId: byWid.slice(0, 5).map(r => ({ recordId: r.id, Trip: r.fields && r.fields.Trip, MatchScore: r.fields && r.fields.MatchScore })),
      sampleByRecordId: byRid.slice(0, 5).map(r => ({ recordId: r.id, Trip: r.fields && r.fields.Trip, MatchScore: r.fields && r.fields.MatchScore }))
    }, null, 2))
    return
  }
  const formula = sentimentNoSummary
    ? `AND({Sentiment}!=BLANK(), OR({Content_Summary}=BLANK(), {Content_Summary}=''))`
    : (unmatchedOnly
      ? `AND({Trip}=BLANK(), OR({MatchStatus}='Pending', {MatchStatus}='NeedsReview', {MatchStatus}=BLANK(), {MatchStatus}=''))`
      : `FIND('${escapeFormulaValue(needle)}', {SourceTripName}&'')`)
  const reviews = await fetchAllRecords(
    airtable,
    reviewsTable,
    { pageSize: 100, filterByFormula: formula },
    maxReviews
  )

  const counts = { total: reviews.length, Matched: 0, Pending: 0, NeedsReview: 0, Other: 0 }
  for (const r of reviews) {
    const st = r && r.fields && r.fields.MatchStatus ? String(r.fields.MatchStatus).trim() : ''
    if (st === 'Matched') counts.Matched++
    else if (st === 'Pending') counts.Pending++
    else if (st === 'NeedsReview') counts.NeedsReview++
    else counts.Other++
  }

  console.log(JSON.stringify({
    mode: sentimentNoSummary ? 'sentiment_no_summary' : (unmatchedOnly ? 'unmatched' : 'contains'),
    needle: (unmatchedOnly || sentimentNoSummary) ? null : needle,
    config: {
      REVIEWS_MATCH_MODE: String(config.REVIEWS_MATCH_MODE || ''),
      REVIEWS_MATCH_ALWAYS_USE_AI: String(config.REVIEWS_MATCH_ALWAYS_USE_AI || ''),
      REVIEWS_MATCH_MAX_AI_PER_RUN: Number(getCfg(config, 'REVIEWS_MATCH_MAX_AI_PER_RUN', 0)),
      REVIEWS_MATCH_AI_CONFIDENCE_MIN: Number(getCfg(config, 'REVIEWS_MATCH_AI_CONFIDENCE_MIN', 0)),
      REVIEWS_MATCH_REQUIRE_CONSISTENCY: String(getCfg(config, 'REVIEWS_MATCH_REQUIRE_CONSISTENCY', 'true')),
      AI_PROVIDER_AVAILABLE: !!callAi
    },
    counts
  }, null, 2))

  if (!reviews.length) return

  const trips = await loadTrips(airtable, config)

  const requireConsistency = String(getCfg(config, 'REVIEWS_MATCH_REQUIRE_CONSISTENCY', 'true')).trim().toLowerCase() === 'true'
  const aiConfidenceMin = Number(getCfg(config, 'REVIEWS_MATCH_AI_CONFIDENCE_MIN', 0.55))
  const threshold = Number(getCfg(config, 'REVIEWS_MATCH_THRESHOLD', 0.62))
  const candidatesMax = Number(getCfg(config, 'REVIEWS_MATCH_AI_CANDIDATES', 8))
  const candidatesFallbackMax = Number(getCfg(config, 'REVIEWS_MATCH_AI_CANDIDATES_FALLBACK', 12))

  const focus = reviews
    .filter(r => {
      const st = r && r.fields && r.fields.MatchStatus ? String(r.fields.MatchStatus).trim() : ''
      return st === 'Pending' || st === 'NeedsReview'
    })
    .slice(0, 50)

  const list = sentimentNoSummary ? reviews.slice(0, 50) : focus

  for (const r of list) {
    const id = r && r.id ? String(r.id) : ''
    const f = r && r.fields ? r.fields : {}
    const reviewTripName = String(f.SourceTripName || '').trim()
    const reviewText = String(f.Content || '').trim()
    const matchStatus = String(f.MatchStatus || '').trim()
    const summary = String(f.Content_Summary || '').trim()
    const sentiment = String(f.Sentiment || '').trim()
    const summaryPreview = summary.length > 120 ? summary.slice(0, 120) + '…' : summary
    const contentPreview = reviewText.length > 120 ? reviewText.slice(0, 120) + '…' : reviewText

    const topAll = scoreCandidates(reviewTripName, reviewText, trips)
    const topFiltered = requireConsistency
      ? topAll.filter(c => !isHardMismatchByPlaces(reviewTripName + ' ' + reviewText, [c.seoTitle, c.rawTitle, c.title].filter(Boolean).join(' ')))
      : topAll

    const best = topFiltered.length ? topFiltered[0] : null
    const bestScore = best ? Number(best.score || 0) : 0

    let reason = ''
    if (!reviewTripName) reason = 'SourceTripName فارغ → الماتشر يتخطى السجل (لن يربط)'
    else if (!reviewText) reason = 'Content فارغ → غالبًا تم إدخال السجل لكن بدون نص (هذا يقلل قدرة AI/السكور)'
    else if (!topAll.length) reason = 'لا توجد Trips مرشّحة (قائمة trips فارغة)'
    else if (!topFiltered.length) reason = 'تم استبعاد كل المرشحين بسبب تناقض مكاني (place groups) قبل AI'
    else if (matchStatus === 'Pending') reason = 'السجل Pending (لم يتم تشغيل match عليه بعد أو لم يصل دوره في batch)'
    else if (bestScore < threshold) reason = `أفضل سكور (${Math.round(bestScore * 1000) / 1000}) أقل من threshold (${threshold}) وAI لم يُنتج قرار ربط`
    else reason = 'قائمة مرشحين موجودة'

    const brief = {
      recordId: id,
      bookingNr: String(f['Booking Nr.'] || ''),
      matchStatus: String(f.MatchStatus || ''),
      existingMatchMethod: String(f.MatchMethod || ''),
      existingMatchScore: f.MatchScore == null ? '' : String(f.MatchScore),
      sentiment,
      summaryLen: summary.length,
      summaryPreview,
      contentLen: reviewText.length,
      contentPreview,
      bestCandidate: best ? { tripRecordId: best.tripRecordId, title: best.seoTitle || best.rawTitle || best.title, score: bestScore } : null,
      computedReason: reason
    }

    console.log('\n' + JSON.stringify(brief, null, 2))

    if (!aiRecheck || !callAi) continue
    if (!topFiltered.length) continue

    const takeN1 = Math.min(12, Math.max(2, Math.floor(candidatesMax || 5)))
    const takeN2 = Math.min(12, Math.max(takeN1, Math.floor(candidatesFallbackMax || 10)))

    const sliceN = topFiltered.slice(0, takeN2)
    const enriched = []
    for (const c of sliceN) {
      const ctx = await loadTripContext(airtable, config, c.tripRecordId, c)
      if (requireConsistency && ctx && isHardMismatchByPlaces(reviewTripName + ' ' + reviewText, ctx)) continue
      enriched.push({ ...c, context: ctx })
      if (enriched.length >= takeN1) break
    }

    const aiRes = await aiPick(callAi, config, reviewTripName, reviewText, enriched.slice(0, aiMax || enriched.length))
    const pick = aiRes && aiRes.pick != null ? Number(aiRes.pick) : null
    const conf = aiRes && aiRes.confidence != null ? Number(aiRes.confidence) : 0
    const picked = pick && Number.isFinite(pick) && pick >= 1 && pick <= enriched.length ? enriched[pick - 1] : null

    console.log(JSON.stringify({
      aiRes,
      interpreted: {
        pick,
        confidence: conf,
        meetsConfidenceMin: Number.isFinite(conf) ? (conf >= aiConfidenceMin) : false,
        pickedTrip: picked ? { tripRecordId: picked.tripRecordId, title: picked.seoTitle || picked.rawTitle || picked.title } : null
      }
    }, null, 2))
  }

  console.log('\nDone.')
}

main().catch((e) => {
  console.error('Fatal:', String(e && e.message ? e.message : e))
  process.exitCode = 1
})
