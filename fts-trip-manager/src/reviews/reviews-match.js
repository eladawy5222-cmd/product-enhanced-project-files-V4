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

function safeJsonParse(s) {
  if (!s) return null
  try {
    return JSON.parse(String(s))
  } catch {
    return null
  }
}

function getCfg(config, key, def) {
  const v = config && Object.prototype.hasOwnProperty.call(config, key) ? config[key] : undefined
  return v == null || String(v).trim() === '' ? def : v
}

function escapeFormulaValue(s) {
  return String(s || '').replace(/'/g, "\\'")
}

function parseCsvList(s) {
  const raw = String(s || '')
  if (!raw.trim()) return []
  return raw
    .split(',')
    .map(x => String(x || '').trim())
    .filter(Boolean)
}

function pickAiProvider(aiProvider, config) {
  const hasOpenai = !!(config && config.OPENAI_API_KEY)
  const hasDeepseek = !!(config && config.DEEPSEEK_API_KEY)
  if (hasOpenai && aiProvider && typeof aiProvider.callOpenai === 'function') return (p) => aiProvider.callOpenai(p)
  if (hasDeepseek && aiProvider && typeof aiProvider.callDeepseek === 'function') return (p) => aiProvider.callDeepseek(p)
  return null
}

function isContentUseful(s) {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  if (!t) return false
  if (t.length < 60) return false
  const letters = (t.match(/[a-z\u0600-\u06ff]/gi) || []).length
  if (letters < 20) return false
  const words = t.split(' ').filter(Boolean)
  if (words.length < 8) return false
  return true
}

function buildSummaryHeuristic(content, maxChars) {
  const t = String(content || '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  const lim = Math.max(60, Math.min(400, Number(maxChars || 180)))
  if (t.length <= lim) return t
  const cut = t.slice(0, lim)
  const lastStop = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'))
  const safe = lastStop >= 70 ? cut.slice(0, lastStop + 1).trim() : cut.trim()
  return safe.endsWith('…') ? safe : `${safe}…`
}

function sentimentFromStars(stars) {
  const n = Number.parseInt(String(stars == null ? '' : stars), 10)
  if (!Number.isFinite(n)) return ''
  if (n <= 1) return 'Very Negative'
  if (n === 2) return 'Negative'
  if (n === 3) return 'Neutral'
  if (n === 4) return 'Positive'
  return 'Very Positive'
}

function fieldToText(v) {
  if (v == null) return ''
  if (typeof v === 'string') return v.trim()
  if (Array.isArray(v)) return v.map(x => fieldToText(x)).filter(Boolean).join(', ').trim()
  if (typeof v === 'object') {
    const t1 = typeof v.text === 'string' ? v.text.trim() : ''
    if (t1) return t1
    const t2 = typeof v.value === 'string' ? v.value.trim() : ''
    if (t2) return t2
    const t3 = typeof v.result === 'string' ? v.result.trim() : ''
    if (t3) return t3
    return ''
  }
  return String(v).trim()
}

function createReviewsMatcher(options) {
  const airtable = options.airtable
  const logger = options.logger
  const config = options.config
  const store = options.store
  const aiProvider = options.aiProvider

  if (!airtable) throw new Error('createReviewsMatcher: missing airtable')
  if (!logger) throw new Error('createReviewsMatcher: missing logger')
  if (!config) throw new Error('createReviewsMatcher: missing config')
  if (!store) throw new Error('createReviewsMatcher: missing store')

  const targetTable = getCfg(config, 'REVIEWS_TARGET_TABLE', 'TripReviews')
  const tripsTable = getCfg(config, 'REVIEWS_TRIPS_TABLE', 'Trips')
  const tripsMaxFetch = Number(getCfg(config, 'REVIEWS_TRIPS_MAX_FETCH', 5000))
  const maxPerRun = Number(getCfg(config, 'REVIEWS_MATCH_MAX_PER_RUN', 100))
  const threshold = Number(getCfg(config, 'REVIEWS_MATCH_THRESHOLD', 0.62))
  const aiThreshold = Number(getCfg(config, 'REVIEWS_MATCH_AI_THRESHOLD', 0.15))
  const marginMin = Number(getCfg(config, 'REVIEWS_MATCH_MARGIN_MIN', 0.18))
  const marginScoreMin = Number(getCfg(config, 'REVIEWS_MATCH_MARGIN_SCORE_MIN', 0.5))
  const aiConfidenceMin = Number(getCfg(config, 'REVIEWS_MATCH_AI_CONFIDENCE_MIN', 0.55))
  const aiMaxPerRun = Number(getCfg(config, 'REVIEWS_MATCH_MAX_AI_PER_RUN', 10))
  const multiTripMax = Number(getCfg(config, 'REVIEWS_MATCH_MULTI_TRIP_MAX', 3))
  const multiTripMinScore = Number(getCfg(config, 'REVIEWS_MATCH_MULTI_TRIP_MIN_SCORE', threshold))
  const alwaysUseAi = String(getCfg(config, 'REVIEWS_MATCH_ALWAYS_USE_AI', 'false')).trim().toLowerCase() === 'true'
  const matchMode = String(getCfg(config, 'REVIEWS_MATCH_MODE', 'hybrid')).trim().toLowerCase()
  const aiOnly = matchMode === 'ai_only' || matchMode === 'aionly'
  const requireConsistency = String(getCfg(config, 'REVIEWS_MATCH_REQUIRE_CONSISTENCY', 'true')).trim().toLowerCase() === 'true'
  const reviewTextMaxChars = Number(getCfg(config, 'REVIEWS_MATCH_REVIEW_TEXT_MAX_CHARS', 500))
  const reprocessMultiMatched = String(getCfg(config, 'REVIEWS_MATCH_REPROCESS_MULTI_MATCHED', 'true')).trim().toLowerCase() === 'true'
  const aiCandidatesMax = Number(getCfg(config, 'REVIEWS_MATCH_AI_CANDIDATES', 5))
  const aiCandidatesFallbackMax = Number(getCfg(config, 'REVIEWS_MATCH_AI_CANDIDATES_FALLBACK', 10))
  const tripContextTtlHours = Number(getCfg(config, 'REVIEWS_MATCH_TRIP_CONTEXT_TTL_HOURS', 24))
  const tripContextMaxChars = Number(getCfg(config, 'REVIEWS_MATCH_TRIP_CONTEXT_MAX_CHARS', 1800))
  const tripContextPerTableLimit = Number(getCfg(config, 'REVIEWS_MATCH_TRIP_CONTEXT_PER_TABLE_LIMIT', 25))
  const tripContextTables = parseCsvList(getCfg(config, 'REVIEWS_MATCH_TRIP_CONTEXT_TABLES', 'TripHighlights,ItinerarySteps,TripIncludes,TripExcludes,TripDetails,TripFAQs'))

  const cachedTripsKey = 'REVIEWS_TRIPS_CACHE_V3'
  const cachedTripsAtKey = 'REVIEWS_TRIPS_CACHE_AT_V3'

  const callAi = pickAiProvider(aiProvider, config)
  const enrichEnabled = String(getCfg(config, 'REVIEWS_ENRICH_ENABLED', 'true')).trim().toLowerCase() === 'true'
  const enrichOnlyIfEmpty = String(getCfg(config, 'REVIEWS_ENRICH_ONLY_IF_EMPTY', 'true')).trim().toLowerCase() === 'true'
  const enrichAiMaxPerRun = Number(getCfg(config, 'REVIEWS_ENRICH_MAX_AI_PER_RUN', 50))
  const enrichSummaryMaxChars = Number(getCfg(config, 'REVIEWS_ENRICH_SUMMARY_MAX_CHARS', 180))
  const enrichSummaryWriteFields = parseCsvList(getCfg(config, 'REVIEWS_ENRICH_SUMMARY_WRITE_FIELDS', 'Content_Summary,Content Summary,Content_Summary_Text,Content Summary Text,Content_Summary_Generated'))
  const enrichSentimentWriteFields = parseCsvList(getCfg(config, 'REVIEWS_ENRICH_SENTIMENT_WRITE_FIELDS', 'Sentiment'))
  const enrichSummaryFilterFields = parseCsvList(getCfg(config, 'REVIEWS_ENRICH_SUMMARY_FILTER_FIELDS', 'Content_Summary'))
  const enrichSentimentFilterFields = parseCsvList(getCfg(config, 'REVIEWS_ENRICH_SENTIMENT_FILTER_FIELDS', 'Sentiment'))

  async function fetchAllRecords_(tableName, params, maxTotal) {
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

  async function loadTripsSeoTitleMap_() {
    const improvementTable = getCfg(config, 'REVIEWS_IMPROVEMENT_TABLE', 'Improvement With AI')
    const improvementTripLinkField = getCfg(config, 'REVIEWS_IMPROVEMENT_TRIP_LINK_FIELD', 'Trip')
    const improvementSeoTitleField = getCfg(config, 'REVIEWS_IMPROVEMENT_AI_SEO_TITLE_FIELD', 'AI_SEO_Title')
    const maxImp = Number(getCfg(config, 'REVIEWS_IMPROVEMENTS_MAX_FETCH', 5000))

    const formula = `AND({${improvementTripLinkField}}!=BLANK(), LEN(TRIM({${improvementSeoTitleField}}&\"\"))>0)`
    const params = { pageSize: 100, filterByFormula: formula, maxRecords: 100 }

    let recs = []
    try {
      recs = await fetchAllRecords_(improvementTable, params, maxImp)
    } catch (e) {
      logger.warn(`ReviewsMatch: failed to load improvement SEO titles (${String(e && e.message ? e.message : e)})`)
      return {}
    }

    const map = {}
    for (const r of recs) {
      const f = r && r.fields ? r.fields : {}
      const tripLinks = f[improvementTripLinkField]
      if (!Array.isArray(tripLinks) || !tripLinks.length) continue
      const tripRecordId = String(tripLinks[0] || '').trim()
      const seoTitle = String(f[improvementSeoTitleField] || '').trim()
      if (!tripRecordId || !seoTitle) continue
      map[tripRecordId] = seoTitle
    }
    return map
  }

  async function loadTrips_() {
    const cached = safeJsonParse(store.getProperty(cachedTripsKey))
    const cachedAt = String(store.getProperty(cachedTripsAtKey) || '').trim()
    const shouldRefresh = !cached || !Array.isArray(cached) || !cachedAt || (Date.now() - Date.parse(cachedAt)) > 6 * 60 * 60 * 1000
    if (!shouldRefresh) return cached

    const seoTitleMap = await loadTripsSeoTitleMap_()

    const params = {
      pageSize: 100,
      'sort[0][field]': 'Title',
      'sort[0][direction]': 'asc'
    }

    let recs = []
    try {
      recs = await fetchAllRecords_(tripsTable, params, Math.min(50_000, Math.max(1, Number(tripsMaxFetch || 5000))))
    } catch (e) {
      const msg = String(e && e.message ? e.message : e)
      logger.warn(`ReviewsMatch: failed to load trips (${msg})`)
      return cached && Array.isArray(cached) ? cached : []
    }

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

    store.setProperty(cachedTripsKey, JSON.stringify(out))
    store.setProperty(cachedTripsAtKey, new Date().toISOString())
    return out
  }

  async function fetchTripLinked_(tableName, tripRecordId, maxRecs) {
    const formula = `FIND('${escapeFormulaValue(tripRecordId)}', ARRAYJOIN({Trip}))`
    const params = { pageSize: 100, maxRecords: Math.min(100, Math.max(1, Number(maxRecs || 25))), filterByFormula: formula }
    const resp = await airtable.airtableGet(tableName, params)
    return resp && resp.records ? resp.records : []
  }

  function extractTextFromRecord_(tableName, fields) {
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

    if (tableName === 'TripHighlights') {
      return get('AI_Highlight', 'Highlight', 'Title', 'Name')
    }
    if (tableName === 'Highlights Improvement With AI') {
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
    if (tableName === 'TripIncludes') {
      return get('IncludeItem', 'Title', 'Name')
    }
    if (tableName === 'TripIncludes Improvement With AI') {
      return get('IncludeItem', 'Title', 'Name')
    }
    if (tableName === 'TripExcludes') {
      return get('ExcludeItem', 'Title', 'Name')
    }
    if (tableName === 'TripExcludes Improvement With AI') {
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
    if (tableName === 'TripDetails') {
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

  function clampText_(s, maxChars) {
    const t = String(s || '').trim()
    const lim = Math.max(0, Math.min(5000, Number(maxChars || 0)))
    if (!lim) return ''
    return t.length > lim ? t.slice(0, lim) : t
  }

  async function loadTripContext_(tripRecordId, tripCandidate) {
    const rid = String(tripRecordId || '').trim()
    if (!rid) return ''

    const key = `REVIEWS_TRIP_CTX_${rid}`
    const cached = safeJsonParse(store.getProperty(key))
    const ttlMs = Math.max(1, Number(tripContextTtlHours || 24)) * 60 * 60 * 1000
    if (cached && cached.at && cached.text && (Date.now() - Date.parse(String(cached.at))) < ttlMs) {
      return String(cached.text || '')
    }

    const parts = []
    const seo = tripCandidate && tripCandidate.seoTitle ? String(tripCandidate.seoTitle).trim() : ''
    const raw = tripCandidate && tripCandidate.rawTitle ? String(tripCandidate.rawTitle).trim() : ''
    const title = tripCandidate && tripCandidate.title ? String(tripCandidate.title).trim() : ''
    if (seo || raw || title) parts.push(`Title: ${seo || raw || title}`)

    for (const tableName of tripContextTables) {
      try {
        const recs = await fetchTripLinked_(tableName, rid, tripContextPerTableLimit)
        const lines = recs
          .map(r => extractTextFromRecord_(tableName, r && r.fields ? r.fields : {}))
          .map(x => String(x || '').trim())
          .filter(Boolean)
        if (lines.length) {
          parts.push(`${tableName}:\n${lines.slice(0, Math.max(1, tripContextPerTableLimit)).join('\n')}`)
        }
      } catch (e) {
        logger.warn(`ReviewsMatch: trip context fetch failed table=${tableName} (${String(e && e.message ? e.message : e)})`)
      }
    }

    const text = clampText_(parts.join('\n\n'), tripContextMaxChars)
    store.setProperty(key, JSON.stringify({ at: new Date().toISOString(), text }))
    return text
  }

  async function enrichCandidatesWithContext_(tripName, reviewText, candidates) {
    const out = []
    for (const c of candidates) {
      const ctx = await loadTripContext_(c.tripRecordId, c)
      if (requireConsistency && ctx && isHardMismatchByPlaces(tripName + ' ' + reviewText, ctx)) continue
      out.push({ ...c, context: ctx })
    }
    return out
  }

  function scoreCandidates_(reviewTripName, reviewText, trips) {
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

  async function aiPick_(reviewTripName, reviewText, candidates) {
    if (!callAi) return null
    if (!candidates || !candidates.length) return null

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
    const trimmedReviewText = String(reviewText || '').trim().slice(0, Math.max(0, Math.min(2000, reviewTextMaxChars)))
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
      const out = await callAi(prompt)
      if (!out || typeof out !== 'object') return null
      const pick = out.pick == null ? null : Number(out.pick)
      const conf = out.confidence == null ? 0 : Number(out.confidence)
      if (pick == null || !Number.isFinite(pick)) return { pick: null, confidence: Number.isFinite(conf) ? conf : 0 }
      const alsoRaw = Array.isArray(out.also) ? out.also : []
      const also = []
      for (const x of alsoRaw) {
        const n = Number(x)
        if (!Number.isFinite(n)) continue
        if (n === pick) continue
        if (n < 1 || n > candidates.length) continue
        if (!also.includes(n)) also.push(n)
        if (also.length >= 2) break
      }
      return { pick: pick, also, confidence: Number.isFinite(conf) ? conf : 0 }
    } catch (e) {
      logger.warn(`ReviewsMatch: AI pick failed (${String(e && e.message ? e.message : e)})`)
      return null
    }
  }

  function normalizeSentiment_(s) {
    const raw = String(s || '').trim()
    const t = raw.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
    if (!t) return ''
    if (t === 'very negative' || t === 'extremely negative' || t === 'severe negative' || t === 'very bad' || t === 'awful') return 'Very Negative'
    if (t === 'negative' || t === 'bad') return 'Negative'
    if (t === 'neutral' || t === 'mixed' || t === 'ok') return 'Neutral'
    if (t === 'positive' || t === 'good') return 'Positive'
    if (t === 'very positive' || t === 'extremely positive' || t === 'excellent' || t === 'amazing') return 'Very Positive'
    if (t.includes('very') && t.includes('negative')) return 'Very Negative'
    if (t.includes('negative')) return 'Negative'
    if (t.includes('neutral')) return 'Neutral'
    if (t.includes('very') && t.includes('positive')) return 'Very Positive'
    if (t.includes('positive')) return 'Positive'
    return raw.length > 24 ? raw.slice(0, 24) : raw
  }

  async function enrichReview_(reviewTripName, reviewText, stars) {
    const content = String(reviewText || '').trim()
    const starSentiment = sentimentFromStars(stars)

    if (!content) {
      return { summary: '', sentiment: starSentiment || '' }
    }

    if (!callAi) {
      return {
        summary: buildSummaryHeuristic(content, enrichSummaryMaxChars),
        sentiment: starSentiment || ''
      }
    }

    const trimmed = content.slice(0, 1200)
    const prompt = [
      'Return JSON only.',
      'Task: analyze a customer review for a tour/trip.',
      `Trip name: ${JSON.stringify(String(reviewTripName || ''))}`,
      `Stars: ${JSON.stringify(String(stars == null ? '' : stars))}`,
      `Review: ${JSON.stringify(trimmed)}`,
      'Output schema:',
      '{ "summary": string, "sentiment": "Very Negative"|"Negative"|"Neutral"|"Positive"|"Very Positive" }',
      'Rules:',
      `- summary must be <= ${Math.max(60, Math.min(400, Number(enrichSummaryMaxChars || 180)))} characters`,
      '- summary must be useful and specific (avoid filler like "Great tour")',
      '- if review text is unclear/low-information, summary should still be short and safe',
      '- sentiment should reflect the review tone, using the 5 labels only'
    ].join('\n')

    try {
      const out = await callAi(prompt)
      const summary = out && typeof out.summary === 'string' ? out.summary.trim() : ''
      const sentiment = normalizeSentiment_(out && typeof out.sentiment === 'string' ? out.sentiment : '')
      const finalSummary = summary ? summary.slice(0, Math.max(60, Math.min(400, Number(enrichSummaryMaxChars || 180)))) : buildSummaryHeuristic(content, enrichSummaryMaxChars)
      const finalSentiment = sentiment || starSentiment || ''
      return { summary: finalSummary, sentiment: finalSentiment }
    } catch {
      return {
        summary: buildSummaryHeuristic(content, enrichSummaryMaxChars),
        sentiment: starSentiment || ''
      }
    }
  }

  async function fetchPendingReviews_() {
    const base = reprocessMultiMatched
      ? `OR({MatchStatus}='Pending', {MatchStatus}='NeedsReview', AND({MatchStatus}='Matched', COUNTA({Trip})>1))`
      : `OR({MatchStatus}='Pending', {MatchStatus}='NeedsReview')`

    let formula = base
    if (enrichEnabled && (enrichSummaryWriteFields.length || enrichSentimentWriteFields.length)) {
      const checks = []
      for (const k of enrichSummaryFilterFields) {
        if (!k) continue
        checks.push(`{${k}}=BLANK()`)
      }
      for (const k of enrichSentimentFilterFields) {
        if (!k) continue
        checks.push(`{${k}}=BLANK()`)
      }
      if (checks.length) {
        formula = `OR(${base}, AND({MatchStatus}='Matched', OR(${checks.join(',')})))`
      }
    }
    try {
      return airtable.airtableGet(targetTable, { filterByFormula: formula, maxRecords: Math.min(Math.max(1, maxPerRun), 200), pageSize: 100 })
    } catch (e) {
      const msg = String(e && e.message ? e.message : e)
      logger.warn(`ReviewsMatch: fetch pending failed (${msg})`)
      return { records: [] }
    }
  }

  async function runMatch() {
    const trips = await loadTrips_()
    if (!trips.length) {
      logger.warn('ReviewsMatch: no trips cache available')
      return { matched: 0, needsReview: 0 }
    }

    const resp = await fetchPendingReviews_()
    const recs = resp && resp.records ? resp.records : []
    if (!recs.length) {
      logger.info('ReviewsMatch: no pending reviews')
      return { matched: 0, needsReview: 0 }
    }

    let matched = 0
    let needsReview = 0
    let aiUsed = 0
    let enrichAiUsed = 0

    for (const r of recs) {
      const id = r && r.id ? String(r.id) : ''
      const f = r && r.fields ? r.fields : {}
      const tripName = String(f.SourceTripName || f.TripName || '').trim()
      if (!id || !tripName) continue
      const reviewText = String(f.Content || '').trim()

      const topAll = scoreCandidates_(tripName, reviewText, trips)
      const topFiltered = requireConsistency
        ? topAll.filter(c => !isHardMismatchByPlaces(tripName + ' ' + reviewText, [c.seoTitle, c.rawTitle, c.title].filter(Boolean).join(' ')))
        : topAll
      const top = topFiltered
      const best = top.length ? top[0] : null
      const bestScore = best ? Number(best.score || 0) : 0
      const secondScore = top.length > 1 ? Number(top[1].score || 0) : 0

      let decision = null
      let method = 'fuzzy'
      const canTryAi = (aiOnly ? true : (bestScore >= aiThreshold)) && callAi && aiUsed < aiMaxPerRun
      const shouldUseAi = alwaysUseAi || (bestScore < threshold) || ((bestScore - secondScore) < marginMin)

      if (canTryAi && (aiOnly || shouldUseAi)) {
        method = 'ai'
        const takeN1 = Math.min(12, Math.max(2, Math.floor(aiCandidatesMax || 5)))
        const takeN2 = Math.min(12, Math.max(takeN1, Math.floor(aiCandidatesFallbackMax || 10)))

        const aiCandidates1 = top.slice(0, takeN1)
        const enriched1 = await enrichCandidatesWithContext_(tripName, reviewText, aiCandidates1)
        let chosen = enriched1
        let aiRes = await aiPick_(tripName, reviewText, enriched1)
        aiUsed++

        if ((!aiRes || !aiRes.pick || !(Number(aiRes.confidence || 0) >= aiConfidenceMin)) && aiUsed < aiMaxPerRun) {
          const aiCandidates2 = top.slice(0, takeN2)
          const enriched2 = await enrichCandidatesWithContext_(tripName, reviewText, aiCandidates2)
          chosen = enriched2
          aiRes = await aiPick_(tripName, reviewText, enriched2)
          aiUsed++
        }
        if (aiRes && aiRes.pick && aiRes.confidence >= aiConfidenceMin) {
          const idx = Math.max(1, Math.min(chosen.length, aiRes.pick)) - 1
          const picked = chosen[idx]
          decision = { tripRecordId: picked.tripRecordId, score: Math.max(bestScore, aiRes.confidence) }
          decision.also = Array.isArray(aiRes.also) ? aiRes.also : []
        }
      } else if (!aiOnly && bestScore >= threshold) {
        decision = { tripRecordId: best.tripRecordId, score: bestScore }
      } else if (!aiOnly && bestScore >= marginScoreMin && (bestScore - secondScore) >= marginMin) {
        decision = { tripRecordId: best.tripRecordId, score: bestScore }
      }

      if (aiOnly && !decision && best && bestScore >= threshold) {
        method = 'ai_fallback'
        decision = { tripRecordId: best.tripRecordId, score: bestScore }
      }

      const patch = {}
      patch.MatchCandidates = JSON.stringify(
        top.map(x => ({
          title: x.title,
          seoTitle: x.seoTitle || '',
          rawTitle: x.rawTitle || '',
          score: Math.round((x.score || 0) * 1000) / 1000,
          nameScore: Math.round((x.nameScore || 0) * 1000) / 1000,
          contentScore: Math.round((x.contentScore || 0) * 1000) / 1000,
          placeBoost: Math.round((x.placeBoost || 0) * 1000) / 1000
        }))
      )
      patch.MatchMethod = method

      if (decision && decision.tripRecordId) {
        const maxLinks = Math.min(10, Math.max(1, Math.floor(multiTripMax)))
        const minScore = Math.max(0, Math.min(1, Number.isFinite(multiTripMinScore) ? multiTripMinScore : 0.5))
        const linked = []

        const primary = String(decision.tripRecordId)
        linked.push(primary)

        if (method === 'ai' && decision.also && Array.isArray(decision.also) && decision.also.length && maxLinks > 1) {
          for (const p of decision.also) {
            const idx = Math.max(1, Math.min(top.length, Number(p))) - 1
            const c = top[idx]
            if (!c || !c.tripRecordId) continue
            const s = Number(c.score || 0)
            if (!Number.isFinite(s) || s < minScore) continue
            const rid = String(c.tripRecordId)
            if (!linked.includes(rid)) linked.push(rid)
            if (linked.length >= maxLinks) break
          }
        } else if (maxLinks > 1) {
          for (const c of top) {
            if (!c || !c.tripRecordId) continue
            const s = Number(c.score || 0)
            if (!Number.isFinite(s) || s < minScore) continue
            const rid = String(c.tripRecordId)
            if (!linked.includes(rid)) linked.push(rid)
            if (linked.length >= maxLinks) break
          }
        }

        if (linked.length > maxLinks) linked.length = maxLinks

        patch.Trip = linked
        patch.MatchStatus = 'Matched'
        patch.MatchScore = Math.round(Number(decision.score || 0) * 1000) / 1000
        try {
          await airtable.airtableUpdate(targetTable, id, patch)
          matched++
        } catch (e) {
          logger.warn(`ReviewsMatch: update failed (${String(e && e.message ? e.message : e)})`)
        }
      } else {
        patch.MatchStatus = 'NeedsReview'
        patch.MatchScore = Math.round(bestScore * 1000) / 1000
        try {
          await airtable.airtableUpdate(targetTable, id, patch)
          needsReview++
        } catch (e) {
          logger.warn(`ReviewsMatch: update failed (${String(e && e.message ? e.message : e)})`)
        }
      }

      if (enrichEnabled) {
        let existingSummary = ''
        for (const k of enrichSummaryWriteFields) {
          existingSummary = fieldToText(f[k])
          if (existingSummary) break
        }
        let existingSentiment = ''
        for (const k of enrichSentimentWriteFields) {
          existingSentiment = fieldToText(f[k])
          if (existingSentiment) break
        }
        const wantSummary = !enrichOnlyIfEmpty || !existingSummary
        const wantSentiment = !enrichOnlyIfEmpty || !existingSentiment
        if (wantSummary || wantSentiment) {
          const stars = f.Stars == null ? '' : f.Stars
          let enrich = null
          if (callAi && enrichAiUsed < Math.max(0, Math.floor(enrichAiMaxPerRun))) {
            enrich = await enrichReview_(tripName, reviewText, stars)
            enrichAiUsed++
          } else {
            enrich = {
              summary: buildSummaryHeuristic(reviewText, enrichSummaryMaxChars),
              sentiment: sentimentFromStars(stars)
            }
          }

          const summaryVal = wantSummary && enrich && typeof enrich.summary === 'string' ? enrich.summary.trim() : ''
          const sentimentVal = wantSentiment && enrich && typeof enrich.sentiment === 'string' ? enrich.sentiment.trim() : ''

          if (summaryVal) {
            for (const k of enrichSummaryWriteFields) {
              if (!k) continue
              try {
                await airtable.airtableUpdate(targetTable, id, { [k]: summaryVal })
                break
              } catch (e) {
                logger.warn(`ReviewsMatch: enrich summary update failed field=${String(k)} (${String(e && e.message ? e.message : e)})`)
              }
            }
          }
          if (sentimentVal) {
            for (const k of enrichSentimentWriteFields) {
              if (!k) continue
              try {
                await airtable.airtableUpdate(targetTable, id, { [k]: sentimentVal })
                break
              } catch (e) {
                logger.warn(`ReviewsMatch: enrich sentiment update failed field=${String(k)} (${String(e && e.message ? e.message : e)})`)
              }
            }
          }
        }
      }
    }

    logger.info(`ReviewsMatch: matched=${matched} needsReview=${needsReview}`)
    return { matched, needsReview }
  }

  return { runMatch }
}

module.exports = { createReviewsMatcher }
