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
  const s = String(msg == null ? '' : msg)
  if (logger && typeof logger.info === 'function') logger.info(s)
  else console.log(s)
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
  const _logTripId = (data && typeof data === 'object' && data.id) ? data.id : String(data || '')
  let _success = false
  try {
    log('🚀 Conversion Enforcer START for Trip: ' + _logTripId)
    const trip = await convEnf_normalizeTripRecord_(data)
    if (!trip || !trip.id) return
    const tripId = trip.id
    const tripFields = trip.fields || {}
    log('📥 Input Data:')
    log(JSON.stringify(tripFields, null, 2))
    const tripNumber = tripFields.TripID || ''
    const imp = await convEnf_fetchMainImprovementRecord_(tripId, tripFields, tripNumber)
    if (!imp || !imp.id) return
    const impFields = imp.fields || {}
    const nowIso = new Date().toISOString()

    const rawCtx = await convEnf_fetchRawContext_(tripId, tripNumber, tripFields)

    const wantGygOptionsIntel = String(process.env.GYG_OPTIONS_INTEL || '').trim() === '1'
    const wantWriteGygRef = String(process.env.GYG_OPTIONS_WRITE_REFERENCE || '').trim() === '1'
    const wantWriteGygDraft = String(process.env.GYG_OPTIONS_WRITE_DRAFT || '').trim() === '1'
    if (wantGygOptionsIntel || wantWriteGygRef || wantWriteGygDraft) {
      const intel = await convEnf_fetchGygOptionsIntel_(tripFields)
      if (intel && intel.summary) {
        log('🧾 GYG options intel:')
        log(intel.summary)
      }
      if (wantWriteGygRef && intel && intel.packages && intel.packages.length) {
        await convEnf_writeGygReferenceOptionsToAirtable_(tripId, tripNumber || '', intel, nowIso)
      }
      if (wantWriteGygDraft && intel && intel.packages && intel.packages.length) {
        await convEnf_writeMissingGygOptionsDraftToAirtable_(tripId, tripNumber || '', intel, nowIso)
      }
    }

    let benchmarkInsights = ''
    const internalBench = await convEnf_buildInternalBenchmarkInsights_(tripFields)
    if (internalBench) benchmarkInsights = internalBench
    try {
      const externalBench = await convEnf_fetchExternalBenchmarkInsights_(tripFields, rawCtx)
      if (externalBench) benchmarkInsights = benchmarkInsights ? (benchmarkInsights + '\n\n' + externalBench) : externalBench
    } catch (e) {
      log('⚠️ External benchmark skipped: ' + String(e && e.message ? e.message : e))
    }

    const existingHighlights = await convEnf_fetchHighlights_(tripId, tripNumber || '')
    const existingItinerary = await convEnf_fetchItinerary_(tripId, tripNumber || '')
    const existingIncludes = await convEnf_fetchIncExc_(tripId, tripNumber || '', 'TripIncludes Improvement With AI', 'IncludeItem')
    const existingExcludes = await convEnf_fetchIncExc_(tripId, tripNumber || '', 'TripExcludes Improvement With AI', 'ExcludeItem')
    const existingFaqs = await convEnf_fetchFaqs_(tripId, tripNumber || '')
    const existingPackages = await convEnf_fetchPackages_(tripId, tripNumber || '')
    log('Fetched Highlights count: ' + (existingHighlights && existingHighlights.items ? existingHighlights.items.length : 0))
    log('Fetched Itinerary count: ' + (existingItinerary && existingItinerary.steps ? existingItinerary.steps.length : 0))
    log('Fetched Includes count: ' + (existingIncludes && existingIncludes.items ? existingIncludes.items.length : 0))
    log('Fetched FAQs count: ' + (existingFaqs && existingFaqs.faqs ? existingFaqs.faqs.length : 0))
    log('Fetched Packages count: ' + (existingPackages && existingPackages.packages ? existingPackages.packages.length : 0))
    if (!existingHighlights.items.length) log('⚠️ No Highlights found using TripID filter')
    if (!existingItinerary.steps.length) log('⚠️ No Itinerary found using TripID filter')
    if (!existingIncludes.items.length) log('⚠️ No Includes found using TripID filter')
    if (!existingFaqs.faqs.length) log('⚠️ No FAQs found using TripID filter')
    if (!existingPackages.packages.length) log('⚠️ No Packages found using TripID filter')
    log('🔹 Processing Highlights...')
    log('Original Highlights count: ' + (existingHighlights && existingHighlights.items ? existingHighlights.items.length : 0))
    log('🔹 Processing Itinerary...')
    log('Original Steps: ' + (existingItinerary && existingItinerary.steps ? existingItinerary.steps.length : 0))
    log('🔹 Processing Includes...')
    log('Original Includes: ' + (existingIncludes && existingIncludes.items ? existingIncludes.items.length : 0))
    log('🔹 Processing FAQs...')
    log('Original FAQs: ' + (existingFaqs && existingFaqs.faqs ? existingFaqs.faqs.length : 0))
    log('🔹 Processing Packages...')
    log('Original Packages: ' + (existingPackages && existingPackages.packages ? existingPackages.packages.length : 0))

    const payload = {
      trip: {
        id: tripId,
        TripID: tripNumber || '',
        Title: tripFields.Title || '',
        TourType: tripFields.TourType || '',
        Slug: tripFields.Slug || '',
        Duration_Hours: tripFields.Duration_Hours || '',
        Duration_Minutes: tripFields.Duration_Minutes || tripFields['Duration Minutes'] || '',
        Duration_Unit: tripFields.Duration_Unit || ''
      },
      seo: {
        h1: String(impFields.AI_Titel_H1 || ''),
        title: String(impFields.AI_SEO_Title || ''),
        meta_description: String(impFields.AI_SEO_Meta_Description || ''),
        short_summary: String(impFields.AI_Short_Summary || ''),
        excerpt: String(impFields.AI_Excerpt || ''),
        focus_keywords: String(impFields.AI_SEO_FocusKeywords || ''),
        focus_keywords_list: impFields.AI_SEO_FocusKeywords_List || '',
        permalink: String(impFields.AI_SEO_Permalink || '')
      },
      description: String(impFields.AI_Trip_Description || ''),
      why_people_love: String(impFields.AI_Tab_Content || ''),
      highlights: existingHighlights.items,
      itinerary: existingItinerary.steps,
      included: existingIncludes.items,
      excluded: existingExcludes.items,
      faqs: existingFaqs.faqs,
      packages: existingPackages.packages,
      package_copy_source: {
        guaranteed_inclusions: convEnf_getGuaranteedItems_(existingIncludes.items),
        guaranteed_exclusions: convEnf_getGuaranteedItems_(existingExcludes.items)
      }
    }

    let standardContext = convEnf_buildStandardContext_(payload)
    if (rawCtx && rawCtx.evidence_text) {
      standardContext = convEnf_enrichStandardContextWithRawEvidence_(standardContext, rawCtx.evidence_text)
    }
    if (benchmarkInsights) {
      standardContext = standardContext || {}
      standardContext.benchmark_insights = benchmarkInsights
    }
    log('🧭 Standard Context:')
    log(JSON.stringify(standardContext, null, 2))

    const prompt = convEnf_buildPrompt_(payload, standardContext)
    let ai = null
    try {
      ai = await callAi_(prompt)
    } catch (e) {
      log('⚠️ AI call skipped: ' + String(e && e.message ? e.message : e))
      return
    }
    if (!ai || typeof ai !== 'object') return

    const updateMain = {}
    const flags = (standardContext && standardContext.flags) ? standardContext.flags : {}
    const evidence = (standardContext && standardContext.evidence) ? standardContext.evidence : {}
    let entranceTruth = convEnf_detectEntranceFeesTruth_(payload.included, payload.excluded)
    if (rawCtx && rawCtx.truth) {
      const ti = !!rawCtx.truth.entrance_included
      const te = !!rawCtx.truth.entrance_excluded
      if (ti && !te) entranceTruth = { included: true, excluded: false, ambiguous: false }
      else if (te && !ti) entranceTruth = { included: false, excluded: true, ambiguous: false }
      else if (ti && te) entranceTruth = { included: false, excluded: false, ambiguous: true }
    }
    const guideTruth = convEnf_detectGuideTruth_(payload.included, payload.excluded, String(evidence.strict_combined || evidence.combined || ''))
    const fixedSeo = convEnf_finalizeSeoFields_(ai, payload, flags)
    const fixedSeoH1 = convEnf_applyGuideTruthToText_(convEnf_applyEntranceFeesTruthToText_(fixedSeo.h1, entranceTruth), guideTruth)
    const fixedSeoTitle = convEnf_applyGuideTruthToText_(convEnf_applyEntranceFeesTruthToText_(fixedSeo.title, entranceTruth), guideTruth)
    const fixedSeoMeta = convEnf_applyGuideTruthToText_(convEnf_applyEntranceFeesTruthToText_(fixedSeo.meta_description, entranceTruth), guideTruth)
    const fixedSeoExcerpt = convEnf_applyGuideTruthToText_(convEnf_applyEntranceFeesTruthToText_(fixedSeo.excerpt, entranceTruth), guideTruth)
    const fixedSeoShort = convEnf_applyGuideTruthToText_(convEnf_applyEntranceFeesTruthToText_(fixedSeo.short_summary, entranceTruth), guideTruth)
    if (fixedSeoH1 && fixedSeoH1.length >= 15) updateMain.AI_Titel_H1 = fixedSeoH1
    if (fixedSeoTitle && fixedSeoTitle.length >= 20) updateMain.AI_SEO_Title = fixedSeoTitle
    if (fixedSeoMeta && fixedSeoMeta.length >= 60) updateMain.AI_SEO_Meta_Description = fixedSeoMeta
    if (fixedSeoExcerpt && fixedSeoExcerpt.length >= 40) updateMain.AI_Excerpt = fixedSeoExcerpt
    if (fixedSeoShort && fixedSeoShort.length >= 40) updateMain.AI_Short_Summary = fixedSeoShort
    const descHtml = convEnf_getString_(ai, ['description', 'html'])
    let descHtmlClean = descHtml ? convEnf_sanitizeHtml_(descHtml) : ''
    if (descHtmlClean) descHtmlClean = convEnf_rewriteUnsupportedContentText_(descHtmlClean, flags, evidence)
    if (descHtmlClean) descHtmlClean = convEnf_applyEntranceFeesTruthToText_(descHtmlClean, entranceTruth)
    if (descHtmlClean) descHtmlClean = convEnf_applyGuideTruthToText_(descHtmlClean, guideTruth)
    if (descHtmlClean && rawCtx && rawCtx.truth) descHtmlClean = convEnf_applyTruthToText_(descHtmlClean, rawCtx.truth)
    if (descHtmlClean && descHtmlClean.length >= 80) updateMain.AI_Trip_Description = descHtmlClean
    const whyHtml = convEnf_getString_(ai, ['why_people_love', 'html'])
    let whyHtmlClean = whyHtml ? convEnf_sanitizeWhyPeopleLoveHtml_(whyHtml) : ''
    if (whyHtmlClean) whyHtmlClean = convEnf_rewriteUnsupportedContentText_(whyHtmlClean, flags, evidence)
    if (whyHtmlClean) whyHtmlClean = convEnf_applyEntranceFeesTruthToText_(whyHtmlClean, entranceTruth)
    if (whyHtmlClean) whyHtmlClean = convEnf_applyGuideTruthToText_(whyHtmlClean, guideTruth)
    if (whyHtmlClean && rawCtx && rawCtx.truth) whyHtmlClean = convEnf_applyTruthToText_(whyHtmlClean, rawCtx.truth)
    if (whyHtmlClean && whyHtmlClean.length >= 100) updateMain.AI_Tab_Content = whyHtmlClean
    let boldPromise = convEnf_getString_(ai, ['bold_promise', 'value'])
    if (!boldPromise) boldPromise = convEnf_getString_(ai, ['bold_promise', 'text'])
    if (!boldPromise) boldPromise = convEnf_getString_(ai, ['bold_promise'])
    if (boldPromise) boldPromise = String(boldPromise).replace(/\s+/g, ' ').trim()
    if (boldPromise && boldPromise.length >= 20) updateMain.AI_Bold_Promise = boldPromise
    let atAGlanceObj = convEnf_getObject_(ai, ['at_a_glance', 'value'])
    if (!atAGlanceObj) atAGlanceObj = convEnf_getObject_(ai, ['at_a_glance'])
    if (atAGlanceObj) {
      const atAGlance = {
        duration: String(atAGlanceObj.duration || '').replace(/\s+/g, ' ').trim(),
        meeting_point: String(atAGlanceObj.meeting_point || atAGlanceObj.meeting || atAGlanceObj.meet || '').replace(/\s+/g, ' ').trim(),
        group_size: String(atAGlanceObj.group_size || atAGlanceObj.group || '').replace(/\s+/g, ' ').trim(),
        includes: String(atAGlanceObj.includes || atAGlanceObj.included || '').replace(/\s+/g, ' ').trim(),
        excludes: String(atAGlanceObj.excludes || atAGlanceObj.excluded || '').replace(/\s+/g, ' ').trim()
      }
      const hasAnyAtAGlance = Object.keys(atAGlance).some((k) => Boolean(atAGlance[k]))
      if (hasAnyAtAGlance) updateMain.AI_At_A_Glance = JSON.stringify(atAGlance)
    }
    log('📤 Writing updates to Airtable...')
    if (Object.keys(updateMain).length) {
      updateMain.AI_LastUpdated = nowIso
      convEnf_logAirtableFields_('UPDATE', 'Improvement With AI', imp.id, updateMain)
      await convEnf_airtableUpdateSafe_('Improvement With AI', imp.id, updateMain)
    }

    let newHighlights = convEnf_getArray_(ai, ['highlights', 'items'])
    newHighlights = convEnf_sanitizeStringList_(newHighlights, { max: 12 })
    newHighlights = convEnf_filterUnsupportedItems_(newHighlights, flags)
    newHighlights = convEnf_applyEntranceFeesTruthToHighlights_(newHighlights, entranceTruth)
    newHighlights = convEnf_applyGuideTruthToHighlights_(newHighlights, guideTruth)
    if (newHighlights && newHighlights.length >= 3) {
      log('✅ Improved Highlights:')
      log(JSON.stringify(newHighlights, null, 2))
      await convEnf_replaceHighlights_(tripId, existingHighlights.records, newHighlights, nowIso)
    }

    let newItinerary = convEnf_getArray_(ai, ['itinerary', 'steps'])
    newItinerary = convEnf_sanitizeItinerarySteps_(newItinerary, { max: 20 })
    newItinerary = convEnf_applyItineraryDurationSuffix_(newItinerary)
    newItinerary = convEnf_sanitizeItineraryByFlags_(newItinerary, flags, evidence)
    if (newItinerary && rawCtx && rawCtx.truth) newItinerary = convEnf_applyTruthToItinerary_(newItinerary, rawCtx.truth)
    if (newItinerary && newItinerary.length >= 2) {
      log('✅ Improved Itinerary:')
      log(JSON.stringify(newItinerary, null, 2))
      await convEnf_replaceItinerary_(tripId, existingItinerary.records, newItinerary, nowIso)
    }

    let newIncluded = convEnf_mergeOptionalItems_(ai, ['included', 'items'], ['included', 'optional_items'])
    newIncluded = convEnf_sanitizeStringList_(newIncluded, { max: 40 })
    newIncluded = convEnf_sortIncExcItems_(newIncluded)
    newIncluded = convEnf_filterUnsupportedItems_(newIncluded, flags)
    newIncluded = convEnf_filterOptionalLikeItemsFromIncluded_(newIncluded)

    let newExcluded = convEnf_mergeOptionalItems_(ai, ['excluded', 'items'], ['excluded', 'optional_items'])
    newExcluded = convEnf_sanitizeStringList_(newExcluded, { max: 40 })
    newExcluded = convEnf_sortIncExcItems_(newExcluded)
    newExcluded = convEnf_filterUnsupportedItems_(newExcluded, flags)

    if (newIncluded && newExcluded) {
      const fixed = convEnf_removeIncExcOverlap_(newIncluded, newExcluded)
      newIncluded = fixed.included
      newExcluded = fixed.excluded
    }
    if (rawCtx && rawCtx.truth) {
      const fixed2 = convEnf_applyTruthToIncExcLists_(newIncluded, newExcluded, rawCtx.truth)
      newIncluded = fixed2.included
      newExcluded = fixed2.excluded
    }

    if (newIncluded && newIncluded.length >= 3) {
      log('✅ Improved Includes:')
      log(JSON.stringify(newIncluded, null, 2))
      await convEnf_replaceIncExc_(tripId, existingIncludes.records, 'TripIncludes Improvement With AI', 'IncludeItem', newIncluded, nowIso)
    }
    if (newExcluded && newExcluded.length >= 2) {
      await convEnf_replaceIncExc_(tripId, existingExcludes.records, 'TripExcludes Improvement With AI', 'ExcludeItem', newExcluded, nowIso)
    }
    let newFaqs = convEnf_getArray_(ai, ['faqs', 'items'])
    newFaqs = convEnf_sanitizeFaqItems_(newFaqs, { max: 15 }, { included: newIncluded, excluded: newExcluded, flags, truth: rawCtx ? rawCtx.truth : null })
    newFaqs = convEnf_sortFaqItems_(newFaqs)
    if (newFaqs && newFaqs.length >= 3) {
      log('✅ Improved FAQs:')
      log(JSON.stringify(newFaqs, null, 2))
      await convEnf_replaceFaqs_(tripId, existingFaqs.records, newFaqs, nowIso)
    }
    let packageCopyItems = convEnf_getArray_(ai, ['packages', 'items'])
    packageCopyItems = convEnf_sanitizePackageCopyItems_(packageCopyItems, flags, evidence)
    if (packageCopyItems && packageCopyItems.length) {
      await convEnf_updatePackagesCopy_(existingPackages.records, packageCopyItems)
    }
    _success = true
  } catch (e) {
    log('❌ Conversion Enforcer ERROR:')
    log(e && e.message ? e.message : String(e))
    log(e && e.stack ? e.stack : '')
  } finally {
    if (_success) log('✅ Airtable update SUCCESS for Trip: ' + _logTripId)
    log('🏁 Conversion Enforcer FINISHED for Trip: ' + _logTripId)
  }
}

function convEnf_mergeOptionalItems_(aiObj, itemsPath, optionalPath) {
  const items = convEnf_getArray_(aiObj, itemsPath) || []
  const out = []
  items.forEach((x) => {
    let s = String(x || '').replace(/\s+/g, ' ').trim()
    if (!s) return
    out.push(s)
  })
  return out
}

function convEnf_isOptionalLikeItem_(text) {
  const s = String(text || '').replace(/\s+/g, ' ').trim()
  if (!s) return false
  const lc = s.toLowerCase()
  if (/^optional[:\s-]/i.test(s)) return true
  if (/\bif selected\b/.test(lc)) return true
  if (/\b(optional|add-?on|addon|extra|upgrade|supplement)\b/.test(lc)) return true
  if (/\b(additional cost|extra charge|at extra cost)\b/.test(lc)) return true
  if (/\bfts\b/.test(lc) && /\b(scarf|scarve|scarfes|scarves|oils?)\b/.test(lc)) return true
  return false
}

function convEnf_filterOptionalLikeItemsFromIncluded_(items) {
  if (!Array.isArray(items)) return items
  const out = []
  for (let i = 0; i < items.length; i++) {
    const t = String(items[i] || '').trim()
    if (!t) continue
    if (convEnf_isOptionalLikeItem_(t)) continue
    out.push(t)
  }
  return out
}

function convEnf_detectEntranceFeesTruth_(included, excluded) {
  const incText = (Array.isArray(included) ? included.join(' | ') : String(included || '')).toLowerCase()
  const excText = (Array.isArray(excluded) ? excluded.join(' | ') : String(excluded || '')).toLowerCase()
  const incHas = /\b(entrance|admission|ticket|tickets|entrance fee|entrance fees)\b/.test(incText)
  const excHas = /\b(entrance|admission|ticket|tickets|entrance fee|entrance fees)\b/.test(excText)
  const excSaysNotIncluded = excHas && /\b(not included|excluded)\b/.test(excText)
  const incSaysNotIncluded = incHas && /\b(not included|excluded)\b/.test(incText)
  const includedTruth = incHas && !incSaysNotIncluded
  const excludedTruth = excHas || incSaysNotIncluded || excSaysNotIncluded
  return { included: includedTruth && !excludedTruth, excluded: excludedTruth && !includedTruth, ambiguous: !includedTruth && !excludedTruth }
}

function convEnf_detectGuideTruth_(included, excluded, evidenceText) {
  const incText = (Array.isArray(included) ? included.join(' | ') : String(included || '')).toLowerCase()
  const excText = (Array.isArray(excluded) ? excluded.join(' | ') : String(excluded || '')).toLowerCase()
  const ev = String(evidenceText || '').toLowerCase()
  const hasGuideInInc = /\b(egyptologist|tour guide|guide)\b/.test(incText)
  const hasGuideInExc = /\b(egyptologist|tour guide|guide)\b/.test(excText)
  const incConditional = hasGuideInInc && /\b(if selected|optional|depending on the option)\b/.test(incText)
  const evOptional = /\b(guide)\b/.test(ev) && /\b(if selected|optional|depending on the option)\b/.test(ev)
  const includedTruth = hasGuideInInc && !incConditional && !hasGuideInExc
  const optionalTruth = incConditional || evOptional
  return { included: includedTruth, optional: optionalTruth && !includedTruth, ambiguous: !includedTruth && !optionalTruth }
}

function convEnf_applyGuideTruthToText_(text, truth) {
  let s = String(text || '')
  if (!s.trim()) return ''
  if (truth && truth.included) return s
  s = s
    .replace(/\byour\s+expert\s+egyptologist\s+guide\b/ig, 'If selected, an Egyptologist guide')
    .replace(/\bexpert\s+egyptologist\s+guide\b/ig, 'Egyptologist guide (depending on the option selected)')
    .replace(/\bexpert\s+guidance\b/ig, 'guiding (depending on the option selected)')
    .replace(/\bexpert\s+guide\b/ig, 'guide (depending on the option selected)')
  return s.replace(/\s+/g, ' ').trim()
}

function convEnf_applyGuideTruthToHighlights_(highlights, truth) {
  if (!Array.isArray(highlights)) return highlights
  if (truth && truth.included) return highlights
  const out = []
  for (let i = 0; i < highlights.length; i++) {
    let s = String(highlights[i] || '').replace(/\s+/g, ' ').trim()
    if (!s) continue
    s = convEnf_applyGuideTruthToText_(s, truth)
    if (!s) continue
    out.push(s)
  }
  return out
}

function convEnf_applyEntranceFeesTruthToHighlights_(highlights, truth) {
  if (!Array.isArray(highlights)) return highlights
  if (!truth || (!truth.included && !truth.excluded)) return highlights
  const out = []
  for (let i = 0; i < highlights.length; i++) {
    let s = String(highlights[i] || '').replace(/\s+/g, ' ').trim()
    if (!s) continue
    const lc = s.toLowerCase()
    const mentionsEntrance = /\b(entrance|admission|ticket|tickets|entrance fee|entrance fees)\b/.test(lc)
    if (!mentionsEntrance) { out.push(s); continue }
    if (truth.excluded || truth.ambiguous) {
      s = s
        .replace(/,?\s*(and\s+)?all\s+entrance\s+(tickets|fees)\s+included\.?/ig, '')
        .replace(/,?\s*(and\s+)?entrance\s+(tickets|fees)\s+included\.?/ig, '')
        .replace(/\b(all\s+)?entrance\s+(tickets|fees)\s+included\b/ig, '')
        .replace(/\s+/g, ' ')
        .trim()
      s = s.replace(/\s*[,.]\s*$/g, '').trim()
      if (!s) continue
      out.push(s)
      continue
    }
    out.push(s)
  }
  return out
}

function convEnf_applyEntranceFeesTruthToText_(text, truth) {
  let s = String(text || '')
  if (!s.trim()) return ''
  if (!truth || (!truth.included && !truth.excluded)) return s
  if (truth.excluded || truth.ambiguous) {
    s = s
      .replace(/\b(all\s+)?entrance\s+(tickets|fees)\s+included\b/ig, 'site visits as per itinerary')
      .replace(/\bentrance\s+(tickets|fees)\s+are\s+included\b/ig, 'site visits are as per itinerary')
      .replace(/\b(includes?|including)\s+(all\s+)?entrance\s+(tickets|fees)\b/ig, 'includes site visits as per itinerary')
  }
  if (truth.included) {
    s = s.replace(/\b(entrance\s+(tickets|fees)|tickets?|admission)\s+are\s+not\s+included\b/ig, "attraction entrance fees are included as listed in What's Included")
  }
  return s.replace(/\s+/g, ' ').trim()
}

function convEnf_applyTruthToIncExcLists_(included, excluded, truth) {
  let inc = Array.isArray(included) ? included.slice() : []
  let exc = Array.isArray(excluded) ? excluded.slice() : []
  const t = truth || {}
  const ti = !!t.entrance_included
  const te = !!t.entrance_excluded

  function strip_(arr, re) {
    const out = []
    for (let i = 0; i < arr.length; i++) {
      const s = String(arr[i] || '').replace(/\s+/g, ' ').trim()
      if (!s) continue
      if (re.test(s.toLowerCase())) continue
      out.push(s)
    }
    return out
  }

  if (ti || te) {
    const re = /\b(entrance fee|entrance fees|admission|ticket|tickets)\b/
    inc = strip_(inc, re)
    exc = strip_(exc, re)
    if (ti && !te) inc.push('Attraction entrance fees are included as listed in What\'s Included.')
    else if (te && !ti) exc.push('Attraction entrance fees are not included.')
    else inc.push('Attraction entrance fees depend on the option selected. Please refer to What\'s Included/Excluded.')
  }

  return { included: inc, excluded: exc }
}

function convEnf_filterUnsupportedItems_(items, flags) {
  if (!Array.isArray(items)) return items
  const out = []
  for (let i = 0; i < items.length; i++) {
    const s = String(items[i] || '').trim()
    if (!s) continue
    if (convEnf_hasUnsupportedHighRiskClaims_(s, flags)) continue
    out.push(s)
  }
  return out
}

function convEnf_removeIncExcOverlap_(included, excluded) {
  const inc = Array.isArray(included) ? included : []
  const exc = Array.isArray(excluded) ? excluded : []
  const incKeys = {}
  for (let i = 0; i < inc.length; i++) {
    const k = String(inc[i] || '').replace(/^optional[:\s-]/i, '').replace(/\s+/g, ' ').trim().toLowerCase()
    if (!k) continue
    incKeys[k] = true
  }
  const outExc = []
  for (let i = 0; i < exc.length; i++) {
    const s = String(exc[i] || '').trim()
    if (!s) continue
    const k = s.replace(/^optional[:\s-]/i, '').replace(/\s+/g, ' ').trim().toLowerCase()
    if (k && incKeys[k]) continue
    outExc.push(s)
  }
  return { included: inc, excluded: outExc }
}

function convEnf_getGuaranteedItems_(items) {
  if (!Array.isArray(items)) return []
  const out = []
  for (let i = 0; i < items.length; i++) {
    const s = String(items[i] || '').replace(/\s+/g, ' ').trim()
    if (!s) continue
    if (/^optional[:\s-]/i.test(s)) continue
    out.push(s)
  }
  return out
}

function convEnf_sanitizePackageCopyItems_(items, flags, evidence) {
  if (!Array.isArray(items)) return null
  const out = []
  for (let i = 0; i < items.length; i++) {
    const it = items[i] || {}
    const rid = String(it.airtable_record_id || it.record_id || it.id || '').trim()
    let excerpt = String(it.excerpt || '').replace(/\s+/g, ' ').trim()
    let content = String(it.content_html || it.content || '').trim()
    const action = String(it.action || '').trim()
    const reason = String(it.reason || '').trim()
    const severity = String(it.severity || '').trim()
    if (!rid) continue
    if (excerpt) excerpt = convEnf_rewriteUnsupportedContentText_(excerpt, flags, evidence)
    if (content) content = convEnf_rewriteUnsupportedContentText_(convEnf_sanitizeHtml_(content), flags, evidence)
    out.push({ airtable_record_id: rid, excerpt, content_html: content, action, reason, severity })
  }
  return out
}

function convEnf_isPlaceholderText_(s) {
  const t = String(s || '').trim()
  if (!t) return true
  if (/^\*{3,}$/.test(t)) return true
  if (/(k){5,}/i.test(t)) return true
  if (/(x){5,}/i.test(t)) return true
  if (t.length < 10) return true
  return false
}

async function convEnf_updatePackagesCopy_(existingRecords, packageCopyItems) {
  const recs = Array.isArray(existingRecords) ? existingRecords : []
  const byId = {}
  for (let i = 0; i < recs.length; i++) {
    const r = recs[i]
    if (r && r.id) byId[String(r.id)] = r
  }
  for (let j = 0; j < packageCopyItems.length; j++) {
    const it = packageCopyItems[j] || {}
    const rid = String(it.airtable_record_id || '').trim()
    if (!rid || !byId[rid]) continue
    const fields = {}
    const current = byId[rid].fields || {}
    const allowOverwrite = convEnf_shouldOverwriteLockedField_(it, current)
    if (it.excerpt && (convEnf_isPlaceholderText_(current.excerpt) || allowOverwrite)) fields.excerpt = it.excerpt
    if (it.content_html && (convEnf_isPlaceholderText_(current.content_html) || allowOverwrite)) fields.content_html = it.content_html
    if (Object.keys(fields).length) {
      convEnf_logAirtableFields_('UPDATE', 'Packages', rid, fields)
      await airtableUpdate_('Packages', rid, fields)
    }
  }
}

function convEnf_shouldOverwriteLockedField_(aiItem, currentFields) {
  const it = aiItem || {}
  const cur = currentFields || {}
  const action = String(it.action || '').toLowerCase().trim()
  const reasonLc = String(it.reason || '').toLowerCase().trim()
  const severityLc = String(it.severity || '').toLowerCase().trim()
  const curExcerpt = String(cur.excerpt || '').trim()
  const curHtml = String(cur.content_html || '').trim()
  const isLocked = (!convEnf_isPlaceholderText_(curExcerpt) || !convEnf_isPlaceholderText_(curHtml))
  if (!isLocked) return true
  if (action !== 'rewrite') return false
  if (/(hallucination|mismatch|inconsistent|violation|unsupported|contradict)/.test(reasonLc)) return true
  if (severityLc === 'high' || severityLc === 'critical') return true
  return false
}

function convEnf_hasUnsupportedHighRiskClaims_(text, flags) {
  const t = String(text || '').toLowerCase()
  const f = (flags && typeof flags === 'object') ? flags : {}
  if (!f.has_nile && /\bnile\b/.test(t)) return true
  if (!f.has_felucca && /\b(felucca|faluka)\b/.test(t)) return true
  if (!f.has_boat && /\bboat\b/.test(t)) return true
  if (!f.has_cruise && /\bcruise\b/.test(t)) return true
  if (!f.has_flights && /\b(flight|flights|airfare|air ticket|air tickets)\b/.test(t)) return true
  if (!f.has_snorkel && /\b(snorkel|snorkeling|diving)\b/.test(t)) return true
  if (!f.has_safari && /\b(safari|quad|atv)\b/.test(t)) return true
  if (!f.has_private && /\bprivate\b/.test(t)) return true
  if (!f.has_tickets && /\b(ticket|tickets|admission|entrance fee|entrance fees)\b/.test(t)) return true
  if (!f.has_lunch && /\blunch\b/.test(t)) return true
  if (!f.has_pickup && /\b(pick\s*-?\s*up|hotel\s+pick\s*-?\s*up|pickup)\b/.test(t)) return true
  return false
}

function convEnf_joinListWithAmp_(items) {
  const xs = (Array.isArray(items) ? items : []).map((x) => String(x || '').trim()).filter((x) => !!x)
  if (xs.length <= 1) return xs.join('')
  if (xs.length === 2) return xs[0] + ' & ' + xs[1]
  return xs.slice(0, xs.length - 1).join(', ') + ' & ' + xs[xs.length - 1]
}

function convEnf_extractAttractionsFromTripTitle_(title) {
  const t = String(title || '').replace(/\s+/g, ' ').trim()
  if (!t) return []
  let rhs = t
  if (t.includes(':')) rhs = String(t.split(':').slice(1).join(':') || '').trim()
  rhs = rhs.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
  rhs = rhs.replace(/\s*&\s*/g, ', ').replace(/\s+and\s+/gi, ', ')
  const parts = rhs.split(',').map((x) => String(x || '').trim()).filter((x) => !!x)
  const seen = {}
  const out = []
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    if (!p) continue
    if (p.length > 48) continue
    const key = p.toLowerCase()
    if (seen[key]) continue
    seen[key] = true
    out.push(p)
    if (out.length >= 3) break
  }
  return out
}

function convEnf_extractPrimaryFromTitle_(title) {
  const t = String(title || '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  if (t.includes(':')) return String(t.split(':')[0] || '').trim()
  if (t.includes(' - ')) return String(t.split(' - ')[0] || '').trim()
  if (t.includes(' | ')) return String(t.split(' | ')[0] || '').trim()
  return ''
}

function convEnf_buildUspSuffixFromFlags_(flags) {
  const f = (flags && typeof flags === 'object') ? flags : {}
  const hasLunch = !!f.has_lunch
  const hasPickup = !!f.has_pickup
  if (hasLunch && hasPickup) return 'with Lunch & Hotel Pickup'
  if (hasLunch) return 'with Lunch'
  if (hasPickup) return 'with Hotel Pickup'
  return ''
}

function convEnf_fixTripTypeCasing_(text) {
  let s = convEnf_sanitizeSeoText_(text)
  if (!s) return ''
  s = s.replace(/\bday tour\b/ig, 'Day Tour')
  return s
}

function convEnf_dedupeEgyptianPrefix_(text) {
  let s = convEnf_sanitizeSeoText_(text)
  if (!s) return ''
  s = s.replace(/\b(Egyptian\s+){2,}/gi, 'Egyptian ')
  return s
}

function convEnf_normalizeCivMuseumText_(text) {
  let s = convEnf_sanitizeSeoText_(text)
  if (!s) return ''
  s = convEnf_dedupeEgyptianPrefix_(s)
  s = s.replace(/\b(Egyptian\s+)?Civilization Museum\b/gi, 'Egyptian Civilization Museum')
  s = s.replace(/\bEgyptian Museum\b/gi, 'Egyptian Civilization Museum')
  s = convEnf_dedupeEgyptianPrefix_(s)
  return s
}

function convEnf_stripTrailingUspFragmentFromH1_(text) {
  let s = convEnf_sanitizeSeoText_(text)
  if (!s) return { main: '', tailLunch: false, tailPickup: false }
  s = s.replace(/\s*&\s*$/g, '').trim()
  s = s.replace(/\bwith\s+lunch\s*&\s*(?:h|ho|hot|hote|hotel)?\s*$/i, '').trim()

  const tailFull = /\bwith\s+lunch\s*&\s*hotel\s*pick-?up\b\s*$/i.test(s)
  const tailLunch = tailFull || /\bwith\s+lunch\b\s*$/i.test(s)
  const tailPickup = tailFull || /\bwith\s+hotel\s*pick-?up\b\s*$/i.test(s)

  s = s.replace(/\bwith\s+lunch\s*&\s*hotel\s*pick-?up\b\s*$/i, '').trim()
  s = s.replace(/\bwith\s+hotel\s*pick-?up\b\s*$/i, '').trim()
  s = s.replace(/\bwith\s+lunch\b\s*$/i, '').trim()

  s = s.replace(/\bwith\s+(?:l|lu|lun|lunc|h|ho|hot|hote|hotel)\s*$/i, '').trim()
  s = s.replace(/\bwith\s*$/i, '').trim()
  s = s.replace(/[|—–\-:;,]\s*$/g, '').trim()
  s = s.replace(/\s*&\s*$/g, '').trim()

  return { main: s, tailLunch, tailPickup }
}

function convEnf_truncateH1AtWordBoundary_(text, maxLen) {
  const t = convEnf_sanitizeSeoText_(text)
  if (!t) return ''
  if (!maxLen || t.length <= maxLen) return t
  const cut = t.slice(0, maxLen)
  const lastSpace = cut.lastIndexOf(' ')
  if (lastSpace >= 12) return cut.slice(0, lastSpace).trim().replace(/[,\-–—:;]\s*$/g, '')
  return cut.trim().replace(/[,\-–—:;]\s*$/g, '')
}

function convEnf_finalizeH1Quality_(h1, maxLen, src) {
  let t = convEnf_sanitizeSeoText_(h1)
  if (!t) return ''
  const n = (typeof maxLen === 'number' && Number.isFinite(maxLen) && maxLen > 0) ? Math.floor(maxLen) : 0
  const source = String(src || '')
  for (let i = 0; i < 4; i++) {
    t = t.replace(/\s+[|—–\-:;,]\s*$/g, '').trim()
    t = t.replace(/\s*[|—–\-:;,]+\s*$/g, '').trim()
    t = t.replace(/\s*\+\s*$/g, '').trim()
    t = t.replace(/\s*&\s*$/g, '').trim()
    t = t.replace(/\bwith\s+(?:l|lu|lun|lunc|h|ho|hot|hote|hotel)\s*$/i, '').trim()
    t = t.replace(/\bwith\s*$/i, '').trim()
    t = t.replace(/\b(and|or|but)\s*$/i, '').trim()
  }
  if (/old cairo/i.test(source)) {
    t = t.replace(/\bold\s+cair\b/ig, 'Old Cairo')
    t = t.replace(/\bold\s+cai\b/ig, 'Old Cairo')
  }
  if (/\bold\s+cai(?:r)?$/i.test(t) && !/\bold\s+cairo$/i.test(t)) {
    if (/old cairo/i.test(source)) {
      const rep = t.replace(/\bold\s+cai(?:r)?$/i, 'Old Cairo')
      if (!n || rep.length <= n) t = rep
      else t = t.replace(/\bold\s+cai(?:r)?$/i, 'Old').trim()
    }
  }
  if (/\bold$/i.test(t)) {
    if (/old cairo/i.test(source)) {
      if (!n || t.length + 6 <= n) t = (t + ' Cairo').trim()
      else t = t.replace(/\bold$/i, '').replace(/[,&]\s*$/g, '').trim()
    }
  }
  t = t.replace(/\bwith\s+with\b/ig, 'with')
  if (n && t.length > n) t = convEnf_truncateH1AtWordBoundary_(t, n)
  t = t.replace(/[|—–\-:;,]\s*$/g, '').replace(/[.!?]+$/g, '').trim()
  t = t.replace(/\s*&\s*$/g, '').trim()
  return t
}

function convEnf_forceUspSuffixIntoH1_(h1, flags) {
  const raw = convEnf_dedupeEgyptianPrefix_(h1)
  const split = convEnf_stripTrailingUspFragmentFromH1_(raw)
  const base = split.main
  if (!base) return ''

  const uspFull = convEnf_buildUspSuffixFromFlags_(flags)
  if (!uspFull) return convEnf_truncateH1AtWordBoundary_(base, 90).replace(/[|—–\-:;,]\s*$/g, '').replace(/[.!?]+$/g, '').trim()

  const maxLen = 90
  const reserved = uspFull.length + 1
  const baseMax = maxLen - reserved
  if (baseMax < 12) return convEnf_truncateH1AtWordBoundary_(base, maxLen).replace(/[|—–\-:;,]\s*$/g, '').replace(/[.!?]+$/g, '').trim()

  let shortBase = convEnf_truncateH1AtWordBoundary_(base, baseMax)
  shortBase = shortBase.replace(/[|—–\-:;,]\s*$/g, '').replace(/[.!?]+$/g, '').trim()
  shortBase = shortBase.replace(/\s*&\s*$/g, '').trim()
  shortBase = shortBase.replace(/\bwith\s+(?:l|lu|lun|lunc|h|ho|hot|hote|hotel)\s*$/i, '').trim()
  shortBase = shortBase.replace(/\bwith\s*$/i, '').trim()
  if (!shortBase) return convEnf_truncateH1AtWordBoundary_(base, maxLen).replace(/[|—–\-:;,]\s*$/g, '').replace(/[.!?]+$/g, '').trim()

  let cand = (shortBase + ' ' + uspFull).replace(/\s+/g, ' ').trim()
  cand = cand.replace(/\bwith\s+with\b/ig, 'with')
  cand = cand.replace(/\s*&\s*$/g, '').trim()
  return cand
}

function convEnf_buildH1Fallback_(payload, flags, seoTitle) {
  const p = payload || {}
  const trip = p.trip || {}
  const pSeo = p.seo || {}
  let primary = String(pSeo.focus_keywords || '').replace(/\s+/g, ' ').trim()
  if (!primary) primary = convEnf_extractPrimaryFromTitle_(seoTitle)
  if (!primary) primary = convEnf_extractPrimaryFromTitle_(trip.Title)
  if (!primary) primary = String(seoTitle || trip.Title || '').replace(/\s+/g, ' ').trim()
  if (!primary) return ''
  const atts = convEnf_extractAttractionsFromTripTitle_(trip.Title)
  let h1 = primary
  if (atts.length) h1 = primary + ': ' + convEnf_joinListWithAmp_(atts)
  h1 = convEnf_truncateText_(h1, 90)
  h1 = h1.replace(/[|—–\-:;,]\s*$/g, '').replace(/[.!?]+$/g, '').trim()
  h1 = convEnf_fixTripTypeCasing_(h1)
  h1 = convEnf_forceUspSuffixIntoH1_(h1, flags)
  return h1
}

function convEnf_finalizeSeoFields_(ai, payload, flags) {
  const out = { h1: '', title: '', meta_description: '', excerpt: '', short_summary: '' }
  const pSeo = (payload && payload.seo) ? payload.seo : {}
  const aiH1 = convEnf_getString_(ai, ['seo', 'h1', 'text'])
  const aiTitle = convEnf_getString_(ai, ['seo', 'title', 'text'])
  const aiMeta = convEnf_getString_(ai, ['seo', 'meta_description', 'text'])
  const aiExcerpt = convEnf_getString_(ai, ['seo', 'excerpt', 'text'])
  const aiShort = convEnf_getString_(ai, ['seo', 'short_summary', 'text'])

  const fallbackH1 = String(pSeo.h1 || '').trim()
  const fallbackTitle = String(pSeo.title || (payload && payload.trip ? payload.trip.Title : '') || '').trim()
  const fallbackMeta = String(pSeo.meta_description || pSeo.excerpt || pSeo.short_summary || '').trim()
  const fallbackExcerpt = String(pSeo.excerpt || pSeo.short_summary || '').trim()

  let h1Candidate = convEnf_removeUnsupportedHighRiskParts_(convEnf_sanitizeSeoText_(aiH1 || fallbackH1), flags)
  if (!h1Candidate || h1Candidate.length < 15) h1Candidate = convEnf_buildH1Fallback_(payload, flags, aiTitle || fallbackTitle)
  h1Candidate = convEnf_fixTripTypeCasing_(h1Candidate)
  if (flags && flags.civ_context_slug) {
    h1Candidate = convEnf_normalizeCivMuseumText_(h1Candidate)
  }
  h1Candidate = convEnf_forceUspSuffixIntoH1_(h1Candidate, flags)
  h1Candidate = convEnf_truncateH1AtWordBoundary_(convEnf_sanitizeSeoText_(h1Candidate), 90)
  h1Candidate = h1Candidate.replace(/[|—–\-:;,]\s*$/g, '').replace(/[.!?]+$/g, '').trim()
  const h1Src = String((payload && payload.trip ? payload.trip.Title : '') || '') + ' ' + String(aiH1 || '') + ' ' + String(aiTitle || '')
  out.h1 = convEnf_finalizeH1Quality_(h1Candidate, 90, h1Src)

  out.title = convEnf_removeUnsupportedHighRiskParts_(convEnf_sanitizeSeoText_(aiTitle || fallbackTitle), flags)
  if (!out.title || out.title.length < 20) out.title = convEnf_sanitizeSeoText_(fallbackTitle)
  out.title = convEnf_optimizeSeoTitleForSerp_(out.title, payload, flags)

  out.meta_description = convEnf_removeUnsupportedHighRiskParts_(convEnf_sanitizeSeoText_(aiMeta || fallbackMeta), flags)
  out.meta_description = convEnf_truncateText_(out.meta_description, 160)
  out.meta_description = convEnf_finalizeMetaDescriptionQuality_(out.meta_description, 160)
  out.meta_description = convEnf_optimizeMetaDescriptionForKeyword_(out.meta_description, payload, 160, flags)
  if (!out.meta_description || out.meta_description.length < 60) {
    const fromDesc = convEnf_sanitizeSeoText_(String((payload && payload.description) || '').replace(/<[^>]*>/g, ' '))
    let cleaned = convEnf_truncateText_(convEnf_removeUnsupportedHighRiskParts_(fromDesc, flags), 160)
    cleaned = convEnf_finalizeMetaDescriptionQuality_(cleaned, 160)
    if (cleaned && cleaned.length >= 60) out.meta_description = cleaned
  }
  out.meta_description = convEnf_optimizeMetaDescriptionForKeyword_(out.meta_description, payload, 160, flags)

  out.excerpt = convEnf_removeUnsupportedHighRiskParts_(convEnf_sanitizeSeoText_(aiExcerpt || fallbackExcerpt), flags)
  out.excerpt = convEnf_truncateText_(out.excerpt, 220)

  out.short_summary = convEnf_removeUnsupportedHighRiskParts_(convEnf_sanitizeSeoText_(aiShort || fallbackExcerpt), flags)
  out.short_summary = convEnf_truncateText_(out.short_summary, 240)

  return out
}

function convEnf_sanitizeSeoText_(s) {
  return String(s || '').replace(/\s+/g, ' ').trim()
}

function convEnf_buildSeoEvidenceText_(payload) {
  try {
    const p = payload || {}
    const trip = p.trip || {}
    const parts = [
      trip.Title,
      p.title,
      p.description,
      (p.seo ? p.seo.h1 : ''),
      (p.seo ? p.seo.title : ''),
      (p.seo ? p.seo.meta_description : ''),
      (p.seo ? p.seo.excerpt : ''),
      (p.seo ? p.seo.short_summary : '')
    ]
    return String(parts.filter((x) => x != null && x !== '').join(' ')).replace(/\s+/g, ' ').trim()
  } catch {
    return ''
  }
}

function convEnf_optimizeSeoTitleForSerp_(title, payload, flags) {
  let t = convEnf_sanitizeSeoText_(title)
  if (!t) return ''
  t = t.replace(/\b(Egyptian\s+){2,}/gi, 'Egyptian ')
  const f = (flags && typeof flags === 'object') ? flags : {}
  const civ = !!(f.civ_context_slug || f.has_civ_museum)
  if (civ && /\bcivilization museum\b/i.test(t) && !/egyptian civilization museum/i.test(t)) {
    t = t.replace(/\bCivilization Museum\b/ig, 'Egyptian Civilization Museum')
  }
  if (civ && !/egyptian civilization museum/i.test(t) && /egyptian museum/i.test(t)) {
    t = t.replace(/egyptian museum/ig, 'Egyptian Civilization Museum')
  } else if (!civ && f.has_egyptian_museum && /egyptian civilization museum/i.test(t)) {
    t = t.replace(/egyptian civilization museum/ig, 'Egyptian Museum')
  }
  t = t.replace(/\b(Egyptian\s+){2,}/gi, 'Egyptian ')
  t = t.replace(/\s+and\s+/ig, ' & ')
  t = t.replace(/\s+/g, ' ').trim()
  const target = 60
  if (t.length > target) {
    t = t
      .replace(/\s+with\s+lunch\s*(?:&|and)?\s*hotel\s*pick-?up(?:\s*&\s*drop-?off)?\b/ig, '')
      .replace(/\s+with\s+hotel\s*pick-?up(?:\s*&\s*drop-?off)?\b/ig, '')
      .replace(/\s+with\s+lunch\b/ig, '')
      .replace(/\s*&\s*hotel\s*pick-?up(?:\s*&\s*drop-?off)?\b/ig, '')
      .replace(/\s+hotel\s*pick-?up(?:\s*&\s*drop-?off)?\b/ig, '')
    t = t.replace(/\s+/g, ' ').trim()
    t = t.replace(/[|—–\-:;,]\s*$/g, '').trim()
  }
  if (t.length > target) t = convEnf_truncateText_(t, target)
  if (/\bold$/i.test(t)) {
    const src = String((payload && payload.trip ? payload.trip.Title : '') || '') + ' ' + String(title || '')
    if (/old cairo/i.test(src)) {
      if (t.length + 6 <= target) t = (t + ' Cairo').trim()
      else t = t.replace(/\bold$/i, '').replace(/[,&]\s*$/g, '').trim()
    }
  }
  return t
}

function convEnf_optimizeMetaDescriptionForKeyword_(meta, payload, maxLen, flags) {
  let t = convEnf_sanitizeSeoText_(meta)
  if (!t) return ''
  t = t.replace(/\b(Egyptian\s+){2,}/gi, 'Egyptian ')
  const f = (flags && typeof flags === 'object') ? flags : {}
  const civ = !!(f.civ_context_slug || f.has_civ_museum)
  if (!civ && f.has_egyptian_museum && /egyptian civilization museum/i.test(t)) {
    const rep0 = convEnf_finalizeMetaDescriptionQuality_(t.replace(/egyptian civilization museum/ig, 'Egyptian Museum'), maxLen)
    if (rep0 && rep0.length <= maxLen) return rep0
  }
  if (!civ) return t
  if (/egyptian civilization museum/i.test(t) || /national museum of egyptian civilization/i.test(t) || /museum of egyptian civilization/i.test(t)) return t
  const keyword = 'Egyptian Civilization Museum'
  if (/\bcivilization museum\b/i.test(t) && !/egyptian civilization museum/i.test(t)) {
    const rep2 = convEnf_finalizeMetaDescriptionQuality_(t.replace(/\bCivilization Museum\b/i, keyword), maxLen)
    if (rep2 && rep2.length <= maxLen) return rep2
  }
  if (/egyptian museum/i.test(t)) {
    const rep = convEnf_finalizeMetaDescriptionQuality_(t.replace(/egyptian museum/i, keyword), maxLen)
    if (rep && rep.length <= maxLen) return rep
  }
  t = t.replace(/\b(Egyptian\s+){2,}/gi, 'Egyptian ')
  return t
}

function convEnf_finalizeMetaDescriptionQuality_(s, maxLen) {
  let t = String(s || '').replace(/\s+/g, ' ').trim()
  if (!t) return ''

  t = t.replace(/[|—–\-:;,]\s*$/g, '').trim()
  if (!t) return ''

  let lastIncludesIdx = -1
  const re = /\bincludes\b/ig
  let m
  while ((m = re.exec(t)) !== null) lastIncludesIdx = m.index

  if (lastIncludesIdx >= 0) {
    const tailLen = t.length - lastIncludesIdx
    const endsWithPunct = /[.!?]$/.test(t)
    if (!endsWithPunct && tailLen <= 28) {
      t = t.slice(0, lastIncludesIdx).replace(/[,\-–—:;]\s*$/g, '').trim()
    }
  }

  t = t.replace(/\b(and|with|including|plus|also|to|in|at|on|for|from|by|of|the|a|an)\s*$/i, '').trim()
  t = t.replace(/[|—–\-:;,]\s*$/g, '').trim()

  if (t && !/[.!?]$/.test(t) && (typeof maxLen !== 'number' || t.length + 1 <= maxLen)) {
    t = t + '.'
  }

  if (typeof maxLen === 'number' && isFinite(maxLen) && maxLen > 0) {
    t = convEnf_truncateText_(t, maxLen)
  }

  return t
}

function convEnf_truncateText_(s, maxLen) {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  if (!maxLen || t.length <= maxLen) return t
  const cut = t.slice(0, maxLen)
  const lastSpace = cut.lastIndexOf(' ')
  if (lastSpace >= 80) return cut.slice(0, lastSpace).trim().replace(/[,\-–—:;]\s*$/g, '')
  return cut.trim().replace(/[,\-–—:;]\s*$/g, '')
}

function convEnf_removeUnsupportedHighRiskParts_(text, flags) {
  const t = String(text || '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  if (!convEnf_hasUnsupportedHighRiskClaims_(t, flags)) return t
  const parts = t
    .split(/[|•]|(?:\s+[–—-]\s+)|(?:\s*;\s*)|[.!?]\s+/)
    .map((x) => String(x || '').trim())
    .filter(Boolean)
  const kept = []
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    if (convEnf_hasUnsupportedHighRiskClaims_(p, flags)) continue
    kept.push(p)
  }
  let out = kept.join('. ').replace(/\s+/g, ' ').trim()
  out = out.replace(/^(and|with|including|plus|also)\b\s*/i, '')
  out = out.replace(/[,\-–—:;]\s*$/g, '').trim()
  return out
}

function convEnf_sanitizeStringList_(arr, opts) {
  if (!Array.isArray(arr)) return null
  opts = opts || {}
  const max = (typeof opts.max === 'number' && isFinite(opts.max) && opts.max > 0) ? Math.floor(opts.max) : null
  const out = []
  const seen = {}
  for (let i = 0; i < arr.length; i++) {
    const s = String(arr[i] || '').replace(/\s+/g, ' ').trim()
    if (!s) continue
    const key = s.toLowerCase()
    if (seen[key]) continue
    seen[key] = true
    out.push(s)
    if (max && out.length >= max) break
  }
  return out
}

function convEnf_sanitizeHtml_(html) {
  let s = String(html || '').trim()
  if (!s) return ''
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, '')
  s = s.replace(/\u0000/g, '')
  s = s.replace(/\n{3,}/g, '\n\n')
  if (!s.includes('<p')) {
    const parts = s.split(/\n{2,}/)
    const out = []
    for (let i = 0; i < parts.length; i++) {
      const p = String(parts[i] || '').trim()
      if (!p) continue
      out.push('<p>' + p + '</p>')
    }
    s = out.join('')
  }
  return s.trim()
}

function convEnf_sanitizeWhyPeopleLoveHtml_(html) {
  let s = convEnf_sanitizeHtml_(html)
  if (!s) return s
  if (s.includes('<strong')) return s
  if (s.includes('<p')) {
    s = s.replace(/<p>\s*([^<]{2,120})\s+—\s+([\s\S]*?)<\/p>/g, (_, title, body) => {
      const t = String(title || '').replace(/\s+/g, ' ').trim()
      const b = String(body || '').trim()
      if (!t || !b) return '<p>' + (t || '') + (t && b ? ' — ' : '') + (b || '') + '</p>'
      return '<p><strong>' + t + '</strong> — ' + b + '</p>'
    })
    return s.trim()
  }
  const raw = String(html || '').trim()
  const lines = raw.split(/\n+/).map(x => String(x || '').trim()).filter(Boolean)
  if (lines.length < 2) return s
  const out = []
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]
    const m = ln.match(/^([^—]{2,120})\s+—\s+(.+)$/)
    if (m) out.push('<p><strong>' + m[1].replace(/\s+/g, ' ').trim() + '</strong> — ' + m[2].trim() + '</p>')
    else out.push('<p>' + ln + '</p>')
  }
  return out.join('').trim()
}

function convEnf_logAirtableFields_(action, tableName, recordId, fields) {
  try {
    const f = (fields && typeof fields === 'object') ? fields : {}
    const keys = Object.keys(f).sort()
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i]
      const v = f[k]
      convEnf_logFieldChange_(action, tableName, recordId, k, v)
    }
  } catch {}
}

function convEnf_logFieldChange_(action, tableName, recordId, fieldName, value) {
  try {
    const act = String(action || 'WRITE')
    const tbl = String(tableName || '')
    const rid = recordId ? (' [' + String(recordId) + ']') : ''
    const key = String(fieldName || '')
    const prefix = '🧾 ' + act + ' ' + tbl + rid + ' :: ' + key

    if (value === null) { log(prefix + ' = null'); return }
    if (value === undefined) { log(prefix + ' = undefined'); return }
    if (typeof value === 'number' || typeof value === 'boolean') { log(prefix + ' = ' + String(value)); return }

    if (Array.isArray(value)) {
      log(prefix + ' (array items=' + String(value.length) + '):')
      for (let i = 0; i < value.length; i++) {
        const item = value[i]
        let line = ''
        if (item === null) line = 'null'
        else if (item === undefined) line = 'undefined'
        else if (typeof item === 'object') { try { line = JSON.stringify(item) } catch { line = '[object]' } }
        else line = String(item)
        convEnf_logChunks_(prefix + ' [' + String(i) + '] = ', line)
      }
      return
    }

    if (typeof value === 'object') {
      let js = ''
      try { js = JSON.stringify(value) } catch { js = '[object]' }
      log(prefix + ' (json len=' + String(js.length) + '):')
      convEnf_logChunks_(prefix + ' = ', js)
      return
    }

    const s = String(value)
    log(prefix + ' (len=' + String(s.length) + '):')
    convEnf_logChunks_(prefix + ' = ', s)
  } catch {}
}

function convEnf_logChunks_(linePrefix, text) {
  try {
    const p = String(linePrefix || '')
    const s = String(text || '')
    const chunkSize = 900
    if (!s) { log(p + '""'); return }
    for (let i = 0; i < s.length; i += chunkSize) {
      log(p + s.slice(i, i + chunkSize))
    }
  } catch {}
}

function convEnf_formatLogValue_(v) {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  if (Array.isArray(v)) {
    let joined = v.map(x => String(x)).join(',')
    if (joined.length > 140) joined = joined.slice(0, 140) + '…'
    return '[ ' + joined + ' ]'
  }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (typeof v === 'object') {
    try {
      let js = JSON.stringify(v)
      if (js.length > 180) js = js.slice(0, 180) + '…'
      return js
    } catch {
      return '[object]'
    }
  }
  const s = String(v)
  let oneLine = s.replace(/\s+/g, ' ').trim()
  if (oneLine.length > 180) oneLine = oneLine.slice(0, 180) + '…'
  return '"' + oneLine + '"' + ' (len=' + String(s.length) + ')'
}

function convEnf_sanitizeItinerarySteps_(steps, opts) {
  if (!Array.isArray(steps)) return null
  opts = opts || {}
  const max = (typeof opts.max === 'number' && isFinite(opts.max) && opts.max > 0) ? Math.floor(opts.max) : null
  const out = []
  for (let i = 0; i < steps.length; i++) {
    const st = steps[i] || {}
    const title = String(st.step_title || '').replace(/\s+/g, ' ').trim()
    const desc = String(st.step_description || '').trim()
    const label = String(st.step_label || '').replace(/\s+/g, ' ').trim()
    let durVal = st.duration_value
    if (durVal !== null && durVal !== undefined && durVal !== '') {
      const n = Number(durVal)
      durVal = isFinite(n) ? n : null
    } else {
      durVal = null
    }
    const durUnit = String(st.duration_unit || '').replace(/\s+/g, ' ').trim()
    const meals = String(st.meals_included || '').replace(/\s+/g, ' ').trim()
    if (!title && !desc) continue
    out.push({
      step_title: title,
      step_description: desc,
      step_label: label,
      duration_value: durVal,
      duration_unit: durUnit,
      meals_included: meals
    })
    if (max && out.length >= max) break
  }
  return out
}

function convEnf_applyItineraryDurationSuffix_(steps) {
  if (!Array.isArray(steps)) return steps
  const out = []
  for (let i = 0; i < steps.length; i++) {
    const st0 = steps[i] || {}
    const title = String(st0.step_title || '').trim()
    let desc = String(st0.step_description || '').trim()
    const label = String(st0.step_label || '').trim()
    const durVal = st0.duration_value
    const durUnit = String(st0.duration_unit || '').trim()
    const meals = String(st0.meals_included || '').trim()
    let suffix = ''
    if (durVal !== null && durVal !== undefined && durVal !== '' && isFinite(Number(durVal)) && durUnit) {
      const unitLc = durUnit.toLowerCase()
      let unitOut = durUnit
      if (unitLc === 'mins' || unitLc === 'min' || unitLc === 'minutes') unitOut = 'minutes'
      if (unitLc === 'hrs' || unitLc === 'hr' || unitLc === 'hours') unitOut = 'hours'
      suffix = ' (Approx. ' + String(Number(durVal)) + ' ' + unitOut + ')'
    }
    if (suffix && desc && !desc.includes('Approx.')) desc = desc + suffix
    out.push({
      step_title: title,
      step_description: desc,
      step_label: label,
      duration_value: durVal,
      duration_unit: durUnit,
      meals_included: meals
    })
  }
  return out
}

function convEnf_sanitizeFaqItems_(faqs, opts, ctx) {
  if (!Array.isArray(faqs)) return null
  opts = opts || {}
  const max = (typeof opts.max === 'number' && isFinite(opts.max) && opts.max > 0) ? Math.floor(opts.max) : null
  const out = []
  const seen = {}
  const ctxIncluded = (ctx && ctx.included) ? ctx.included : []
  const ctxExcluded = (ctx && ctx.excluded) ? ctx.excluded : []
  const flags = (ctx && ctx.flags) ? ctx.flags : {}
  const truth = (ctx && ctx.truth) ? ctx.truth : null
  let ctxText = ''
  try { ctxText = JSON.stringify(ctx || {}) } catch { ctxText = '' }
  const ctxLc = String(ctxText || '').toLowerCase()
  const incText = (Array.isArray(ctxIncluded) ? ctxIncluded.join(' | ') : String(ctxIncluded || '')).toLowerCase()
  const excText = (Array.isArray(ctxExcluded) ? ctxExcluded.join(' | ') : String(ctxExcluded || '')).toLowerCase()
  const hasEntranceIncluded = /entrance|admission|ticket/.test(incText) && !/not included|excluded/.test(incText)
  const hasEntranceExcluded = /entrance|admission|ticket/.test(excText) || (/entrance|admission|ticket/.test(incText) && /not included|excluded/.test(incText))
  const hasLanguageEvidence = /(english|french|german|spanish|italian|arabic)\b/.test(ctxLc)
  const hasPrivateEvidence = /\bprivate\b/.test(ctxLc)
  const hasGroupEvidence = /\b(group size|max|maximum|small group|private)\b/.test(ctxLc)
  for (let i = 0; i < faqs.length; i++) {
    const f = faqs[i] || {}
    const q = String(f.question || f.q || '').replace(/\s+/g, ' ').trim()
    let a = String(f.answer || f.a || '').trim()
    if (!q || !a) continue
    const qLc = q.toLowerCase()
    const aLc = a.toLowerCase()
    if (convEnf_hasUnsupportedHighRiskClaims_(a, flags)) a = convEnf_rewriteUnsupportedFaqAnswer_(q, a, flags, { hasEntranceIncluded, hasEntranceExcluded })
    if (convEnf_isEntranceFeesDecisionQuestion_(qLc)) {
      if (hasEntranceIncluded && !hasEntranceExcluded) {
        a = "Yes. Attraction entrance fees are included as listed in What's Included."
      } else if (hasEntranceExcluded && !hasEntranceIncluded) {
        a = "No. Attraction entrance fees are not included as listed in What's Excluded."
      } else {
        a = "Please refer to the What's Included/Excluded section for whether attraction entrance fees are covered for your selected option."
      }
    } else {
      a = convEnf_softNormalizeEntranceFeesInAnswer_(a, { hasEntranceIncluded, hasEntranceExcluded })
    }
    if (/how large|group size|how many people|tour groups/.test(qLc)) {
      const looksLikeGroupSize = (/\b(private|small|group|people|persons|pax|max|maximum|limited|up to|size)\b/.test(aLc) || /\d+/.test(aLc))
      const looksLikeLanguage = (/\b(language|languages|english|french|german|spanish|italian|arabic)\b/.test(aLc))
      if (looksLikeLanguage && !looksLikeGroupSize) {
        a = "Group size depends on the option selected and availability. You'll receive the exact details after booking."
        log('✅ Fixed FAQ: group size question had language answer')
      } else if (!looksLikeGroupSize && !hasGroupEvidence) {
        a = "Group size depends on the option selected and availability. You'll receive the exact details after booking."
        log('✅ Fixed FAQ: normalized group size answer')
      }
      if (a.toLowerCase().includes('private') && !hasPrivateEvidence) {
        a = "Group size depends on the option selected and availability. You'll receive the exact details after booking."
        log('✅ Fixed FAQ: removed unsupported private claim')
      }
    }
    if (/languages?\b/.test(qLc) && !hasLanguageEvidence) {
      a = "Language availability is confirmed at booking."
      log('✅ Fixed FAQ: normalized language answer')
    }
    a = convEnf_fixOptionalExtrasAnswer_(q, a)
    if (truth) {
      a = convEnf_applyTruthToText_(a, truth)
      if (/nile|boat|cruise|felucca|faluka/.test(qLc) && /\bincluded\b/.test(qLc)) {
        const nileIncluded = !!truth.nile_included
        const nileOptional = !!truth.nile_optional
        if (nileOptional && !nileIncluded) {
          a = 'The Nile boat ride is available as an optional add-on if selected during booking.'
        } else if (nileIncluded) {
          a = "Yes, the scenic Nile boat ride is included in the tour as listed in What's Included."
        } else {
          a = "Please refer to the What's Included/Excluded section for whether a Nile boat ride is included for your selected option."
        }
      }
      if (/lunch|meal|food/.test(qLc) && /\bincluded\b/.test(qLc)) {
        const lunchIncluded = !!truth.lunch_included
        const lunchOptional = !!truth.lunch_optional
        if (lunchOptional && !lunchIncluded) {
          a = "Lunch may be available as an optional add-on if selected during booking. Please refer to the What's Included/Excluded section."
        } else if (lunchIncluded) {
          a = "Yes. Lunch is included as listed in What's Included."
        } else {
          a = "Please refer to the What's Included/Excluded section for whether lunch is included for your selected option."
        }
      }
    }
    a = convEnf_fixBrokenFaqText_(a)
    const key = q.toLowerCase()
    if (seen[key]) continue
    seen[key] = true
    out.push({ question: q, answer: a })
    if (max && out.length >= max) break
  }
  return out
}

function convEnf_fixOptionalExtrasAnswer_(question, answer) {
  const q = String(question || '').replace(/\s+/g, ' ').trim()
  const a0 = String(answer || '').trim()
  if (!a0) return ''
  const qLc = q.toLowerCase()
  let a = a0
  const bad = /included\s+unless\s+you\s+select\s+them\.?/ig
  if (bad.test(a)) a = a.replace(bad, 'optional and charged only if selected during booking.')
  if (/\boptional\s+(extras|extra|add-?ons?)\b/.test(qLc) || /\bextras?\s+can\s+i\s+add\b/.test(qLc)) {
    if (/included\s+unless/.test(a.toLowerCase())) a = a.replace(/included\s+unless[^.]*\.?/ig, 'Optional and charged only if selected during booking.')
    if (!/\boptional\b/.test(a.toLowerCase())) a = (a.replace(/\s+/g, ' ').trim() + ' These are optional and charged only if selected during booking.').trim()
  }
  return a.replace(/\s+/g, ' ').trim()
}

function convEnf_fixBrokenFaqText_(text) {
  let s = String(text || '')
  if (!s.trim()) return ''
  s = s.replace(/\s+/g, ' ').trim()
  s = s.replace(/,\s*a,\s*(and\s+)?/gi, ', ')
  s = s.replace(/,\s*,+/g, ', ')
  s = s.replace(/\s+,/g, ',')
  s = s.replace(/,\s+and\s+,/gi, ' and ')
  s = s.replace(/,\s*and\s*([.?!;:])/g, '$1')
  s = s.replace(/\(\s*\)/g, '')
  s = s.replace(/\s+([.?!;:])/g, '$1')
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

function convEnf_isEntranceFeesDecisionQuestion_(question) {
  const q = String(question || '').replace(/\s+/g, ' ').trim().toLowerCase()
  if (!q) return false
  const hasEntrance = /\b(entrance fee|entrance fees|admission|ticket|tickets)\b/.test(q)
  if (!hasEntrance) return false
  const hasDecision = /\b(included|not included|cover|covered|pay|pay for|need to pay|extra charge|additional cost)\b/.test(q)
  if (!hasDecision) return false
  if (/\b(cash|money|bring|what to bring|tips?|gratuities|extras)\b/.test(q)) return false
  return true
}

function convEnf_softNormalizeEntranceFeesInAnswer_(answer, ctx) {
  const c = ctx || {}
  const a0 = String(answer || '').trim()
  if (!a0) return ''
  if (!c.hasEntranceIncluded && !c.hasEntranceExcluded) return a0
  let a = a0
  if (c.hasEntranceExcluded && !c.hasEntranceIncluded) {
    a = a
      .replace(/\b(all\s+)?entrance\s+(tickets|fees)\s+are\s+included\b/ig, "entrance fees are not included")
      .replace(/\b(admission|tickets?)\s+are\s+included\b/ig, "$1 are not included")
  } else if (c.hasEntranceIncluded && !c.hasEntranceExcluded) {
    a = a
      .replace(/\b(entrance\s+(tickets|fees)|admission|tickets?)\s+are\s+not\s+included\b/ig, "entrance fees are included")
      .replace(/\b(not included)\b/ig, "included")
  }
  return convEnf_fixBrokenFaqText_(a)
}

function convEnf_rewriteUnsupportedFaqAnswer_(question, answer, flags, ctx) {
  const q = String(question || '').replace(/\s+/g, ' ').trim()
  const qLc = q.toLowerCase()
  const f = (flags && typeof flags === 'object') ? flags : {}
  const c = ctx || {}
  if (convEnf_isEntranceFeesDecisionQuestion_(qLc)) {
    if (c.hasEntranceIncluded && !c.hasEntranceExcluded) return "Yes. Attraction entrance fees are included as listed in What's Included."
    if (c.hasEntranceExcluded && !c.hasEntranceIncluded) return "No. Attraction entrance fees are not included as listed in What's Excluded."
    return "Please refer to the What's Included/Excluded section for whether attraction entrance fees are covered for your selected option."
  }
  if (/private\b/.test(qLc) && !f.has_private) return "Tour details depend on the option selected and availability. You'll receive the exact details after booking."
  if (/pickup|pick\s*-?\s*up|drop-?off/.test(qLc) && !f.has_pickup) return "Pickup details depend on the option selected. You'll receive the meeting point information after booking."
  if (/lunch|meal|food/.test(qLc) && !f.has_lunch) return "Meal details depend on the option selected. Please refer to the What's Included/Excluded section."
  if (/flight|airfare|air ticket/.test(qLc) && !f.has_flights) return "Flights are not included unless explicitly listed in What's Included."
  if (/cruise|boat|felucca|nile/.test(qLc) && !(f.has_cruise || f.has_boat || f.has_felucca || f.has_nile)) return "Activities depend on the option selected. Please refer to the itinerary and What's Included/Excluded section."
  return "Details depend on the option selected and availability. Please refer to the itinerary and What's Included/Excluded section."
}

function convEnf_rewriteUnsupportedContentText_(text, flags, evidence) {
  let t = String(text || '')
  if (!t.trim()) return ''
  const lc = t.toLowerCase()
  const f = (flags && typeof flags === 'object') ? flags : {}
  const ev = (evidence && typeof evidence === 'object') ? evidence : {}
  const evText = String(ev.strict_combined || ev.combined || '').toLowerCase()
  function replaceAll_(re, repl) { t = t.replace(re, repl); }

  if (!f.has_nile && /\bnile\b/.test(lc) && evText.indexOf('nile') === -1) replaceAll_(/\bnile\b/gi, 'historic Egyptian sites')
  if (!f.has_felucca && /\b(felucca|faluka)\b/i.test(lc) && !/\b(felucca|faluka)\b/.test(evText)) replaceAll_(/\b(felucca|faluka)\b/gi, 'local sightseeing')
  if (!f.has_boat && /\bboat\b/.test(lc) && evText.indexOf('boat') === -1) replaceAll_(/\bboat\b/gi, 'guided tour')
  if (!f.has_cruise && /\bcruise\b/.test(lc) && evText.indexOf('cruise') === -1) replaceAll_(/\bcruise\b/gi, 'guided tour')
  if (!f.has_flights && /\b(flight|flights|airfare|air ticket|air tickets)\b/i.test(lc) && !/\b(flight|flights|airfare|air ticket|air tickets)\b/.test(evText)) replaceAll_(/\b(flight|flights|airfare|air ticket|air tickets)\b/gi, 'transportation')
  if (!f.has_snorkel && /\b(snorkel|snorkeling|diving)\b/i.test(lc) && !/\b(snorkel|snorkeling|diving)\b/.test(evText)) replaceAll_(/\b(snorkel|snorkeling|diving)\b/gi, 'optional activities')
  if (!f.has_safari && /\b(safari|quad|atv)\b/i.test(lc) && !/\b(safari|quad|atv)\b/.test(evText)) replaceAll_(/\b(safari|quad|atv)\b/gi, 'optional activities')
  if (!f.has_private && /\bprivate\b/.test(lc) && evText.indexOf('private') === -1) replaceAll_(/\bprivate\b/gi, 'guided')
  if (!f.has_tickets && /\b(ticket|tickets|admission|entrance fee|entrance fees)\b/i.test(lc) && !/\b(ticket|tickets|admission|entrance fee|entrance fees)\b/.test(evText)) replaceAll_(/\b(ticket|tickets|admission|entrance fee|entrance fees)\b/gi, 'site visits')
  if (!f.has_lunch && /\blunch\b/.test(lc) && evText.indexOf('lunch') === -1) replaceAll_(/\blunch\b/gi, 'meal time')
  if (!f.has_pickup && /\b(pick\s*-?\s*up|hotel\s+pick\s*-?\s*up|pickup)\b/i.test(lc) && !/\b(pick\s*-?\s*up|hotel\s+pick\s*-?\s*up|pickup)\b/.test(evText)) replaceAll_(/\b(pick\s*-?\s*up|hotel\s+pick\s*-?\s*up|pickup)\b/gi, 'meeting point')

  return t.replace(/\s+/g, ' ').trim()
}

function convEnf_sanitizeItineraryByFlags_(steps, flags, evidence) {
  if (!Array.isArray(steps)) return steps
  const out = []
  for (let i = 0; i < steps.length; i++) {
    const st = steps[i] || {}
    const t = convEnf_rewriteUnsupportedContentText_(st.step_title || '', flags, evidence)
    const d = convEnf_rewriteUnsupportedContentText_(st.step_description || '', flags, evidence)
    const l = convEnf_rewriteUnsupportedContentText_(st.step_label || '', flags, evidence)
    let meals = convEnf_rewriteUnsupportedContentText_(st.meals_included || '', flags, evidence)
    if (meals && convEnf_hasUnsupportedHighRiskClaims_(meals, flags)) meals = ''
    out.push({
      step_title: t,
      step_description: d,
      step_label: l,
      duration_value: st.duration_value,
      duration_unit: st.duration_unit,
      meals_included: meals
    })
  }
  return out
}

function convEnf_sortIncExcItems_(items) {
  if (!Array.isArray(items)) return items
  const scored = items.map((s) => {
    const t = String(s || '').trim()
    const lc = t.toLowerCase()
    const optional = /^optional[:\s-]/i.test(t) ? 1 : 0
    let score = 0
    if (/hotel pickup|pickup|drop-?off/.test(lc)) score += 90
    if (/transport|air-?conditioned|vehicle|transfer/.test(lc)) score += 80
    if (/egyptologist|guide/.test(lc)) score += 70
    if (/lunch|meal/.test(lc)) score += 60
    if (/water/.test(lc)) score += 50
    if (/entrance|admission|ticket/.test(lc)) score += 40
    if (/tax|service charge/.test(lc)) score += 30
    if (optional) score -= 1000
    return { t, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.map((x) => x.t)
}

function convEnf_sortFaqItems_(faqs) {
  if (!Array.isArray(faqs)) return faqs
  const scored = faqs.map((f, idx) => {
    const q = String((f || {}).question || '').trim()
    const a = String((f || {}).answer || '').trim()
    const lc = q.toLowerCase()
    let score = 0
    if (/entrance|admission|ticket/.test(lc)) score += 100
    if (/pickup|pick up|meeting|where.*meet|hotel/.test(lc)) score += 95
    if (/cancel|cancellation|refund/.test(lc)) score += 90
    if (/wear|bring|dress|shoes/.test(lc)) score += 85
    if (/duration|how long|time/.test(lc)) score += 80
    if (/group|private|languages?/.test(lc)) score += 75
    if (/kids|children|elderly|accessible/.test(lc)) score += 70
    return { q, a, score, idx }
  })
  scored.sort((x, y) => {
    if (y.score !== x.score) return y.score - x.score
    return x.idx - y.idx
  })
  return scored.map((x) => ({ question: x.q, answer: x.a }))
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

function convEnf_getObject_(obj, pathArr) {
  const v = convEnf_getPath_(obj, pathArr)
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  return v
}

function convEnf_getPath_(obj, pathArr) {
  let cur = obj
  for (let i = 0; i < pathArr.length; i++) {
    if (!cur || typeof cur !== 'object') return null
    cur = cur[pathArr[i]]
  }
  return cur
}

async function convEnf_airtableUpdateSafe_(tableName, recordId, fields) {
  try {
    await airtableUpdate_(tableName, recordId, fields)
    return
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e)
    const unknown = []
    const re = /Unknown field name:\s*(?:\\"([^\\"]+)\\"|"([^"]+)")/g
    let m
    while ((m = re.exec(msg)) !== null) unknown.push(m[1] || m[2])
    if (!unknown.length) throw e
    const filtered = {}
    Object.keys(fields || {}).forEach((k) => {
      if (!unknown.includes(k)) filtered[k] = fields[k]
    })
    if (!Object.keys(filtered).length) return
    await airtableUpdate_(tableName, recordId, filtered)
  }
}

function convEnf_buildStandardContext_(payload) {
  const p = payload || {}
  const trip = p.trip || {}
  const seo = p.seo || {}

  function norm_(s) {
    return String(s || '').replace(/\s+/g, ' ').trim()
  }
  function stripHtml_(s) {
    return norm_(String(s || '').replace(/<[^>]*>/g, ' '))
  }
  function listToText_(arr, max) {
    if (!Array.isArray(arr) || !arr.length) return ''
    const out = []
    for (let i = 0; i < arr.length; i++) {
      const t = stripHtml_(arr[i])
      if (!t) continue
      out.push(t)
      if (typeof max === 'number' && out.length >= max) break
    }
    return out.join(' | ')
  }

  const highlightsText = listToText_(p.highlights, 20)
  const includedText = listToText_(p.included, 80)
  const excludedText = listToText_(p.excluded, 80)

  let itineraryText = ''
  if (Array.isArray(p.itinerary)) {
    const parts = []
    for (let i = 0; i < p.itinerary.length; i++) {
      const st = p.itinerary[i] || {}
      const title = stripHtml_(st.step_title || st.title || '')
      const desc = stripHtml_(st.step_description || st.desc || '')
      const chunk = norm_((title ? (title + ': ') : '') + desc)
      if (!chunk) continue
      parts.push(chunk)
      if (parts.length >= 25) break
    }
    itineraryText = parts.join(' | ')
  }

  let faqsText = ''
  if (Array.isArray(p.faqs)) {
    const parts = []
    for (let i = 0; i < p.faqs.length; i++) {
      const f = p.faqs[i] || {}
      const q = stripHtml_(f.question || f.q || '')
      const a = stripHtml_(f.answer || f.a || '')
      const chunk = norm_((q ? (q + ' — ') : '') + a)
      if (!chunk) continue
      parts.push(chunk)
      if (parts.length >= 20) break
    }
    faqsText = parts.join(' | ')
  }

  let packagesText = ''
  if (Array.isArray(p.packages)) {
    const parts = []
    for (let i = 0; i < p.packages.length; i++) {
      const pkg = p.packages[i] || {}
      const title = stripHtml_(pkg.PackageTitle || pkg.title || '')
      const excerpt = stripHtml_(pkg.excerpt || pkg.Excerpt || '')
      const html = stripHtml_(pkg.content_html || pkg.CONTENT_HTML || pkg.content || '')
      const chunk = norm_([title, excerpt, html].filter(Boolean).join(' — '))
      if (!chunk) continue
      parts.push(chunk)
      if (parts.length >= 20) break
    }
    packagesText = parts.join(' | ')
  }

  const seoTitle = norm_(seo.title)
  const seoMeta = norm_(seo.meta_description)
  const seoExcerpt = norm_(seo.excerpt || seo.short_summary)

  const descriptionText = stripHtml_(p.description || '')
  const whyText = stripHtml_(p.why_people_love || '')

  const evidenceText = norm_([
    trip.Title,
    seoTitle,
    seoMeta,
    seoExcerpt,
    descriptionText,
    whyText,
    highlightsText,
    itineraryText,
    includedText,
    excludedText,
    faqsText,
    packagesText
  ].filter(Boolean).join(' | '))

  const strictEvidenceText = norm_([
    trip.Title,
    trip.TourType,
    descriptionText,
    highlightsText,
    itineraryText,
    excludedText,
    packagesText
  ].filter(Boolean).join(' | '))

  const lc = strictEvidenceText.toLowerCase()
  const slugLc = String(trip.Slug || '').toLowerCase()
  const civFromSlug = (slugLc.indexOf('civilization') !== -1 && slugLc.indexOf('museum') !== -1) || /\bnmec\b/.test(slugLc)
  const flags = {
    has_nile: /\bnile\b/.test(lc),
    has_felucca: /\b(felucca|faluka)\b/.test(lc),
    has_boat: /\bboat\b/.test(lc),
    has_cruise: /\bcruise\b/.test(lc),
    has_flights: /\b(flight|flights|airfare|air ticket|air tickets)\b/.test(lc),
    has_snorkel: /\b(snorkel|snorkeling|diving)\b/.test(lc),
    has_safari: /\b(safari|quad|atv)\b/.test(lc),
    has_private: /\bprivate\b/.test(lc),
    has_tickets: /\b(ticket|tickets|admission|entrance fee|entrance fees)\b/.test(lc),
    has_lunch: /\blunch\b/.test(lc),
    has_pickup: /\b(pick\s*-?\s*up|hotel\s+pick\s*-?\s*up|pickup)\b/.test(lc),
    has_egyptian_museum: /\begyptian museum\b/.test(lc),
    has_civ_museum: civFromSlug || /\b(egyptian civilization museum|museum of egyptian civilization|national museum of egyptian civilization|civilization museum|nmec)\b/.test(lc),
    civ_context_slug: civFromSlug,
    has_languages: /\b(language|languages|english|french|german|spanish|italian|arabic)\b/.test(lc),
    has_group_size: /\b(group size|max|maximum|small group|up to \d+|\d+ travelers|\d+ people|\d+ persons)\b/.test(lc)
  }

  return {
    trip: {
      id: String(trip.id || ''),
      title: String(trip.Title || ''),
      tour_type: String(trip.TourType || ''),
      slug: String(trip.Slug || ''),
      duration_hours: String(trip.Duration_Hours || ''),
      duration_minutes: String(trip.Duration_Minutes || ''),
      duration_unit: String(trip.Duration_Unit || '')
    },
    seo: {
      title: seoTitle,
      meta_description: seoMeta,
      excerpt: seoExcerpt,
      focus_keywords: norm_(seo.focus_keywords || ''),
      permalink: norm_(seo.permalink || '')
    },
    evidence: {
      description: descriptionText,
      why_people_love: whyText,
      highlights: highlightsText,
      itinerary: itineraryText,
      included: includedText,
      excluded: excludedText,
      faqs: faqsText,
      packages: packagesText,
      combined: evidenceText,
      strict_combined: strictEvidenceText
    },
    flags
  }
}

async function convEnf_fetchRawContext_(tripId, tripNumber, tripFields) {
  const tripName = (tripFields && (tripFields.Title || tripFields.Name)) ? String(tripFields.Title || tripFields.Name).trim() : ''
  const out = { evidence_text: '', truth: {} }

  function escape_(s) {
    return convEnf_escapeFormulaString_(String(s || '').trim())
  }

  function orFormula_(linkField) {
    const parts = []
    if (tripId) parts.push(`FIND('${escape_(tripId)}', ARRAYJOIN({${linkField}}))`)
    if (tripNumber) parts.push(`FIND('${escape_(tripNumber)}', ARRAYJOIN({${linkField}}))`)
    if (tripName) parts.push(`FIND('${escape_(tripName)}', ARRAYJOIN({${linkField}}))`)
    if (!parts.length) return ''
    return parts.length === 1 ? parts[0] : `OR(${parts.join(', ')})`
  }

  async function fetch_(table, linkField) {
    const formula = orFormula_(linkField)
    const params = { pageSize: 200 }
    if (formula) params.filterByFormula = formula
    const res = await airtableGet_(table, params)
    return res && res.records ? res.records : []
  }

  function takeText_(records, fieldNames, max) {
    const rs = Array.isArray(records) ? records : []
    const outArr = []
    for (let i = 0; i < rs.length; i++) {
      const f = rs[i] && rs[i].fields ? rs[i].fields : {}
      for (let j = 0; j < fieldNames.length; j++) {
        const v = f[fieldNames[j]]
        if (!v) continue
        const t = String(v).replace(/\s+/g, ' ').trim()
        if (!t) continue
        outArr.push(t)
        break
      }
      if (typeof max === 'number' && outArr.length >= max) break
    }
    return outArr
  }

  try {
    const rawInc = await fetch_('TripIncludes', 'Trip')
    const rawExc = await fetch_('TripExcludes', 'Trip')
    const rawIt = await fetch_('ItinerarySteps', 'Trip')
    const rawAdd = await fetch_('AddOns', 'Trip')

    const incItems = takeText_(rawInc, ['IncludeItem', 'Included', 'Text', 'Title', 'Name'], 80)
    const excItems = takeText_(rawExc, ['ExcludeItem', 'Excluded', 'Text', 'Title', 'Name'], 80)
    const itParts = []
    itParts.push(...takeText_(rawIt, ['StepLabel', 'StepTitle', 'Title', 'Name'], 25))
    itParts.push(...takeText_(rawIt, ['StepDescription', 'Description', 'Details'], 25))
    const addParts = []
    addParts.push(...takeText_(rawAdd, ['AddOnTitle', 'Title', 'Name'], 30))
    addParts.push(...takeText_(rawAdd, ['AddOnDescription', 'Description', 'Details'], 30))

    const incText = incItems.join(' | ')
    const excText = excItems.join(' | ')
    const itText = itParts.join(' | ')
    const addText = addParts.join(' | ')
    out.evidence_text = [incText, excText, itText, addText].filter(Boolean).join(' | ')

    const incLc = incText.toLowerCase()
    const excLc = excText.toLowerCase()
    const itLc = itText.toLowerCase()
    const addLc = addText.toLowerCase()

    out.truth = {
      lunch_included: /\blunch\b/.test(incLc) || (/\blunch\b/.test(itLc) && !/\bif selected\b/.test(itLc)),
      lunch_optional: /\blunch\b/.test(addLc),
      nile_included: /\b(nile|boat|cruise|felucca|faluka)\b/.test(incLc) || /\b(nile|boat|cruise|felucca|faluka)\b/.test(itLc),
      nile_optional: /\b(nile|boat|cruise|felucca|faluka)\b/.test(addLc),
      entrance_included: /\b(entrance|admission|ticket|tickets)\b/.test(incLc) && !/\bnot included\b/.test(incLc) && !/\bexcluded\b/.test(incLc),
      entrance_excluded: /\b(entrance|admission|ticket|tickets)\b/.test(excLc) || (/\b(entrance|admission|ticket|tickets)\b/.test(incLc) && (/\bnot included\b/.test(incLc) || /\bexcluded\b/.test(incLc)))
    }
  } catch (e) {
    log('convEnf_fetchRawContext_ error: ' + String(e && e.message ? e.message : e))
  }

  return out
}

function convEnf_enrichStandardContextWithRawEvidence_(standardContext, rawEvidenceText) {
  const ctx = standardContext || {}
  const appended = String(rawEvidenceText || '').replace(/\s+/g, ' ').trim()
  if (!appended) return ctx

  const ev = ctx.evidence || {}
  const strict = String(ev.strict_combined || '').trim()
  const combined = String(ev.combined || '').trim()
  let strict2 = (strict ? (strict + ' | ') : '') + appended
  let combined2 = (combined ? (combined + ' | ') : '') + appended
  if (strict2.length > 6000) strict2 = strict2.slice(0, 6000)
  if (combined2.length > 8000) combined2 = combined2.slice(0, 8000)

  ctx.evidence = ev
  ctx.evidence.strict_combined = strict2
  ctx.evidence.combined = combined2

  const trip = ctx.trip || {}
  const slugLc = String(trip.slug || '').toLowerCase()
  const civFromSlug = (slugLc.indexOf('civilization') !== -1 && slugLc.indexOf('museum') !== -1) || /\bnmec\b/.test(slugLc)
  const lc = String(strict2 || '').toLowerCase()
  ctx.flags = {
    has_nile: /\bnile\b/.test(lc),
    has_felucca: /\b(felucca|faluka)\b/.test(lc),
    has_boat: /\bboat\b/.test(lc),
    has_cruise: /\bcruise\b/.test(lc),
    has_flights: /\b(flight|flights|airfare|air ticket|air tickets)\b/.test(lc),
    has_snorkel: /\b(snorkel|snorkeling|diving)\b/.test(lc),
    has_safari: /\b(safari|quad|atv)\b/.test(lc),
    has_private: /\bprivate\b/.test(lc),
    has_tickets: /\b(ticket|tickets|admission|entrance fee|entrance fees)\b/.test(lc),
    has_lunch: /\blunch\b/.test(lc),
    has_pickup: /\b(pick\s*-?\s*up|hotel\s+pick\s*-?\s*up|pickup)\b/.test(lc),
    has_egyptian_museum: /\begyptian museum\b/.test(lc),
    has_civ_museum: civFromSlug || /\b(egyptian civilization museum|museum of egyptian civilization|national museum of egyptian civilization|civilization museum|nmec)\b/.test(lc),
    civ_context_slug: civFromSlug,
    has_languages: /\b(language|languages|english|french|german|spanish|italian|arabic)\b/.test(lc),
    has_group_size: /\b(group size|max|maximum|small group|up to \d+|\d+ travelers|\d+ people|\d+ persons)\b/.test(lc)
  }
  return ctx
}

function convEnf_applyTruthToText_(text, truth) {
  const t0 = String(text || '')
  if (!t0.trim()) return ''
  let t = t0
  const tr = truth || {}
  if (tr.lunch_included) {
    t = t.replace(/\b(lunch)\s*\(if selected\)/ig, '$1')
    t = t.replace(/\b(lunch)\s*-\s*if selected\b/ig, '$1')
  }
  if (tr.nile_included && !tr.nile_optional) {
    t = t.replace(/\b(nile\s+boat\s+ride)\s*\(if selected\)/ig, '$1')
    t = t.replace(/\b(boat\s+ride)\s*\(if selected\)/ig, '$1')
  }
  if (tr.nile_optional && !tr.nile_included) {
    t = t.replace(/\b(included)\b/ig, 'available')
  }
  return t.replace(/\s+/g, ' ').trim()
}

function convEnf_applyTruthToItinerary_(steps, truth) {
  if (!Array.isArray(steps)) return steps
  const tr = truth || {}
  const out = []
  for (let i = 0; i < steps.length; i++) {
    const st = steps[i] || {}
    let d = String(st.step_description || '').trim()
    if (d) d = convEnf_applyTruthToText_(d, tr)
    out.push({
      step_title: st.step_title,
      step_description: d,
      step_label: st.step_label,
      duration_value: st.duration_value,
      duration_unit: st.duration_unit,
      meals_included: st.meals_included
    })
  }
  return out
}

async function convEnf_buildInternalBenchmarkInsights_(tripFields) {
  const slug = (tripFields && tripFields.Slug) ? String(tripFields.Slug).trim() : ''
  let token = ''
  if (slug) token = String(slug.split('-')[0] || '').trim().toLowerCase()
  if (!token || token.length < 3) return ''

  const safeTok = token.replace(/'/g, "\\'")
  const formula = `AND({RankMathScore}>=60, FIND('${safeTok}', LOWER({Slug})))`
  try {
    const res = await airtableGet_('Trips', { filterByFormula: formula, maxRecords: 5, pageSize: 5 })
    const recs = res && res.records ? res.records : []
    if (!recs.length) return ''
    const patterns = []
    for (let i = 0; i < recs.length; i++) {
      const f = recs[i].fields || {}
      const t = String(f.Title || '').replace(/\s+/g, ' ').trim()
      const s = String(f.Slug || '').replace(/\s+/g, ' ').trim()
      if (!t) continue
      patterns.push(`${t} (${s})`)
      if (patterns.length >= 3) break
    }
    if (!patterns.length) return ''
    return [
      'Internal benchmark reference trips (do not copy text):',
      patterns.map((x) => '- ' + x).join('\n'),
      "Style signals to emulate (without copying): clear pickup/logistics, quantified time blocks, strong 'who it's for' paragraph, consistent Included/Excluded language."
    ].join('\n')
  } catch {
    return ''
  }
}

async function convEnf_fetchExternalBenchmarkInsights_(tripFields, rawCtx) {
  const apiKey = String((config && config.SERPER_API_KEY) || process.env.SERPER_API_KEY || '').trim()
  if (!apiKey) return ''

  const title = (tripFields && tripFields.Title) ? String(tripFields.Title).replace(/\s+/g, ' ').trim() : ''
  const slug = (tripFields && tripFields.Slug) ? String(tripFields.Slug).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() : ''
  const seed = title || slug
  if (!seed) return ''

  const q = convEnf_buildExternalQuery_(seed)
  const sr = await convEnf_serperSearchFull_(q, apiKey)
  const results = sr && Array.isArray(sr.results) ? sr.results : []
  const extraSearchInsights = convEnf_buildSerperSearchInsightsText_(sr && sr.raw ? sr.raw : null)
  const picked = convEnf_pickCompetitorResults_(results, 6)
  if (!picked.length) return ''

  const pages = []
  for (let i = 0; i < picked.length; i++) {
    const r = picked[i]
    const pageText = await convEnf_serperScrape_(r.url, apiKey)
    if (pageText) {
      pages.push({ url: r.url, title: r.title || '', snippet: r.snippet || '', text: pageText })
    } else {
      const sn = String(r.snippet || '').replace(/\s+/g, ' ').trim()
      const ti = String(r.title || '').replace(/\s+/g, ' ').trim()
      const fallback = [
        ti ? ('Title: ' + ti) : '',
        sn ? ('Snippet: ' + sn) : '',
        extraSearchInsights ? ('Search insights:\n' + extraSearchInsights) : ''
      ].filter(Boolean).join('\n')
      if (fallback && fallback.length >= 120) {
        pages.push({ url: r.url, title: r.title || '', snippet: r.snippet || '', text: fallback })
      }
    }
    if (pages.length >= 2) break
  }
  if (!pages.length && extraSearchInsights) {
    pages.push({ url: 'serper://search', title: seed, snippet: '', text: extraSearchInsights })
  }
  if (!pages.length) return ''

  try {
    if (rawCtx && rawCtx.truth && Array.isArray(pages) && pages.length) {
      convEnf_applyExternalTruthVotesToRawTruth_(rawCtx.truth, pages)
    }
  } catch {
  }

  const brief = await convEnf_summarizeExternalBenchmarksToInsights_(seed, pages, rawCtx)
  if (!brief) return ''

  const urls = pages.map((p) => p.url).filter(Boolean)
  return [
    'External benchmark insights (research only; do not copy text):',
    urls.map((u) => '- ' + u).join('\n'),
    brief
  ].join('\n')
}

function convEnf_extractExternalTruthVotes_(text) {
  const lc = String(text || '').toLowerCase()
  const votes = {
    entrance_included: 0,
    entrance_excluded: 0,
    lunch_included: 0,
    lunch_excluded: 0,
    lunch_optional: 0,
    nile_included: 0,
    nile_excluded: 0,
    nile_optional: 0
  }

  if (/\b(entrance fees?|entrance tickets?|admission|tickets?)\b/.test(lc)) {
    if (/\b(entrance fees?|entrance tickets?|admission|tickets?)\b[\s\S]{0,40}\b(not included|excluded|extra)\b/.test(lc)) votes.entrance_excluded++
    if (/\b(included|includes)\b[\s\S]{0,40}\b(entrance fees?|entrance tickets?|admission|tickets?)\b/.test(lc)) votes.entrance_included++
    if (/\b(entrance fees?|entrance tickets?|admission|tickets?)\b[\s\S]{0,40}\b(included)\b/.test(lc) && !/\bnot included\b/.test(lc)) votes.entrance_included++
  }

  if (/\blunch\b/.test(lc) || /\bmeal\b/.test(lc)) {
    if (/\b(lunch|meal)\b[\s\S]{0,40}\b(not included|excluded|extra)\b/.test(lc)) votes.lunch_excluded++
    if (/\b(optional|if selected|upgrade)\b[\s\S]{0,60}\b(lunch|meal)\b/.test(lc) || /\b(lunch|meal)\b[\s\S]{0,60}\b(optional|if selected|upgrade)\b/.test(lc)) votes.lunch_optional++
    if (/\b(included|includes)\b[\s\S]{0,40}\b(lunch|meal)\b/.test(lc) || (/\b(lunch|meal)\b[\s\S]{0,40}\bincluded\b/.test(lc) && !/\bnot included\b/.test(lc))) votes.lunch_included++
  }

  if (/\b(nile|felucca|faluka|boat ride|cruise)\b/.test(lc)) {
    if (/\b(nile|boat ride|cruise|felucca|faluka)\b[\s\S]{0,60}\b(not included|excluded|extra)\b/.test(lc)) votes.nile_excluded++
    if (/\b(optional|if selected|upgrade)\b[\s\S]{0,80}\b(nile|boat ride|cruise|felucca|faluka)\b/.test(lc) || /\b(nile|boat ride|cruise|felucca|faluka)\b[\s\S]{0,80}\b(optional|if selected|upgrade)\b/.test(lc)) votes.nile_optional++
    if (/\b(included|includes)\b[\s\S]{0,60}\b(nile|boat ride|cruise|felucca|faluka)\b/.test(lc) || (/\b(nile|boat ride|cruise|felucca|faluka)\b[\s\S]{0,60}\bincluded\b/.test(lc) && !/\bnot included\b/.test(lc))) votes.nile_included++
  }

  return votes
}

function convEnf_decideExternalTruth_(sum) {
  const s = sum || {}
  function decide_(inc, exc, opt) {
    if (inc > 0 && exc === 0) return { decision: 'included', confidence: inc }
    if (exc > 0 && inc === 0) return { decision: 'excluded', confidence: exc }
    if (opt > 0 && inc === 0 && exc === 0) return { decision: 'optional', confidence: opt }
    return { decision: '', confidence: Math.max(inc || 0, exc || 0, opt || 0) }
  }
  return {
    entrance: decide_(s.entrance_included || 0, s.entrance_excluded || 0, 0),
    lunch: decide_(s.lunch_included || 0, s.lunch_excluded || 0, s.lunch_optional || 0),
    nile: decide_(s.nile_included || 0, s.nile_excluded || 0, s.nile_optional || 0)
  }
}

function convEnf_applyExternalTruthVotesToRawTruth_(truth, pages) {
  const t = truth || {}
  const p = Array.isArray(pages) ? pages : []
  const sum = {
    entrance_included: 0,
    entrance_excluded: 0,
    lunch_included: 0,
    lunch_excluded: 0,
    lunch_optional: 0,
    nile_included: 0,
    nile_excluded: 0,
    nile_optional: 0
  }
  const sources = []
  for (let i = 0; i < p.length; i++) {
    const v = convEnf_extractExternalTruthVotes_(p[i] && p[i].text ? p[i].text : '')
    Object.keys(sum).forEach((k) => { sum[k] += Number(v[k] || 0) })
    if (p[i] && p[i].url) sources.push(String(p[i].url))
  }
  const dec = convEnf_decideExternalTruth_(sum)
  t.external = {
    sources: sources.slice(0, 6),
    votes: sum,
    decisions: dec
  }

  const hasEntranceConflict = !!(t.entrance_included && t.entrance_excluded)
  if (hasEntranceConflict && dec.entrance && dec.entrance.decision) {
    if (dec.entrance.decision === 'included') { t.entrance_included = true; t.entrance_excluded = false }
    if (dec.entrance.decision === 'excluded') { t.entrance_included = false; t.entrance_excluded = true }
  }

  const hasLunchConflict = !!(t.lunch_included && t.lunch_optional)
  if (hasLunchConflict && dec.lunch && dec.lunch.decision) {
    if (dec.lunch.decision === 'included') { t.lunch_included = true; t.lunch_optional = false }
    if (dec.lunch.decision === 'optional') { t.lunch_included = false; t.lunch_optional = true }
  }

  const hasNileConflict = !!(t.nile_included && t.nile_optional)
  if (hasNileConflict && dec.nile && dec.nile.decision) {
    if (dec.nile.decision === 'included') { t.nile_included = true; t.nile_optional = false }
    if (dec.nile.decision === 'optional') { t.nile_included = false; t.nile_optional = true }
  }
}

function convEnf_buildExternalQuery_(seed) {
  let base = String(seed || '').replace(/\s+/g, ' ').trim()
  if (!base) return ''
  if (base.length > 110) base = base.slice(0, 110)
  return `${base} site:getyourguide.com`
}

function convEnf_relaxQueryForSearch_(query) {
  let q = String(query || '').replace(/\s+/g, ' ').trim()
  if (!q) return ''
  q = q.replace(/\(\s*site:[^)]+\)/gi, ' ')
  q = q.replace(/\bsite:[^\s)]+/gi, ' ')
  q = q.replace(/\s+OR\s+/gi, ' ')
  q = q.replace(/[()]/g, ' ')
  q = q.replace(/\s+/g, ' ').trim()
  return q
}

function convEnf_buildSerperSearchInsightsText_(obj) {
  if (!obj || typeof obj !== 'object') return ''

  function clean_(s) {
    return String(s || '').replace(/\s+/g, ' ').trim()
  }

  const lines = []

  const paa = Array.isArray(obj.peopleAlsoAsk) ? obj.peopleAlsoAsk : []
  for (let i = 0; i < paa.length && lines.length < 8; i++) {
    const q = clean_(paa[i] && (paa[i].question || paa[i].title))
    const sn = clean_(paa[i] && (paa[i].snippet || paa[i].answer))
    if (!q) continue
    lines.push(`Q: ${q}${sn ? (` | A: ${sn}`) : ''}`)
  }

  const related = Array.isArray(obj.relatedSearches) ? obj.relatedSearches : []
  for (let i = 0; i < related.length && lines.length < 12; i++) {
    const rq = clean_(related[i] && (related[i].query || related[i].title))
    if (!rq) continue
    lines.push(`Related: ${rq}`)
  }

  const kg = obj.knowledgeGraph && typeof obj.knowledgeGraph === 'object' ? obj.knowledgeGraph : null
  const kgDesc = clean_(kg && (kg.description || kg.snippet))
  if (kgDesc) lines.push('Knowledge: ' + kgDesc)

  const ab = obj.answerBox && typeof obj.answerBox === 'object' ? obj.answerBox : null
  const abSn = clean_(ab && (ab.snippet || ab.answer || ab.title))
  if (abSn) lines.push('AnswerBox: ' + abSn)

  const text = lines.join('\n').trim()
  if (!text) return ''
  return text.length > 2000 ? text.slice(0, 2000) : text
}

async function convEnf_serperSearchFull_(query, apiKey) {
  const q0 = String(query || '').trim()
  if (!q0) return { results: [], raw: null, used: null }
  const key = String(apiKey || '').trim()
  if (!key) return { results: [], raw: null, used: null }
  const url = 'https://google.serper.dev/search'
  const hl0 = String((config && config.SERPER_HL) || process.env.SERPER_HL || 'en').trim()
  const gl0 = String((config && config.SERPER_GL) || process.env.SERPER_GL || 'eg').trim()
  const num = Number((config && config.SERPER_COMPETITOR_MAX_RESULTS) || process.env.SERPER_COMPETITOR_MAX_RESULTS || 10)

  function toResults_(obj) {
    const organic = obj && obj.organic ? obj.organic : []
    if (!Array.isArray(organic)) return []
    return organic.map((x) => ({
      title: x.title || '',
      url: x.link || x.url || '',
      snippet: x.snippet || ''
    })).filter((x) => !!x.url)
  }

  async function req_(q, hl, gl) {
    const payload = { q, num: Number.isFinite(num) && num > 0 ? Math.min(20, Math.floor(num)) : 10, hl, gl }
    const obj = await http.postJson(url, { 'X-API-KEY': key, 'Content-Type': 'application/json' }, payload, 3, 900)
    if (obj && obj.error) {
      log('Serper search error: ' + JSON.stringify(obj.error))
    }
    return obj
  }

  try {
    let obj = await req_(q0, hl0, gl0)
    let results = toResults_(obj)
    if (results.length) return { results, raw: obj || null, used: { q: q0, hl: hl0, gl: gl0 } }

    obj = await req_(q0, 'en', 'us')
    results = toResults_(obj)
    if (results.length) return { results, raw: obj || null, used: { q: q0, hl: 'en', gl: 'us' } }

    const q1 = convEnf_relaxQueryForSearch_(q0)
    if (q1 && q1 !== q0) {
      obj = await req_(q1, 'en', 'us')
      results = toResults_(obj)
      if (results.length) return { results, raw: obj || null, used: { q: q1, hl: 'en', gl: 'us' } }
    }

    return { results: [], raw: obj || null, used: null }
  } catch (e) {
    log('Serper search failed: ' + String(e && e.message ? e.message : e))
    return { results: [], raw: null, used: null }
  }
}

async function convEnf_serperSearch_(query, apiKey) {
  const out = await convEnf_serperSearchFull_(query, apiKey)
  return out && Array.isArray(out.results) ? out.results : []
}

async function convEnf_serperScrapeFull_(pageUrl, apiKey) {
  const u = String(pageUrl || '').trim()
  if (!u) return { text: '', raw: null }
  const key = String(apiKey || '').trim()
  if (!key) return { text: '', raw: null }
  const endpoints = ['https://scrape.serper.dev', 'https://google.serper.dev/scrape']
  const payloads = [
    { url: u, includeMarkdown: true },
    { url: u, includeMarkdown: false },
    { url: u }
  ]

  function normalize_(t) {
    const s = String(t || '').replace(/\s+/g, ' ').trim()
    if (!s) return ''
    return s.length > 60000 ? s.slice(0, 60000) : s
  }

  function pickText_(obj) {
    if (!obj) return ''
    if (typeof obj === 'string') return normalize_(obj)
    if (Array.isArray(obj)) {
      for (const x of obj) {
        const t = pickText_(x)
        if (t) return t
      }
      return ''
    }
    if (typeof obj !== 'object') return ''

    const direct = obj.text || obj.content || obj.markdown || obj.body || obj.html || ''
    const t0 = normalize_(direct)
    if (t0) return t0

    const r1 = obj.result || obj.data || obj.response || null
    const t1 = pickText_(r1)
    if (t1) return t1

    const rs = obj.results
    if (Array.isArray(rs)) {
      for (const item of rs) {
        if (item && item.success === false) continue
        const t2 = pickText_(item)
        if (t2) return t2
      }
    }
    return ''
  }

  const debugScrape = String(process.env.SERPER_SCRAPE_DEBUG || '').trim() === '1'
  function debugObj_(endpoint, payload, obj) {
    if (!debugScrape) return
    try {
      const keys = (obj && typeof obj === 'object' && !Array.isArray(obj)) ? Object.keys(obj) : []
      const lens = []
      if (obj && typeof obj === 'object') {
        const d = obj.text || obj.content || obj.markdown || ''
        if (d) lens.push('direct=' + String(String(d).length))
        const data = obj.data && typeof obj.data === 'object' ? obj.data : null
        if (data) {
          const dd = data.text || data.content || data.markdown || ''
          if (dd) lens.push('data=' + String(String(dd).length))
        }
        const rs = Array.isArray(obj.results) ? obj.results : []
        if (rs.length && rs[0] && typeof rs[0] === 'object') {
          const r0 = rs[0]
          const r0d = r0.text || r0.content || r0.markdown || ''
          if (r0d) lens.push('results0=' + String(String(r0d).length))
          lens.push('results0_keys=' + Object.keys(r0).slice(0, 12).join(','))
        }
      }
      log('Serper scrape debug: endpoint=' + String(endpoint) + ' payload=' + JSON.stringify(payload) + ' type=' + typeof obj + ' keys=' + keys.slice(0, 18).join(',') + (lens.length ? (' lens=' + lens.join('|')) : ''))
    } catch {
    }
  }

  async function postJsonFast_(endpoint, payload) {
    if (!http || !http.raw) return null
    const resp = await http.raw.request({
      url: endpoint,
      method: 'post',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      data: payload,
      timeout: 6_000,
      validateStatus: () => true
    })
    const status = resp && typeof resp.status === 'number' ? resp.status : 0
    if (status < 200 || status >= 300) return null
    const data = resp ? resp.data : null
    if (data == null) return {}
    if (typeof data === 'string') {
      const s = String(data || '').trim()
      if (!s) return {}
      try {
        return JSON.parse(s)
      } catch {
        return s
      }
    }
    return data
  }

  let remaining = 3
  for (const endpoint of endpoints) {
    for (const payload of payloads) {
      if (remaining <= 0) return { text: '', raw: null }
      remaining--
      try {
        const obj = await postJsonFast_(endpoint, payload)
        debugObj_(endpoint, payload, obj)
        const text = pickText_(obj)
        if (text) return { text, raw: obj || null }
      } catch {
      }
    }
  }
  const pw = String(process.env.PLAYWRIGHT_SCRAPE_ENABLED || '').trim() === '1'
  if (pw && convEnf_isUsefulTourUrl_(u)) {
    try {
      const r = await convEnf_playwrightScrape_(u)
      const t = normalize_(r && r.text ? r.text : '')
      if (t && t.length >= 200) return { text: t, raw: { playwright: true, title: r && r.title ? r.title : '', chars: r && r.chars ? r.chars : 0 } }
    } catch {
    }
  }
  return { text: '', raw: null }
}

async function convEnf_serperScrape_(pageUrl, apiKey) {
  const r = await convEnf_serperScrapeFull_(pageUrl, apiKey)
  return r && r.text ? r.text : ''
}

function convEnf_isUsefulTourUrl_(url) {
  const u = String(url || '').trim().toLowerCase()
  if (!u) return false
  if (!u.includes('getyourguide.com')) return false
  if (u.includes('/-t')) return true
  if (/-t\d+/.test(u)) return true
  if (u.includes('/activity/')) return true
  if (u.includes('/tour') || u.includes('/tours/') || u.includes('things-to-do') || u.includes('activities')) return true
  return false
}

function convEnf_pickCompetitorResults_(results, max) {
  const rs = Array.isArray(results) ? results : []
  const out = []
  const seen = new Set()
  const allow = ['getyourguide.com']
  const lim = (typeof max === 'number' && Number.isFinite(max) && max > 0) ? Math.floor(max) : 3

  for (const r of rs) {
    const u = String(r && r.url ? r.url : '').trim()
    if (!u) continue
    const lc = u.toLowerCase()
    if (lc.includes('ftstravels.com')) continue
    if (!allow.some((d) => lc.includes(d))) continue
    if (!convEnf_isUsefulTourUrl_(u)) continue
    if (seen.has(lc)) continue
    seen.add(lc)
    out.push({ title: r.title || '', url: u, snippet: r.snippet || '' })
    if (out.length >= lim) break
  }
  return out
}

function convEnf_tokenizeSimilarity_(text) {
  const t0 = String(text || '').toLowerCase()
  if (!t0.trim()) return []
  const stop = new Set([
    'the', 'and', 'or', 'with', 'without', 'from', 'to', 'in', 'on', 'at', 'for', 'by', 'of', 'a', 'an',
    'tour', 'tours', 'trip', 'tickets', 'ticket', 'entry', 'day', 'half', 'full', 'private', 'shared', 'guided',
    'skip', 'line', 'best', 'top', 'visit', 'visiting', 'includes', 'including', 'include',
    'getyourguide', 'get', 'your', 'guide'
  ])
  const m = t0.match(/[a-z0-9\u0600-\u06ff]+/g) || []
  const out = []
  const seen = new Set()
  for (const raw of m) {
    const tok = String(raw || '').trim()
    if (!tok) continue
    if (tok.length < 3 && !/^\d+$/.test(tok)) continue
    if (stop.has(tok)) continue
    if (seen.has(tok)) continue
    seen.add(tok)
    out.push(tok)
  }
  return out
}

function convEnf_similarityScore_(seedTokens, candidateText) {
  const seed = Array.isArray(seedTokens) ? seedTokens : []
  if (!seed.length) return 0
  const candTokens = convEnf_tokenizeSimilarity_(candidateText)
  if (!candTokens.length) return 0
  const seedSet = new Set(seed)
  let inter = 0
  for (const t of candTokens) if (seedSet.has(t)) inter++
  const denom = Math.sqrt(seed.length * candTokens.length)
  if (!denom) return 0
  return inter / denom
}

function convEnf_similarityBoost_(seedTokens, candidateText) {
  const seed = Array.isArray(seedTokens) ? seedTokens : []
  if (!seed.length) return 0
  const t = String(candidateText || '').toLowerCase()
  if (!t.trim()) return 0

  const strong = seed.filter((tok) => {
    const s = String(tok || '').trim().toLowerCase()
    if (!s) return false
    if (/^\d+$/.test(s)) return false
    return s.length >= 5
  })
  if (!strong.length) return 0

  let hits = 0
  for (const tok of strong) if (t.includes(tok)) hits++
  const ratio = hits / strong.length
  let bonus = ratio * 0.15

  if (seed.includes('civilization')) {
    if (t.includes('civilization') || t.includes('nmec')) bonus += 0.08
    if (t.includes('egyptian-museum') || t.includes('egyptian museum')) bonus -= 0.06
  }

  return bonus
}

async function convEnf_pickBestGygResultBySimilarity_(picked, seedText, apiKey) {
  const rs = Array.isArray(picked) ? picked : []
  const seed = String(seedText || '').trim()
  if (!rs.length || !seed) return { best: null, scored: [] }
  const seedTokens = convEnf_tokenizeSimilarity_(seed)
  const scored = []

  for (const r of rs) {
    const u = String(r && r.url ? r.url : '').trim()
    if (!u) continue
    let scrText = ''
    try {
      const scr = await convEnf_serperScrapeFull_(u, apiKey)
      scrText = scr && scr.text ? String(scr.text) : ''
    } catch {
      scrText = ''
    }
    const candText = [
      r.title || '',
      r.snippet || '',
      u,
      scrText ? scrText.slice(0, 20000) : ''
    ].join('\n')
    const baseScore = convEnf_similarityScore_(seedTokens, candText)
    const boost = convEnf_similarityBoost_(seedTokens, candText)
    const score = baseScore + boost
    scored.push({ url: u, title: r.title || '', snippet: r.snippet || '', score, score_base: baseScore, score_boost: boost })
  }

  scored.sort((a, b) => (b.score || 0) - (a.score || 0))
  const best = scored.length ? scored[0] : null
  return { best, scored }
}

let convEnf_crypto_ = null
function convEnf_hash8_(s) {
  const t = String(s == null ? '' : s)
  try {
    if (!convEnf_crypto_) convEnf_crypto_ = require('crypto')
    return convEnf_crypto_.createHash('md5').update(t).digest('hex').slice(0, 8)
  } catch {
    let h = 0
    for (let i = 0; i < t.length; i++) h = ((h << 5) - h + t.charCodeAt(i)) | 0
    const x = Math.abs(h).toString(16)
    return x.padStart(8, '0').slice(0, 8)
  }
}

function convEnf_appendQueryParams_(url, params) {
  const u0 = String(url || '').trim()
  if (!u0) return ''
  const ps = params && typeof params === 'object' ? params : {}
  const parts = []
  for (const k of Object.keys(ps)) {
    const v = ps[k]
    if (v == null) continue
    const vs = Array.isArray(v) ? v : [v]
    for (const item of vs) {
      const s = String(item == null ? '' : item).trim()
      if (!s) continue
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(s)}`)
    }
  }
  if (!parts.length) return u0
  return u0 + (u0.includes('?') ? '&' : '?') + parts.join('&')
}

function convEnf_applyGygCurrencyToUrl_(url, currency) {
  const u0 = String(url || '').trim()
  if (!u0) return ''
  const cur = String(currency || '').trim().toUpperCase()
  if (!cur) return u0
  try {
    const u = new URL(u0)
    const existing = String(u.searchParams.get('currency') || '').trim().toUpperCase()
    if (existing !== cur) u.searchParams.set('currency', cur)
    return u.toString()
  } catch {
    const lc = u0.toLowerCase()
    if (lc.includes('currency=')) return u0
    return convEnf_appendQueryParams_(u0, { currency: cur })
  }
}

function convEnf_slugify_(s) {
  const raw = String(s || '').trim().toLowerCase()
  if (!raw) return ''
  const t = raw
    .replace(/&amp;/g, 'and')
    .replace(/&/g, 'and')
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  return t
}

function convEnf_buildTripPackagesLink_(packageTitle) {
  const slug = convEnf_slugify_(packageTitle)
  if (!slug) return ''
  return 'https://ftstravels.com/trip-packages/' + slug
}

function convEnf_categoryIdFromLabel_(label) {
  const t = String(label || '').replace(/\s+/g, ' ').trim().toLowerCase()
  if (!t) return null
  if (t === 'adult' || t === 'adults') return 11
  if (t === 'child' || t === 'children') return 12
  if (t === 'infant' || t === 'infants') return 87
  if (t === 'passengers' || t === 'passenger') return 88
  if (t === 'student' || t === 'student (with id)' || t.includes('student')) return 264
  return null
}

function convEnf_inferSalePrice10_(regularPrice, salePrice) {
  const s = salePrice != null ? Number(salePrice) : null
  if (s != null && isFinite(s)) return s
  const r = regularPrice != null ? Number(regularPrice) : null
  if (r == null || !isFinite(r)) return null
  const out = r * 0.9
  if (!isFinite(out)) return null
  return Math.round(out * 100) / 100
}

function convEnf_parseGygPcEnv_() {
  const raw = String(process.env.GYG_PC || '').trim()
  if (!raw) return []
  const chunks = raw.split(/[;|]/g).map((x) => String(x || '').trim()).filter(Boolean)
  const out = []
  for (const c of chunks) {
    const t = c.replace(/\s+/g, '')
    if (!/^\d+,\d+$/.test(t)) continue
    out.push(t)
  }
  return out
}

function convEnf_parseMoney_(s) {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  if (!t) return null
  const m = t.match(/(?:\b(usd|eur|gbp|aed|egp)\b|([$€£]))\s*([0-9]{1,3}(?:[, ][0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)/i)
  if (!m) return null
  let cur = (m[1] ? m[1].toUpperCase() : (m[2] || '')).trim()
  if (cur === '€') cur = 'EUR'
  else if (cur === '$') cur = 'USD'
  else if (cur === '£') cur = 'GBP'
  const rawNum = String(m[3] || '').replace(/[, ]/g, '')
  const num = Number(rawNum)
  return { currency: cur || '', amount: isFinite(num) ? num : null, raw: t }
}

function convEnf_extractRegularSaleFromText_(text) {
  const t = String(text || '')
  if (!t.trim()) return { currency: '', regular: null, sale: null }
  const head = t.slice(0, 16000)
  const re = /(?:\b(USD|EUR|GBP|AED|EGP)\b|([$€£]))\s*([0-9]{1,3}(?:[, ][0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)/ig
  const ms = []
  let m = null
  while ((m = re.exec(head)) !== null && ms.length < 12) {
    let cur = (m[1] ? String(m[1]).toUpperCase() : (m[2] || '')).trim()
    if (cur === '€') cur = 'EUR'
    else if (cur === '$') cur = 'USD'
    else if (cur === '£') cur = 'GBP'
    const rawNum = String(m[3] || '').replace(/[, ]/g, '')
    const num = Number(rawNum)
    if (!isFinite(num)) continue
    ms.push({ currency: cur || '', amount: num, idx: m.index })
  }
  if (!ms.length) return { currency: '', regular: null, sale: null }
  let currency = ''
  for (const x of ms) {
    if (x.currency) { currency = x.currency; break }
  }
  let regular = null
  let sale = null
  for (let i = 0; i < ms.length - 1; i++) {
    const a = ms[i]
    const b = ms[i + 1]
    if (b.idx - a.idx > 80) continue
    if (a.currency && b.currency && a.currency !== b.currency) continue
    if (b.amount < a.amount) {
      regular = a.amount
      sale = b.amount
      if (!currency) currency = a.currency || b.currency || ''
      break
    }
  }
  if (regular == null) {
    regular = ms[0].amount
    if (!currency) currency = ms[0].currency || ''
  }
  return { currency: currency || '', regular, sale }
}

function convEnf_extractFromPerPersonPrice_(text) {
  const t = String(text || '')
  if (!t.trim()) return { currency: '', regular: null, sale: null }
  const head = t.slice(0, 12000)
  const re = /\bfrom\b[\s\S]{0,120}?(?:\b(USD|EUR|GBP|AED|EGP)\b|([$€£]))\s*([0-9]{1,3}(?:[, ][0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)[\s\S]{0,220}?(?:\b(USD|EUR|GBP|AED|EGP)\b|([$€£]))\s*([0-9]{1,3}(?:[, ][0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)[\s\S]{0,80}?\bper person\b/ig
  const matches = []
  let m = null
  while ((m = re.exec(head)) !== null && matches.length < 8) {
    let cur1 = (m[1] ? String(m[1]).toUpperCase() : (m[2] || '')).trim()
    let cur2 = (m[4] ? String(m[4]).toUpperCase() : (m[5] || '')).trim()
    if (cur1 === '€') cur1 = 'EUR'
    else if (cur1 === '$') cur1 = 'USD'
    else if (cur1 === '£') cur1 = 'GBP'
    if (cur2 === '€') cur2 = 'EUR'
    else if (cur2 === '$') cur2 = 'USD'
    else if (cur2 === '£') cur2 = 'GBP'
    const n1 = Number(String(m[3] || '').replace(/[, ]/g, ''))
    const n2 = Number(String(m[6] || '').replace(/[, ]/g, ''))
    if (!isFinite(n1) || !isFinite(n2)) continue
    const currency = cur2 || cur1 || ''
    const sale = (n2 < n1 ? n2 : null)
    matches.push({ currency, regular: n1, sale })
  }
  if (!matches.length) return { currency: '', regular: null, sale: null }
  let best = matches[0]
  for (const x of matches) {
    const bSale = (best.sale != null) ? best.sale : best.regular
    const xSale = (x.sale != null) ? x.sale : x.regular
    if (xSale < bSale) best = x
  }
  return best
}

function convEnf_extractGygAgePricesFromText_(text) {
  const t = String(text || '')
  if (!t.trim()) return []
  const out = []
  const re = /\b(Adult|Adults|Child|Children|Infant|Infants|Senior|Seniors|Youth|Student(?:\s*\(with ID\))?)\b[^\n\r]{0,140}?\b(?:Age|Ages)\b[^\d]{0,10}(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?[^\n\r]{0,180}?(?:From\s*)?(?:\b(USD|EUR|GBP|AED|EGP)\b|([$€£]))\s*([0-9]{1,3}(?:[, ][0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)/ig
  let m = null
  while ((m = re.exec(t)) !== null && out.length < 10) {
    const labelRaw = String(m[1] || '').trim()
    const label = labelRaw.toLowerCase().startsWith('adult') ? 'Adult'
      : (labelRaw.toLowerCase().startsWith('child') ? 'Child'
        : (labelRaw.toLowerCase().startsWith('infant') ? 'Infant'
          : (labelRaw.toLowerCase().startsWith('senior') ? 'Senior'
            : (labelRaw.toLowerCase().startsWith('youth') ? 'Youth' : labelRaw))))
    const a1 = Number(m[2])
    const a2 = m[3] != null ? Number(m[3]) : null
    const cur = (m[4] ? String(m[4]).toUpperCase() : (m[5] || '')).trim()
    const rawNum = String(m[6] || '').replace(/[, ]/g, '')
    const num = Number(rawNum)
    out.push({
      label,
      age_min: isFinite(a1) ? a1 : null,
      age_max: (a2 != null && isFinite(a2)) ? a2 : null,
      currency: cur || '',
      price: isFinite(num) ? num : null
    })
  }
  if (out.length === 0) {
    const re2 = /\b(Adult|Adults|Child|Children|Infant|Infants|Senior|Seniors|Youth|Student(?:\s*\(with ID\))?)\b[^\n\r]{0,120}?(?:From\s*)?(?:\b(USD|EUR|GBP|AED|EGP)\b|([$€£]))\s*([0-9]{1,3}(?:[, ][0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)/ig
    let m2 = null
    while ((m2 = re2.exec(t)) !== null && out.length < 10) {
      const labelRaw = String(m2[1] || '').trim()
      const label = labelRaw.toLowerCase().startsWith('adult') ? 'Adult'
        : (labelRaw.toLowerCase().startsWith('child') ? 'Child'
          : (labelRaw.toLowerCase().startsWith('infant') ? 'Infant'
            : (labelRaw.toLowerCase().startsWith('senior') ? 'Senior'
              : (labelRaw.toLowerCase().startsWith('youth') ? 'Youth' : labelRaw))))
      const cur = (m2[2] ? String(m2[2]).toUpperCase() : (m2[3] || '')).trim()
      const rawNum = String(m2[4] || '').replace(/[, ]/g, '')
      const num = Number(rawNum)
      out.push({
        label,
        age_min: null,
        age_max: null,
        currency: cur || '',
        price: isFinite(num) ? num : null
      })
    }
  }
  return out
}

function convEnf_extractJsonLd_(raw) {
  if (!raw || typeof raw !== 'object') return []
  const candidates = []
  const direct =
    raw.jsonLd || raw.jsonld || raw['json-ld'] || raw['json_ld'] ||
    raw.structuredData || raw.structured_data || raw['structured-data'] ||
    raw.ldJson || raw.ldjson || raw['ld-json'] ||
    (raw.metadata && raw.metadata.jsonLd ? raw.metadata.jsonLd : null) ||
    null
  if (direct) candidates.push(direct)
  const data = raw.data && typeof raw.data === 'object' ? raw.data : null
  if (data) {
    const d2 =
      data.jsonLd || data.jsonld || data['json-ld'] || data['json_ld'] ||
      data.structuredData || data.structured_data || data['structured-data'] ||
      data.ldJson || data.ldjson || data['ld-json'] ||
      (data.metadata && data.metadata.jsonLd ? data.metadata.jsonLd : null) ||
      null
    if (d2) candidates.push(d2)
  }
  const rs = Array.isArray(raw.results) ? raw.results : []
  if (rs.length) {
    const r0 = rs[0] && typeof rs[0] === 'object' ? rs[0] : null
    if (r0) {
      const d3 =
        r0.jsonLd || r0.jsonld || r0['json-ld'] || r0['json_ld'] ||
        r0.structuredData || r0.structured_data || r0['structured-data'] ||
        r0.ldJson || r0.ldjson || r0['ld-json'] ||
        (r0.metadata && r0.metadata.jsonLd ? r0.metadata.jsonLd : null) ||
        null
      if (d3) candidates.push(d3)
    }
  }

  const out = []
  function pushAny_(x) {
    if (!x) return
    if (typeof x === 'string') {
      const s = String(x || '').trim()
      if (!s) return
      try {
        const j = JSON.parse(s)
        pushAny_(j)
      } catch {
      }
      return
    }
    if (Array.isArray(x)) {
      x.forEach(pushAny_)
      return
    }
    if (typeof x === 'object') out.push(x)
  }
  candidates.forEach(pushAny_)
  return out
}

function convEnf_collectOffersFromJsonLd_(nodes) {
  const ns = Array.isArray(nodes) ? nodes : []
  const offers = []
  const seen = typeof WeakSet !== 'undefined' ? new WeakSet() : null
  const stack = []
  ns.forEach((n) => { if (n && typeof n === 'object') stack.push(n) })

  function pushOffer_(off) {
    if (!off || typeof off !== 'object') return
    const cur = String(off.priceCurrency || off.currency || '').trim()
    let price = null
    if (off.price != null) {
      const n = Number(off.price)
      if (isFinite(n)) price = n
    }
    if (price == null && off.lowPrice != null) {
      const n2 = Number(off.lowPrice)
      if (isFinite(n2)) price = n2
    }
    if (price == null && off.highPrice != null) {
      const n3 = Number(off.highPrice)
      if (isFinite(n3)) price = n3
    }
    if (price == null) return
    offers.push({ currency: cur, price })
  }

  let guard = 0
  while (stack.length && guard < 2500) {
    guard++
    const x = stack.pop()
    if (!x || typeof x !== 'object') continue
    if (seen) {
      if (seen.has(x)) continue
      seen.add(x)
    }

    if (x.offers) {
      const o = x.offers
      if (Array.isArray(o)) o.forEach(pushOffer_)
      else pushOffer_(o)
    }
    if (x.price != null || x.lowPrice != null || x.highPrice != null) {
      pushOffer_(x)
    }

    const g = x['@graph']
    if (Array.isArray(g)) g.forEach((y) => { if (y && typeof y === 'object') stack.push(y) })

    for (const k of Object.keys(x)) {
      const v = x[k]
      if (!v) continue
      if (typeof v === 'object') stack.push(v)
    }
  }

  return offers
}

function convEnf_extractFromPrice_(text) {
  const t = String(text || '')
  if (!t.trim()) return null
  const m = t.match(/\bfrom\b[^\n\r]{0,120}?(?:\b(USD|EUR|GBP|AED|EGP)\b|([$€£]))\s*([0-9]{1,3}(?:[, ][0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)/i)
  if (!m) return null
  const cur = (m[1] ? String(m[1]).toUpperCase() : (m[2] || '')).trim()
  const rawNum = String(m[3] || '').replace(/[, ]/g, '')
  const num = Number(rawNum)
  return { currency: cur || '', amount: isFinite(num) ? num : null }
}

function convEnf_collectGygOptionsFromJson_(obj) {
  const out = []
  const seen = new Set()
  const stack = [obj]
  let guard = 0

  function normLabel_(s) {
    const t = String(s || '').replace(/\s+/g, ' ').trim()
    return t
  }

  function normCatLabel_(s) {
    const t0 = normLabel_(s)
    if (!t0) return ''
    const t = t0.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
    const lc = t.toLowerCase()
    if (lc === 'adult' || lc === 'adults') return 'Adult'
    if (lc === 'child' || lc === 'children' || lc === 'kid' || lc === 'kids') return 'Child'
    if (lc === 'infant' || lc === 'infants') return 'Infant'
    if (lc === 'senior' || lc === 'seniors') return 'Senior'
    if (lc === 'youth') return 'Youth'
    if (lc === 'student') return 'Student'
    return t
  }

  function pickOptTitle_(x) {
    const t = normLabel_(x.optionTitle || x.option_title || x.variantTitle || x.variant_title || x.title || x.name || x.label || '')
    return t
  }

  function pickOptId_(x) {
    const v = x.optionId || x.option_id || x.variantId || x.variant_id || x.id || x.uuid || ''
    const s = String(v == null ? '' : v).trim()
    return s
  }

  function collectCats_(x) {
    const cats = x.pricingCategories || x.pricing_categories || x.categories || x.prices || null
    const arr = Array.isArray(cats) ? cats : (cats && typeof cats === 'object' ? [cats] : [])
    const outCats = []
    function num_(v) {
      if (v == null) return null
      if (typeof v === 'number') return isFinite(v) ? v : null
      if (typeof v === 'string') {
        const n = Number(String(v).replace(/[, ]/g, ''))
        return isFinite(n) ? n : null
      }
      if (typeof v === 'object') {
        return num_(v.amount != null ? v.amount : (v.value != null ? v.value : (v.price != null ? v.price : null)))
      }
      return null
    }
    for (const c of arr) {
      if (!c || typeof c !== 'object') continue
      const label = normCatLabel_(
        c.label || c.title || c.name || c.category ||
        c.type || c.participant_type || c.participantType ||
        c.age_group || c.ageGroup || ''
      )
      const cur = String(
        c.currency || c.priceCurrency || c.price_currency ||
        c.currencyCode || c.currency_code || c.currency_code_iso ||
        ''
      ).trim()
      const ageMin = c.ageMin != null ? Number(c.ageMin) : (c.minAge != null ? Number(c.minAge) : null)
      const ageMax = c.ageMax != null ? Number(c.ageMax) : (c.maxAge != null ? Number(c.maxAge) : null)
      const regularCandidate =
        c.regular_price != null ? num_(c.regular_price)
          : (c.regularPrice != null ? num_(c.regularPrice)
            : (c.original_price != null ? num_(c.original_price)
              : (c.originalPrice != null ? num_(c.originalPrice)
                : (c.base_price != null ? num_(c.base_price)
                  : (c.basePrice != null ? num_(c.basePrice)
                    : (c.price_before_discount != null ? num_(c.price_before_discount)
                      : (c.priceBeforeDiscount != null ? num_(c.priceBeforeDiscount)
                        : (c.strike_price != null ? num_(c.strike_price)
                          : (c.strikePrice != null ? num_(c.strikePrice) : null)))))))))
      const saleCandidate =
        c.sale_price != null ? num_(c.sale_price)
          : (c.salePrice != null ? num_(c.salePrice)
            : (c.discount_price != null ? num_(c.discount_price)
              : (c.discountPrice != null ? num_(c.discountPrice)
                : (c.current_price != null ? num_(c.current_price)
                  : (c.currentPrice != null ? num_(c.currentPrice)
                    : (c.final_price != null ? num_(c.final_price)
                      : (c.finalPrice != null ? num_(c.finalPrice)
                        : (c.price_after_discount != null ? num_(c.price_after_discount)
                          : (c.priceAfterDiscount != null ? num_(c.priceAfterDiscount) : null)))))))))
      const rawPrice = c.price != null ? num_(c.price) : null
      let p = regularCandidate != null ? regularCandidate : (rawPrice != null ? rawPrice : null)
      let sp = saleCandidate
      if (p != null && sp != null && sp >= p) sp = null
      if (!label || !(p != null || sp != null)) continue
      outCats.push({
        label,
        age_min: isFinite(ageMin) ? ageMin : null,
        age_max: isFinite(ageMax) ? ageMax : null,
        currency: cur || '',
        regular_price: p != null ? p : null,
        sale_price: sp != null ? sp : null
      })
    }
    return outCats
  }

  function collectCatsDeep_(root, depthLimit) {
    const lim = (typeof depthLimit === 'number' && isFinite(depthLimit)) ? Math.max(1, Math.min(7, Math.floor(depthLimit))) : 4
    const out = []
    const seenCat = new Set()
    const stack2 = [{ v: root, d: 0 }]
    let guard2 = 0
    while (stack2.length && guard2 < 1500) {
      guard2++
      const { v, d } = stack2.pop()
      if (!v || typeof v !== 'object') continue
      const cats = collectCats_(v)
      if (cats && cats.length) {
        for (const c of cats) {
          const key = String(c.label || '') + '|' + String(c.currency || '') + '|' + String(c.regular_price != null ? c.regular_price : '') + '|' + String(c.sale_price != null ? c.sale_price : '')
          if (seenCat.has(key)) continue
          seenCat.add(key)
          out.push(c)
        }
      }
      if (d >= lim) continue
      if (Array.isArray(v)) {
        for (const it of v) stack2.push({ v: it, d: d + 1 })
        continue
      }
      for (const k of Object.keys(v)) {
        const child = v[k]
        if (child && typeof child === 'object') stack2.push({ v: child, d: d + 1 })
      }
    }
    return out
  }

  while (stack.length && guard < 4500) {
    guard++
    const x = stack.pop()
    if (!x) continue
    if (typeof x !== 'object') continue

    const title = pickOptTitle_(x)
    let cats = collectCats_(x)
    if (title && (!cats || !cats.length)) cats = collectCatsDeep_(x, 5)
    if (title && cats.length) {
      const oid = pickOptId_(x)
      const key = (oid ? ('id:' + oid) : ('t:' + title.toLowerCase()))
      if (!seen.has(key)) {
        seen.add(key)
        out.push({
          option_id: oid,
          option_title: title,
          categories: cats
        })
      }
    }

    if (Array.isArray(x)) {
      for (const it of x) stack.push(it)
      continue
    }

    for (const k of Object.keys(x)) {
      const v = x[k]
      if (!v) continue
      if (typeof v === 'object') stack.push(v)
    }
  }

  return out
}

function convEnf_collectGygOptionTitlesFromJson_(obj) {
  const out = []
  const seen = new Set()
  const stack = [{ v: obj, d: 0 }]
  let guard = 0

  function norm_(s) {
    return String(s || '').replace(/\s+/g, ' ').trim()
  }

  function looksLikeOptionTitle_(s) {
    const t = norm_(s)
    if (!t) return false
    if (t.length < 10 || t.length > 140) return false
    const lc = t.toLowerCase()
    if (lc.includes('getyourguide')) return false
    if (!lc.includes('tour') && !lc.includes('tickets') && !lc.includes('ticket') && !lc.includes('private') && !lc.includes('shared')) return false
    if (!lc.includes('private') && !lc.includes('shared') && !lc.includes('tickets') && !lc.includes('ticket') && !lc.includes('entry')) return false
    if (!(lc.includes('entry') && lc.includes('ticket'))) return false
    return true
  }

  function consider_(s) {
    const t = norm_(s)
    if (!looksLikeOptionTitle_(t)) return
    const key = t.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(t)
  }

  while (stack.length && guard < 7000) {
    guard++
    const cur = stack.pop()
    const v = cur ? cur.v : null
    const d = cur ? cur.d : 0
    if (!v) continue

    if (typeof v === 'string') {
      consider_(v)
      continue
    }
    if (typeof v !== 'object') continue

    if (Array.isArray(v)) {
      if (d < 7) for (const it of v) stack.push({ v: it, d: d + 1 })
      continue
    }

    for (const k of Object.keys(v)) {
      const vv = v[k]
      if (vv == null) continue
      const kk = String(k || '').toLowerCase()
      if (typeof vv === 'string') {
        if (kk.includes('title') || kk.includes('name') || kk.includes('label') || kk.includes('option')) consider_(vv)
        continue
      }
      if (typeof vv === 'object' && d < 7) stack.push({ v: vv, d: d + 1 })
    }
  }

  return out
}

async function convEnf_playwrightExtractGygOptions_(pageUrl) {
  const u = String(pageUrl || '').trim()
  if (!u) return []
  let chromium = null
  try {
    chromium = require('playwright').chromium
  } catch {
    return []
  }
  if (!chromium) return []

  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
    })
    const collected = []
    const seenUrls = new Set()
    const debug = String(process.env.GYG_OPTIONS_DEBUG || '').trim() === '1'
    const collectedMeta = []
    let clickedAvailability = false
    let debugBlocksSnippet = ''

    page.on('response', async (resp) => {
      try {
        const ct = String(resp.headers()['content-type'] || '')
        if (ct.indexOf('application/json') === -1) return
        const ru = String(resp.url() || '')
        if (!ru) return
        if (seenUrls.has(ru)) return
        seenUrls.add(ru)
        const body = await resp.json()
        if (!body || typeof body !== 'object') return
        collected.push(body)
        if (debug && collectedMeta.length < 50) {
          collectedMeta.push({ url: ru.slice(0, 160), keys: Object.keys(body).slice(0, 14) })
        }
        if (debug && !debugBlocksSnippet && ru.includes('activity-details-page/blocks')) {
          try {
            const s = JSON.stringify(body)
            debugBlocksSnippet = s.slice(0, 2200)
          } catch {
          }
        }
        if (collected.length > 60) return
      } catch {
      }
    })

    await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await page.waitForTimeout(4_000)
    try {
      const accept = page.getByRole('button', { name: /accept|agree|allow all/i })
      if (await accept.first().isVisible({ timeout: 1200 })) await accept.first().click({ timeout: 2500 })
    } catch {
    }
    try {
      const uc1 = page.locator('#uc-btn-accept-banner')
      if (await uc1.isVisible({ timeout: 800 })) await uc1.click({ timeout: 2000 })
    } catch {
    }
    try {
      const uc2 = page.locator('button[data-testid*="accept" i], button[id*="accept" i]')
      if (await uc2.first().isVisible({ timeout: 800 })) await uc2.first().click({ timeout: 2000 })
    } catch {
    }

    async function tryClickAvailabilityOnce_() {
      const locs = [
        page.getByRole('button', { name: /check availability/i }),
        page.locator('button:has-text("Check availability")'),
        page.locator('a:has-text("Check availability")'),
        page.locator('text=/check availability/i')
      ]
      for (const loc of locs) {
        try {
          const el = loc.first()
          if (!(await el.isVisible({ timeout: 800 }))) continue
          try { await el.scrollIntoViewIfNeeded({ timeout: 1500 }) } catch {
          }
          await el.click({ timeout: 6000 })
          return true
        } catch {
        }
      }
      return false
    }

    for (const y of [0, 600, 1200, 1800, 2400, 3200]) {
      if (clickedAvailability) break
      try { await page.evaluate((yy) => window.scrollTo(0, yy), y) } catch {
      }
      try { await page.waitForTimeout(900) } catch {
      }
      try {
        const ok = await tryClickAvailabilityOnce_()
        if (ok) clickedAvailability = true
      } catch {
      }
    }
    if (clickedAvailability) {
      try { await page.waitForLoadState('networkidle', { timeout: 15_000 }) } catch {
      }
      await page.waitForTimeout(10_000)
    }

    async function readSidebarMoney_() {
      try {
        const aside = page.locator('aside').first()
        let asideText = ''
        try { asideText = await aside.innerText({ timeout: 1500 }) } catch {
        }
        if (!asideText) {
          try {
            asideText = await page.evaluate(() => (document && document.body && document.body.innerText) ? document.body.innerText : '')
          } catch {
          }
        }
        const ms2p = convEnf_extractFromPerPersonPrice_(asideText)
        if (ms2p && (ms2p.regular != null || ms2p.sale != null)) return ms2p
        const ms2 = convEnf_extractRegularSaleFromText_(asideText)
        if (ms2 && (ms2.regular != null || ms2.sale != null)) return ms2
      } catch {
      }
      return null
    }

    async function extractOptionsFromDom_(defaultSidebarMs) {
      const domText = await page.evaluate(() => (document && document.body && document.body.innerText) ? document.body.innerText : '')
      const lines = String(domText || '').split(/\r?\n/).map((x) => String(x || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
      const titles = []
      const seen = new Set()
      for (const line of lines) {
        const lc = line.toLowerCase()
        if (!lc.startsWith('shared') && !lc.startsWith('private')) continue
        if (!lc.includes('tour')) continue
        if (!(lc.includes('entry') && lc.includes('ticket'))) continue
        if (lc.includes('getyourguide')) continue
        if (line.length < 10 || line.length > 160) continue
        const key = lc
        if (seen.has(key)) continue
        seen.add(key)
        titles.push(line)
        if (titles.length >= 6) break
      }
      if (!titles.length) return []

      titles.sort((a, b) => {
        const la = String(a || '').toLowerCase()
        const lb = String(b || '').toLowerCase()
        const wa = la.startsWith('shared ') ? 0 : (la.startsWith('private ') ? 1 : 2)
        const wb = lb.startsWith('shared ') ? 0 : (lb.startsWith('private ') ? 1 : 2)
        if (wa !== wb) return wa - wb
        return la.localeCompare(lb)
      })

      const out = []
      for (const title of titles) {
        try {
          async function clickOption_() {
            const sel = JSON.stringify(title)
            const locs = [
              page.locator(`label:has-text(${sel})`),
              page.locator(`[role=\"radio\"]:has-text(${sel})`),
              page.locator(`button:has-text(${sel})`),
              page.locator(`text=${sel}`)
            ]
            for (const loc of locs) {
              try {
                const el = loc.first()
                if (!(await el.isVisible({ timeout: 700 }))) continue
                try { await el.scrollIntoViewIfNeeded({ timeout: 1500 }) } catch {
                }
                await el.click({ timeout: 6000 })
                return true
              } catch {
              }
            }
            return false
          }
          let ms = null
          const lcTitle = String(title || '').toLowerCase()
          if (lcTitle.startsWith('shared ') && defaultSidebarMs) {
            ms = defaultSidebarMs
          } else {
            const beforeMs = defaultSidebarMs || await readSidebarMoney_()
            await clickOption_()
            try { await page.waitForLoadState('networkidle', { timeout: 10_000 }) } catch {
            }
            await page.waitForTimeout(1400)
            ms = await readSidebarMoney_()
            if (!ms || (beforeMs && ms && ms.regular === beforeMs.regular && ms.sale === beforeMs.sale)) {
              await clickOption_()
              await page.waitForTimeout(1200)
              ms = await readSidebarMoney_()
            }
          }

          let cardText = ''
          try {
            cardText = await page.evaluate((t) => {
              function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim() }
              const target = norm(t)
              if (!target) return ''
              const nodes = document.querySelectorAll('label, button, div, span, h1, h2, h3, h4, p')
              let el = null
              for (const n of nodes) {
                const tx = norm(n.textContent)
                if (!tx) continue
                if (tx === target) { el = n; break }
              }
              if (!el) {
                for (const n of nodes) {
                  const tx = norm(n.textContent)
                  if (!tx) continue
                  if (tx.includes(target)) { el = n; break }
                }
              }
              if (!el) return ''
              let c = el.closest('label') || el.closest('[role=\"radio\"]') || el.closest('[data-testid]') || el.parentElement
              let hops = 0
              while (c && hops < 4) {
                const tx = norm(c.textContent)
                if (tx && tx.length <= 1800) return tx
                c = c.parentElement
                hops++
              }
              return norm(el.parentElement ? el.parentElement.textContent : el.textContent)
            }, title)
          } catch {
          }

          const cats = []
          try {
            const agePrices = convEnf_extractGygAgePricesFromText_(cardText)
            agePrices.forEach((x) => {
              let cur = String(x.currency || '').trim()
              if (cur === '€') cur = 'EUR'
              else if (cur === '$') cur = 'USD'
              else if (cur === '£') cur = 'GBP'
              cats.push({
                label: x.label,
                currency: cur || '',
                regular_price: x.price != null ? x.price : null,
                sale_price: null,
                age_min: x.age_min,
                age_max: x.age_max
              })
            })
          } catch {
          }

          out.push({
            option_id: '',
            option_title: title,
            currency: ms && ms.currency ? ms.currency : '',
            regular_price: (ms && ms.regular != null) ? ms.regular : null,
            sale_price: (ms && ms.sale != null) ? ms.sale : null,
            categories: cats
          })
        } catch {
        }
      }
      return out
    }

    try {
      const defaultSidebarMs = await readSidebarMoney_()
      const domOptions = await extractOptionsFromDom_(defaultSidebarMs)
      const hasShared = domOptions.some((x) => String(x && x.option_title ? x.option_title : '').toLowerCase().startsWith('shared '))
      const hasPrivate = domOptions.some((x) => String(x && x.option_title ? x.option_title : '').toLowerCase().startsWith('private '))
      if (domOptions.length && (hasShared || hasPrivate)) {
        if (debug) {
          log('GYG PW debug: dom_options=' + JSON.stringify(domOptions.map((x) => ({ t: x.option_title, rp: x.regular_price, sp: x.sale_price, cats: (x.categories || []).length }))))
        }
        return domOptions.slice(0, 6)
      }
    } catch {
    }

    let sidebarMs = null
    try {
      const aside = page.locator('aside').first()
      let asideText = ''
      try {
        asideText = await aside.innerText({ timeout: 1500 })
      } catch {
      }
      if (!asideText) {
        try {
          asideText = await page.evaluate(() => (document && document.body && document.body.innerText) ? document.body.innerText : '')
        } catch {
        }
      }
      const ms2 = convEnf_extractRegularSaleFromText_(asideText)
      if (ms2 && (ms2.regular != null || ms2.sale != null)) sidebarMs = ms2
    } catch {
    }

    const out = []
    for (const obj of collected) {
      const items = convEnf_collectGygOptionsFromJson_(obj)
      for (const it of items) out.push(it)
      if (out.length >= 6) break
    }

    if (!out.length) {
      try {
        const domText = await page.evaluate(() => (document && document.body && document.body.innerText) ? document.body.innerText : '')
        const lines = String(domText || '').split(/\r?\n/).map((x) => String(x || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
        const domOpts = []
        const seenDom = new Set()
        for (let i = 0; i < lines.length && domOpts.length < 6; i++) {
          const line = lines[i]
          const lc = line.toLowerCase()
          if (lc.startsWith('this option')) continue
          if (!lc.startsWith('shared') && !lc.startsWith('private')) continue
          if (!lc.includes('tour')) continue
          if (!lc.includes('ticket') && !lc.includes('entry')) continue
          if (!lc.includes('shared') && !lc.includes('private') && !lc.includes('entry')) continue
          if (lc.includes('getyourguide')) continue
          if (line.length < 10 || line.length > 160) continue
          const key = lc
          if (seenDom.has(key)) continue
          seenDom.add(key)
          const ctx = lines.slice(Math.max(0, i - 3), i + 8).join(' ')
          let ms = convEnf_extractRegularSaleFromText_(ctx)
          if ((!ms || (ms.regular == null && ms.sale == null)) && sidebarMs) ms = sidebarMs
          const cur = ms && ms.currency ? ms.currency : ''
          const cats = []
          if (ms && (ms.regular != null || ms.sale != null)) {
            cats.push({
              label: 'Adult',
              currency: cur,
              regular_price: ms.regular != null ? ms.regular : null,
              sale_price: ms.sale != null ? ms.sale : null,
              age_min: null,
              age_max: null
            })
          }
          domOpts.push({ option_id: '', option_title: line, categories: cats })
        }
        if (domOpts.length) {
          if (debug) log('GYG PW debug: dom_options=' + JSON.stringify(domOpts.map((x) => x.option_title)))
          return domOpts
        }
      } catch {
      }

      const titles = []
      for (const obj of collected) {
        const ts = convEnf_collectGygOptionTitlesFromJson_(obj)
        for (const t of ts) titles.push(t)
        if (titles.length >= 8) break
      }
      const dedupTitles = []
      const seenT = new Set()
      for (const t of titles) {
        const key = String(t || '').toLowerCase()
        if (!key) continue
        if (seenT.has(key)) continue
        seenT.add(key)
        if ((key.startsWith('shared') || key.startsWith('private')) && key.includes('entry') && key.includes('ticket')) dedupTitles.push(t)
        if (dedupTitles.length >= 6) break
      }
      if (debug) log('GYG PW debug: option_titles_fallback=' + JSON.stringify(dedupTitles))
      if (!dedupTitles.length) return []
      const catsFromSidebar = []
      if (sidebarMs && (sidebarMs.regular != null || sidebarMs.sale != null)) {
        catsFromSidebar.push({
          label: 'Adult',
          currency: sidebarMs.currency || '',
          regular_price: sidebarMs.regular != null ? sidebarMs.regular : null,
          sale_price: sidebarMs.sale != null ? sidebarMs.sale : null,
          age_min: null,
          age_max: null
        })
      }
      return dedupTitles.map((t) => ({
        option_id: '',
        option_title: t,
        currency: sidebarMs && sidebarMs.currency ? sidebarMs.currency : '',
        regular_price: sidebarMs && sidebarMs.regular != null ? sidebarMs.regular : null,
        sale_price: sidebarMs && sidebarMs.sale != null ? sidebarMs.sale : null,
        categories: catsFromSidebar
      }))
    }

    if (debug) {
      log('GYG PW debug: clicked_check_availability=' + String(clickedAvailability))
      log('GYG PW debug: json_responses=' + String(collected.length) + ' meta=' + JSON.stringify(collectedMeta))
      if (debugBlocksSnippet) log('GYG PW debug: blocks_snippet=' + debugBlocksSnippet)
      log('GYG PW debug: options_found=' + String(out.length))
    }

    const dedup = []
    const seen = new Set()
    for (const it of out) {
      const key = String(it.option_id || '').trim() || String(it.option_title || '').toLowerCase()
      if (!key) continue
      if (seen.has(key)) continue
      seen.add(key)
      dedup.push(it)
      if (dedup.length >= 6) break
    }
    return dedup
  } finally {
    try { await browser.close() } catch {
    }
  }
}

function convEnf_extractGygOptionsFromScrape_(url, title, scrape) {
  const u = String(url || '').trim()
  const t = String(title || '').replace(/\s+/g, ' ').trim()
  const raw = scrape && typeof scrape === 'object' ? scrape.raw : null
  const text = scrape && typeof scrape === 'object' ? String(scrape.text || '') : ''

  const categories = []
  const agePrices = convEnf_extractGygAgePricesFromText_(text)
  agePrices.forEach((x) => {
    const c = {
      label: x.label,
      regular_price: x.price != null ? x.price : null,
      sale_price: null,
      min_pax: 1,
      max_pax: 100,
      pricing_type: 'per-person',
      currency: x.currency || '',
      age_min: x.age_min,
      age_max: x.age_max,
      source_url: u
    }
    categories.push(c)
  })

  let currency = ''
  let minPrice = null
  let salePrice = null
  const jsonlds = convEnf_extractJsonLd_(raw)
  const offers = convEnf_collectOffersFromJsonLd_(jsonlds)
  for (const o of offers) {
    if (o.currency && !currency) currency = o.currency
    if (o.price != null && isFinite(o.price)) {
      if (minPrice == null || o.price < minPrice) minPrice = o.price
    }
  }

  if (!currency || minPrice == null) {
    const m2 = convEnf_extractFromPrice_(text.slice(0, 12000))
    if (m2) {
      if (!currency && m2.currency) currency = m2.currency
      if (minPrice == null && m2.amount != null) minPrice = m2.amount
    }
  }

  if (!currency || minPrice == null || salePrice == null) {
    const ms = convEnf_extractRegularSaleFromText_(text)
    if (!currency && ms.currency) currency = ms.currency
    if (minPrice == null && ms.regular != null) minPrice = ms.regular
    if (salePrice == null && ms.sale != null) salePrice = ms.sale
  }

  if (!currency || minPrice == null) {
    const m = convEnf_parseMoney_(text.slice(0, 3000))
    if (m) {
      if (!currency && m.currency) currency = m.currency
      if (minPrice == null && m.amount != null) minPrice = m.amount
    }
  }

  const optionTitle = t ? t : 'GetYourGuide option'
  const pkgId = 'GYG-' + convEnf_hash8_(u)

  return {
    package: {
      PackageID: pkgId,
      PackageTitle: optionTitle,
      Currency: currency,
      RegularPrice: minPrice,
      SalePrice: salePrice,
      PricingCategories: categories,
      PackageLink: u,
      Status: 'Reference'
    },
    categories
  }
}

async function convEnf_fetchGygOptionsIntel_(tripFields) {
  const apiKey = String((config && config.SERPER_API_KEY) || process.env.SERPER_API_KEY || '').trim()
  if (!apiKey) return null

  const title = (tripFields && tripFields.Title) ? String(tripFields.Title).replace(/\s+/g, ' ').trim() : ''
  const slug = (tripFields && tripFields.Slug) ? String(tripFields.Slug).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() : ''
  const seed = title || slug
  if (!seed) return null

  const q = convEnf_buildExternalQuery_(seed)
  const sr = await convEnf_serperSearchFull_(q, apiKey)
  const results = sr && Array.isArray(sr.results) ? sr.results : []
  const picked = convEnf_pickCompetitorResults_(results, 4)
  if (!picked.length) return null

  function pad2_(n) {
    const x = String(n == null ? '' : n)
    return x.length >= 2 ? x : ('0' + x)
  }

  function formatYmdLocal_(d) {
    const dt = d instanceof Date ? d : new Date(d)
    if (!(dt instanceof Date) || !isFinite(dt.getTime())) return ''
    return `${dt.getFullYear()}-${pad2_(dt.getMonth() + 1)}-${pad2_(dt.getDate())}`
  }

  function resolveGygDateFrom_() {
    const raw = String(process.env.GYG_DATE_FROM || '').trim()
    if (!raw) return ''
    const lc = raw.toLowerCase()
    if (lc === 'tomorrow' || lc === '+1') {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      return formatYmdLocal_(d)
    }
    if (lc === 'today' || lc === 'now' || lc === '0' || lc === '+0') return formatYmdLocal_(new Date())
    return raw
  }

  const packages = []
  const sources = []
  const dateFrom = resolveGygDateFrom_()
  const pcs = convEnf_parseGygPcEnv_()
  const wantPwOptions =
    String(process.env.GYG_OPTIONS_PLAYWRIGHT || '').trim() === '1' ||
    String(process.env.PLAYWRIGHT_SCRAPE_ENABLED || '').trim() === '1'
  const currencyPref = String(process.env.GYG_CURRENCY || 'EUR').trim().toUpperCase()
  const pickRes = await convEnf_pickBestGygResultBySimilarity_(picked, seed, apiKey)
  const chosen = pickRes && pickRes.best ? pickRes.best : null
  if (!chosen || !chosen.url) return null

  let url = String(chosen.url || '').trim()
  if (dateFrom || pcs.length) {
    const params = {}
    if (dateFrom) params.date_from = dateFrom
    if (pcs.length) params._pc = pcs
    url = convEnf_appendQueryParams_(url, params)
  }
  url = convEnf_applyGygCurrencyToUrl_(url, currencyPref)
  sources.push(url)

  if (wantPwOptions) {
    try {
      const opts = await convEnf_playwrightExtractGygOptions_(url)
      if (opts && opts.length) {
        for (const o of opts) {
          const cats = Array.isArray(o.categories) ? o.categories : []
          let cur = String(o && o.currency ? o.currency : '').trim()
          if (!cur) {
            for (const c of cats) {
              if (c && c.currency) { cur = String(c.currency).trim(); break }
            }
          }
          if (!cur) cur = currencyPref
          const pid = 'GYGOPT-' + convEnf_hash8_(url + '|' + String(o.option_id || o.option_title || ''))
          const regularOut = (o && o.regular_price != null && isFinite(Number(o.regular_price))) ? Number(o.regular_price) : null
          const saleOut = (o && o.sale_price != null && isFinite(Number(o.sale_price))) ? Number(o.sale_price) : null
          packages.push({
            PackageID: pid,
            PackageTitle: String(o.option_title || chosen.title || '').trim(),
            Currency: cur,
            RegularPrice: regularOut,
            SalePrice: saleOut,
            PricingCategories: cats.map((c) => ({
              label: c.label,
              currency: c.currency || cur,
              regular_price: c.regular_price,
              sale_price: c.sale_price,
              age_min: c.age_min,
              age_max: c.age_max,
              source_url: url
            })),
            PackageLink: url,
            Status: 'Reference'
          })
          if (packages.length >= 3) break
        }
      }
    } catch {
    }
  }

  if (!packages.length) {
    const scr = await convEnf_serperScrapeFull_(url, apiKey)
    const extracted = convEnf_extractGygOptionsFromScrape_(url, chosen.title || '', scr)
    if (extracted && extracted.package) packages.push(extracted.package)
  }

  if (!packages.length) return null

  const lines = []
  lines.push('seed: ' + seed)
  if (pickRes && Array.isArray(pickRes.scored) && pickRes.scored.length) {
    lines.push('candidates (score):')
    pickRes.scored.slice(0, 6).forEach((x) => {
      const sc = Number.isFinite(Number(x.score)) ? Number(x.score).toFixed(4) : '0.0000'
      lines.push(`- ${sc} ${x.url}`)
    })
  }
  lines.push('selected:')
  lines.push('- ' + sources[0])
  lines.push('options:')
  packages.forEach((p) => {
    const cats = Array.isArray(p.PricingCategories) ? p.PricingCategories : []
    const catParts = cats.slice(0, 6).map((c) => {
      const ar = (c.age_min != null || c.age_max != null) ? (` ages ${c.age_min != null ? c.age_min : '?'}-${c.age_max != null ? c.age_max : '?'}`) : ''
      const pr = (c.regular_price != null) ? (` ${c.currency || ''}${c.currency && c.currency.length === 1 ? '' : ' '}${c.regular_price}`) : ''
      return `${c.label}${ar}${pr}`.trim()
    }).filter(Boolean)
    const headPrice = (p.RegularPrice != null) ? (`from ${p.Currency || ''}${p.Currency && p.Currency.length === 1 ? '' : ' '}${p.RegularPrice}`) : ''
    lines.push(`- ${String(p.PackageTitle || '').slice(0, 120)}${headPrice ? (' (' + headPrice + ')') : ''}${catParts.length ? (' | ' + catParts.join(' | ')) : ''}`)
  })

  return { sources, packages, summary: lines.join('\n') }
}

async function convEnf_writeGygReferenceOptionsToAirtable_(tripId, tripNumber, intel, nowIso) {
  const pkgs = intel && Array.isArray(intel.packages) ? intel.packages : []
  if (!pkgs.length) return

  const tripLink = String(tripNumber || tripId || '').trim()
  if (!tripLink) return

  const resPkg = await airtableGet_('Packages', { filterByFormula: "FIND('" + convEnf_escapeFormulaString_(tripLink) + "', ARRAYJOIN({Trip}))", pageSize: 100 })
  const existingPkgs = resPkg && resPkg.records ? resPkg.records : []
  const toDeletePkg = []
  const pkgIdsToDelete = new Set()
  existingPkgs.forEach((r) => {
    const f = r && r.fields ? r.fields : {}
    const st = String(f.Status || '').toLowerCase().trim()
    const link = String(f.PackageLink || '').toLowerCase()
    const pid = String(f.PackageID || '').trim()
    if (st === 'reference' && (link.includes('getyourguide.com') || /^(FTS-GYG-|FTS-GYGOPT-|GYG-|GYGOPT-)/i.test(pid))) {
      toDeletePkg.push(r.id)
      if (pid) pkgIdsToDelete.add(pid)
      pkgIdsToDelete.add(r.id)
    }
  })

  const resPrice = await airtableGet_('Prices', { filterByFormula: "FIND('" + convEnf_escapeFormulaString_(tripLink) + "', ARRAYJOIN({Trip}))", pageSize: 100 })
  const existingPrices = resPrice && resPrice.records ? resPrice.records : []
  const toDeletePrice = []
  existingPrices.forEach((r) => {
    const f = r && r.fields ? r.fields : {}
    const pidRaw = f.PackageID
    const pid = (Array.isArray(pidRaw) && pidRaw.length) ? String(pidRaw[0] || '').trim() : String(pidRaw || '').trim()
    if (pid && pkgIdsToDelete.has(pid)) toDeletePrice.push(r.id)
  })

  if (toDeletePrice.length) await airtableBatchDelete_('Prices', toDeletePrice)
  if (toDeletePkg.length) await airtableBatchDelete_('Packages', toDeletePkg)

  const pkgFieldsArray = []
  const priceFieldsArray = []

  for (let i = 0; i < pkgs.length; i++) {
    const p = pkgs[i] || {}
    const pid = String(p.PackageID || '').trim()
    const pt = String(p.PackageTitle || '').trim()
    if (!pid || !pt) continue
    const currency = String(p.Currency || '').trim()
    const cats = Array.isArray(p.PricingCategories) ? p.PricingCategories : []
    const internalLink = convEnf_buildTripPackagesLink_(pt)

    pkgFieldsArray.push({
      Trip: [tripId],
      PackageID: pid,
      PackageTitle: pt,
      Currency: currency,
      RegularPrice: (p.RegularPrice != null && isFinite(Number(p.RegularPrice))) ? Number(p.RegularPrice) : null,
      SalePrice: (p.SalePrice != null && isFinite(Number(p.SalePrice))) ? Number(p.SalePrice) : null,
      PricingCategories: '',
      PackageLink: internalLink,
      Status: 'Reference'
    })

    cats.forEach((c) => {
      const label = String(c && c.label ? c.label : '').trim()
      if (!label) return
      const catId = convEnf_categoryIdFromLabel_(label)
      const rp = (c && c.regular_price != null && isFinite(Number(c.regular_price))) ? Number(c.regular_price) : null
      const spRaw = (c && c.sale_price != null && isFinite(Number(c.sale_price))) ? Number(c.sale_price) : null
      const sp = convEnf_inferSalePrice10_(rp, spRaw)
      priceFieldsArray.push({
        Trip: [tripId],
        PackageID: pid,
        CategoryID: catId,
        Label: label,
        RegularPrice: rp,
        SalePrice: sp,
        Currency: String(c && c.currency ? c.currency : currency).trim(),
        MinPax: 1,
        MaxPax: 100,
        PricingType: 'per-person',
        GroupPricing: ''
      })
    })
  }

  if (pkgFieldsArray.length) await airtableBatchCreate_('Packages', pkgFieldsArray)
  if (priceFieldsArray.length) await airtableBatchCreate_('Prices', priceFieldsArray)

  log('✅ Wrote GYG reference options to Airtable: Packages=' + pkgFieldsArray.length + ' Prices=' + priceFieldsArray.length)
}

function convEnf_normOptionTitle_(s) {
  const t = String(s || '')
    .replace(/\|?\s*getyourguide\s*$/ig, '')
    .replace(/\s+/g, ' ')
    .trim()
  return t.toLowerCase()
}

function convEnf_isGygDerivedPackageId_(pid) {
  const s = String(pid || '').trim().toUpperCase()
  return s.startsWith('FTS-GYG-') || s.startsWith('GYG-') || s.startsWith('GYGOPT-') || s.startsWith('FTS-GYGOPT-')
}

async function convEnf_writeMissingGygOptionsDraftToAirtable_(tripId, tripNumber, intel, nowIso) {
  const pkgs = intel && Array.isArray(intel.packages) ? intel.packages : []
  if (!pkgs.length) return

  const tripLink = String(tripNumber || tripId || '').trim()
  if (!tripLink) return

  const maxDraft = Math.max(1, Math.min(6, Number(process.env.GYG_OPTIONS_DRAFT_MAX || 2) || 2))

  const resPkg = await airtableGet_('Packages', { filterByFormula: "FIND('" + convEnf_escapeFormulaString_(tripLink) + "', ARRAYJOIN({Trip}))", pageSize: 100 })
  const existingPkgs = resPkg && resPkg.records ? resPkg.records : []

  const existingActiveTitle = new Set()
  const existingActiveLink = new Set()
  const draftToDelete = []
  const draftPkgIdsToDelete = new Set()

  existingPkgs.forEach((r) => {
    const f = r && r.fields ? r.fields : {}
    const st = String(f.Status || '').toLowerCase().trim()
    const link = String(f.PackageLink || '').trim()
    const pid = String(f.PackageID || '').trim()
    const title = String(f.PackageTitle || f.PackageName || '').trim()

    if (st === 'draft' && link.toLowerCase().includes('getyourguide.com')) {
      draftToDelete.push(r.id)
      if (pid) draftPkgIdsToDelete.add(pid)
      draftPkgIdsToDelete.add(r.id)
      return
    }

    if (!st || (st !== 'reference' && st !== 'competitor' && st !== 'draft' && st !== 'proposed')) {
      if (title) existingActiveTitle.add(convEnf_normOptionTitle_(title))
      if (link) existingActiveLink.add(link.toLowerCase())
    }
  })

  const resPrice = await airtableGet_('Prices', { filterByFormula: "FIND('" + convEnf_escapeFormulaString_(tripLink) + "', ARRAYJOIN({Trip}))", pageSize: 100 })
  const existingPrices = resPrice && resPrice.records ? resPrice.records : []
  const pricesToDelete = []
  existingPrices.forEach((r) => {
    const f = r && r.fields ? r.fields : {}
    const pidRaw = f.PackageID
    const pid = (Array.isArray(pidRaw) && pidRaw.length) ? String(pidRaw[0] || '').trim() : String(pidRaw || '').trim()
    if (pid && (draftPkgIdsToDelete.has(pid) || convEnf_isGygDerivedPackageId_(pid))) pricesToDelete.push(r.id)
  })

  if (pricesToDelete.length) await airtableBatchDelete_('Prices', pricesToDelete)
  if (draftToDelete.length) await airtableBatchDelete_('Packages', draftToDelete)

  const pkgFieldsArray = []
  const priceFieldsArray = []

  for (let i = 0; i < pkgs.length && pkgFieldsArray.length < maxDraft; i++) {
    const p = pkgs[i] || {}
    const sourceLink = String(p.PackageLink || '').trim()
    const normTitle = convEnf_normOptionTitle_(p.PackageTitle || '')
    if (!normTitle) continue
    if (sourceLink && existingActiveLink.has(sourceLink.toLowerCase())) continue
    if (existingActiveTitle.has(normTitle)) continue

    const pid = 'FTS-GYGOPT-' + convEnf_hash8_(sourceLink + '|' + normTitle)
    const pt = String(p.PackageTitle || '').replace(/\s+/g, ' ').trim().slice(0, 180)
    const currency = String(p.Currency || '').trim()
    const minPrice = (p.RegularPrice != null && isFinite(Number(p.RegularPrice))) ? Number(p.RegularPrice) : null
    const salePrice = (p.SalePrice != null && isFinite(Number(p.SalePrice))) ? Number(p.SalePrice) : null
    const internalLink = convEnf_buildTripPackagesLink_(pt)

    const cats = Array.isArray(p.PricingCategories) ? p.PricingCategories : []
    const catsForPkg = cats && cats.length ? cats : []

    pkgFieldsArray.push({
      Trip: [tripId],
      PackageID: pid,
      PackageTitle: pt,
      Currency: currency,
      RegularPrice: minPrice,
      SalePrice: salePrice,
      PricingCategories: '',
      PackageLink: internalLink,
      Status: 'Draft'
    })

    if (catsForPkg.length) {
      catsForPkg.forEach((c) => {
        const label = String(c && c.label ? c.label : '').trim()
        if (!label) return
        const cur2 = String(c && c.currency ? c.currency : currency).trim()
        const rp = (c && c.regular_price != null && isFinite(Number(c.regular_price))) ? Number(c.regular_price) : null
        const sp = (c && c.sale_price != null && isFinite(Number(c.sale_price))) ? Number(c.sale_price) : null
        const catId = convEnf_categoryIdFromLabel_(label)
        priceFieldsArray.push({
          Trip: [tripId],
          PackageID: pid,
          CategoryID: catId,
          Label: label,
          RegularPrice: rp,
          SalePrice: convEnf_inferSalePrice10_(rp, sp),
          Currency: cur2,
          MinPax: 1,
          MaxPax: 100,
          PricingType: 'per-person',
          GroupPricing: ''
        })
      })
    } else if (minPrice != null) {
      const catId = convEnf_categoryIdFromLabel_('Adult')
      priceFieldsArray.push({
        Trip: [tripId],
        PackageID: pid,
        CategoryID: catId,
        Label: 'Adult',
        RegularPrice: minPrice,
        SalePrice: convEnf_inferSalePrice10_(minPrice, salePrice),
        Currency: currency,
        MinPax: 1,
        MaxPax: 100,
        PricingType: 'per-person',
        GroupPricing: ''
      })
    }
  }

  if (!pkgFieldsArray.length) {
    log('ℹ️ No missing GYG options detected to create as Draft packages')
    return
  }

  if (pkgFieldsArray.length) await airtableBatchCreate_('Packages', pkgFieldsArray)
  if (priceFieldsArray.length) await airtableBatchCreate_('Prices', priceFieldsArray)

  log('✅ Created Draft packages from GYG: Packages=' + pkgFieldsArray.length + ' Prices=' + priceFieldsArray.length + ' (review in Airtable before publishing)')
}

async function convEnf_playwrightScrape_(pageUrl) {
  const u = String(pageUrl || '').trim()
  if (!u) return { title: '', text: '', chars: 0 }
  let chromium = null
  try {
    chromium = require('playwright').chromium
  } catch {
    return { title: '', text: '', chars: 0 }
  }
  if (!chromium) return { title: '', text: '', chars: 0 }

  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
    })
    await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await page.waitForTimeout(3_000)
    const text = await page.evaluate(() => (document && document.body && document.body.innerText) ? document.body.innerText : '')
    const title = await page.title()
    const t = String(text || '')
    return { title: String(title || ''), text: t, chars: t.length }
  } finally {
    try {
      await browser.close()
    } catch {
    }
  }
}

async function convEnf_summarizeExternalBenchmarksToInsights_(tripSeed, pages, rawCtx) {
  const seed = String(tripSeed || '').replace(/\s+/g, ' ').trim()
  const ps = Array.isArray(pages) ? pages : []
  if (!seed || !ps.length) return ''

  const rawTruth = (rawCtx && rawCtx.truth) ? rawCtx.truth : {}
  const truthLine = JSON.stringify(rawTruth || {})

  const payload = {
    trip_seed: seed,
    truth: truthLine,
    pages: ps.map((p) => ({
      url: p.url,
      title: p.title,
      snippet: p.snippet,
      text: String(p.text || '').slice(0, 10000)
    }))
  }

  const prompt = [
    'You are a tourism competitor analyst. Return ONLY JSON.',
    '',
    'TASK:',
    '- Analyze the competitor pages content for structure, angles, trust signals, and decision-enabling details.',
    '- Produce high-level insights only. Do NOT copy or quote competitor text beyond 6 consecutive words.',
    "- Do NOT include competitor brand names in the output except inside a 'sources' array of URLs.",
    '- Output must be safe to use as writing guidance, not as copied content.',
    '',
    'IMPORTANT FACT CONSTRAINT:',
    '- Use the provided truth JSON to avoid suggesting inclusions that conflict with the product facts.',
    '',
    'INPUT JSON:',
    JSON.stringify(payload),
    '',
    'OUTPUT JSON SCHEMA:',
    JSON.stringify({
      angles: [''],
      section_structure: [''],
      trust_builders: [''],
      objection_handling_topics: [''],
      wording_guidelines: { do: [''], avoid: [''] }
    })
  ].join('\n')

  const ai = await callAi_(prompt)
  if (!ai || typeof ai !== 'object') return ''

  function list_(v, maxN) {
    const arr = Array.isArray(v) ? v : []
    const out = []
    for (const x of arr) {
      const t = String(x || '').replace(/\s+/g, ' ').trim()
      if (!t) continue
      out.push(t)
      if (typeof maxN === 'number' && out.length >= maxN) break
    }
    return out
  }

  const angles = list_(ai.angles, 8)
  const struct = list_(ai.section_structure, 10)
  const trust = list_(ai.trust_builders, 10)
  const obj = list_(ai.objection_handling_topics, 10)
  const doG = list_(ai.wording_guidelines && ai.wording_guidelines.do, 8)
  const avoidG = list_(ai.wording_guidelines && ai.wording_guidelines.avoid, 8)

  const blocks = []
  if (angles.length) blocks.push('Angles:\n- ' + angles.join('\n- '))
  if (struct.length) blocks.push('Structure:\n- ' + struct.join('\n- '))
  if (trust.length) blocks.push('Trust builders:\n- ' + trust.join('\n- '))
  if (obj.length) blocks.push('Objections to cover:\n- ' + obj.join('\n- '))
  if (doG.length || avoidG.length) {
    const wg = []
    if (doG.length) wg.push('Do:\n- ' + doG.join('\n- '))
    if (avoidG.length) wg.push('Avoid:\n- ' + avoidG.join('\n- '))
    blocks.push('Wording guidelines:\n' + wg.join('\n'))
  }
  return blocks.join('\n\n').trim()
}

async function convEnf_normalizeTripRecord_(data) {
  if (!data) return null
  let id = ''
  if (typeof data === 'object' && data.id) id = String(data.id || '').trim()
  if (!id) id = String(data || '').trim()
  if (!id) return null
  const res = await airtableGet_('Trips', { filterByFormula: "RECORD_ID() = '" + convEnf_escapeFormulaString_(id) + "'", maxRecords: 1 })
  if (!res || !res.records || !res.records.length) return null
  return res.records[0]
}

async function convEnf_fetchRecordsByTrip_(tableName, linkFieldName, tripRecordId, tripPublicId, maxOut) {
  const t = String(tableName || '')
  const lf = String(linkFieldName || 'Trip')
  const limit = Math.max(1, Number(maxOut || 100))

  const out = []

  const parts = []
  if (tripRecordId) parts.push("FIND('" + convEnf_escapeFormulaString_(tripRecordId) + "', ARRAYJOIN({" + lf + "}))")
  if (tripPublicId) parts.push("FIND('" + convEnf_escapeFormulaString_(tripPublicId) + "', ARRAYJOIN({" + lf + "}))")
  const formula = parts.length === 1 ? parts[0] : (parts.length ? ("OR(" + parts.join(', ') + ")") : '')

  if (formula) {
    let offset = null
    do {
      const params = { filterByFormula: formula, pageSize: 100 }
      if (offset) params.offset = offset
      const res = await airtableGet_(t, params)
      const recs = res && res.records ? res.records : []
      for (const r of recs) {
        out.push(r)
        if (out.length >= limit) break
      }
      if (out.length >= limit) break
      offset = res && res.offset ? res.offset : null
    } while (offset)
  }
  if (out.length) return out

  if (tripRecordId) {
    let offset2 = null
    do {
      const params2 = { pageSize: 100 }
      if (offset2) params2.offset = offset2
      const res2 = await airtableGet_(t, params2)
      const recs2 = res2 && res2.records ? res2.records : []
      for (const r2 of recs2) {
        const f2 = r2 && r2.fields ? r2.fields : {}
        const links = f2[lf]
        const hit = Array.isArray(links) ? links.indexOf(tripRecordId) !== -1 : String(links || '') === String(tripRecordId)
        if (!hit) continue
        out.push(r2)
        if (out.length >= limit) break
      }
      if (out.length >= limit) break
      offset2 = res2 && res2.offset ? res2.offset : null
    } while (offset2)
  }

  return out
}

async function convEnf_fetchMainImprovementRecord_(tripId, tripFields, tripNumber) {
  const linked = tripFields ? tripFields['Improvement With AI'] : null
  const directId = (Array.isArray(linked) && linked.length) ? String(linked[0] || '').trim() : ''
  if (directId) {
    const byId = await airtableGet_('Improvement With AI', { filterByFormula: "RECORD_ID() = '" + convEnf_escapeFormulaString_(directId) + "'", maxRecords: 1 })
    if (byId && byId.records && byId.records.length) return byId.records[0]
  }
  const recs = await convEnf_fetchRecordsByTrip_('Improvement With AI', 'Trip', tripId, tripNumber || '', 1)
  return recs && recs.length ? recs[0] : null
}

async function convEnf_fetchHighlights_(tripRecordId, tripPublicId) {
  const recs = await convEnf_fetchRecordsByTrip_('Highlights Improvement With AI', 'Trip', tripRecordId, tripPublicId || '', 1000)
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

async function convEnf_fetchItinerary_(tripRecordId, tripPublicId) {
  const recs = await convEnf_fetchRecordsByTrip_('Itinerary Improvement With AI', 'Trip', tripRecordId, tripPublicId || '', 1000)
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

async function convEnf_fetchIncExc_(tripRecordId, tripPublicId, tableName, textField) {
  const recs = await convEnf_fetchRecordsByTrip_(tableName, 'Trip', tripRecordId, tripPublicId || '', 1000)
  const items = []
  recs.forEach((r) => {
    const f = r.fields || {}
    const t = String(f[textField] || '').trim()
    if (t) items.push(t)
  })
  return { records: recs, items }
}

async function convEnf_fetchFaqs_(tripRecordId, tripPublicId) {
  const recs = await convEnf_fetchRecordsByTrip_('FAQs Improvement With AI', 'Trip', tripRecordId, tripPublicId || '', 1000)
  const faqs = []
  recs.forEach((r) => {
    const f = r.fields || {}
    const q = String(f.AI_Question || '').trim()
    const a = String(f.AI_Answer || '').trim()
    if (!q && !a) return
    faqs.push({ question: q, answer: a })
  })
  return { records: recs, faqs }
}

async function convEnf_fetchPackages_(tripRecordId, tripPublicId) {
  const recs = await convEnf_fetchRecordsByTrip_('Packages', 'Trip', tripRecordId, tripPublicId || '', 1000)
  const packages = []
  recs.forEach((r) => {
    const f = r.fields || {}
    packages.push({
      airtable_record_id: r.id,
      PackageID: String(f.PackageID || ''),
      PackageTitle: String(f.PackageTitle || f.PackageName || ''),
      RegularPrice: f.RegularPrice,
      SalePrice: f.SalePrice,
      Currency: String(f.Currency || ''),
      PricingCategories: String(f.PricingCategories || ''),
      GroupPricing: String(f.GroupPricing || ''),
      excerpt: String(f.excerpt || ''),
      content_html: String(f.content_html || '')
    })
  })
  return { records: recs, packages }
}

async function convEnf_replaceHighlights_(tripId, existingRecords, items, nowIso) {
  const recs = Array.isArray(existingRecords) ? existingRecords : []
  const ids = recs.map((r) => (r && r.id ? r.id : '')).filter(Boolean)
  if (ids.length) await airtableBatchDelete_('Highlights Improvement With AI', ids)
  log('Deleted old records: ' + ids.length)
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
  for (let i = 0; i < fieldsArray.length; i++) convEnf_logAirtableFields_('CREATE', 'Highlights Improvement With AI', '', fieldsArray[i])
  await airtableBatchCreate_('Highlights Improvement With AI', fieldsArray)
  log('Created new records: ' + fieldsArray.length)
}

async function convEnf_replaceItinerary_(tripId, existingRecords, steps, nowIso) {
  const recs = Array.isArray(existingRecords) ? existingRecords : []
  const ids = recs.map((r) => (r && r.id ? r.id : '')).filter(Boolean)
  if (ids.length) await airtableBatchDelete_('Itinerary Improvement With AI', ids)
  log('Deleted old records: ' + ids.length)
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
  for (let i = 0; i < fieldsArray.length; i++) convEnf_logAirtableFields_('CREATE', 'Itinerary Improvement With AI', '', fieldsArray[i])
  await airtableBatchCreate_('Itinerary Improvement With AI', fieldsArray)
  log('Created new records: ' + fieldsArray.length)
}

async function convEnf_replaceIncExc_(tripId, existingRecords, tableName, textField, items, nowIso) {
  const recs = Array.isArray(existingRecords) ? existingRecords : []
  const ids = recs.map((r) => (r && r.id ? r.id : '')).filter(Boolean)
  if (ids.length) await airtableBatchDelete_(tableName, ids)
  log('Deleted old records: ' + ids.length)
  const fieldsArray = []
  for (let i = 0; i < items.length; i++) {
    const t = String(items[i] || '').replace(/\s+/g, ' ').trim()
    if (!t) continue
    const f = { Trip: [tripId], AI_Status: 'Done', AI_LastUpdated: nowIso }
    f[textField] = t
    fieldsArray.push(f)
  }
  for (let i = 0; i < fieldsArray.length; i++) convEnf_logAirtableFields_('CREATE', tableName, '', fieldsArray[i])
  await airtableBatchCreate_(tableName, fieldsArray)
  log('Created new records: ' + fieldsArray.length)
}

async function convEnf_replaceFaqs_(tripId, existingRecords, faqs, nowIso) {
  const recs = Array.isArray(existingRecords) ? existingRecords : []
  const ids = recs.map((r) => (r && r.id ? r.id : '')).filter(Boolean)
  if (ids.length) await airtableBatchDelete_('FAQs Improvement With AI', ids)
  log('Deleted old records: ' + ids.length)
  const fieldsArray = []
  for (let i = 0; i < faqs.length; i++) {
    const f0 = faqs[i] || {}
    const q = String(f0.question || f0.q || '').replace(/\s+/g, ' ').trim()
    const a = String(f0.answer || f0.a || '').trim()
    if (!q || !a) continue
    fieldsArray.push({
      Trip: [tripId],
      AI_Question: q,
      AI_Answer: a,
      AI_Status: 'Done',
      AI_LastUpdated: nowIso
    })
  }
  for (let i = 0; i < fieldsArray.length; i++) convEnf_logAirtableFields_('CREATE', 'FAQs Improvement With AI', '', fieldsArray[i])
  await airtableBatchCreate_('FAQs Improvement With AI', fieldsArray)
  log('Created new records: ' + fieldsArray.length)
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

function convEnf_buildPrompt_(payload, standardContext) {
  const input = { trip_dossier: payload, standard_context: standardContext }
  const bench = (standardContext && standardContext.benchmark_insights) ? String(standardContext.benchmark_insights || '').trim() : ''
  return [
    "You are a tour product standardization and conversion copywriting enforcer. Return ONLY valid JSON.",
    "",
    "GOAL:",
    "- Treat the trip as one complete product dossier. Review ALL sections together to ensure consistency.",
    "- Make content consistently high-conversion like top OTA tour pages (benefit-led, decision-enabling).",
    "- Fix violations and weak sections by rewriting ONLY what needs rewriting.",
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
    "- Each step_description should end with one short benefit sentence (why it matters) without adding new facts.",
    "INCLUDED/EXCLUDED:",
    "- Rewrite into value-driven bullets (traveler benefit).",
    "- Separate optional items clearly as optional_items[].",
    "- Put core value items first (pickup/transport/guide/fees/meal), optional items last.",
    "FAQS:",
    "- Improve and rewrite FAQs to be customer-focused and decision-enabling.",
    "- Keep answers factual and based ONLY on the provided INPUT JSON.",
    "- Keep questions clear and specific; avoid generic fluff.",
    "- Do not repeat the same question in different wording.",
    "- NEVER contradict INCLUDED/EXCLUDED. If unsure, tell the user to check Included/Excluded.",
    "- NEVER mention activities or inclusions not present in the INPUT JSON (e.g., Nile boat ride) unless explicitly included.",
    "DESCRIPTION:",
    "- Persuasive narrative focused on experience and outcomes.",
    "- No headings; output HTML paragraphs only.",
    "- Include a short final paragraph covering who this tour is for (and who it may not suit), based ONLY on INPUT JSON.",
    "- Add 1 short paragraph to set expectations (pace, walking, and what to bring) ONLY if those details exist in INPUT JSON; otherwise omit.",
    "WHY PEOPLE LOVE:",
    "- Enforce emotional hooks, clear benefits, decision triggers.",
    "- 5-7 points, each as <p><strong>Title</strong> — ...</p> (HTML only).",
    "- Each point must be concrete and must not introduce new inclusions beyond INPUT JSON.",
    "BOLD PROMISE:",
    "- Write bold_promise.value as one short, benefit-driven sub-headline following: \"Enjoy [desire] without [pain], even if [objection]\".",
    "- Keep it specific and factual; do not add inclusions or logistics not supported by INPUT JSON.",
    "AT A GLANCE:",
    "- Fill at_a_glance.value with: duration, meeting_point, group_size, includes, excludes.",
    "- Use short strings. If unknown, use empty string (do not guess).",
    "PACKAGES:",
    "- For each package in INPUT JSON packages[], write 1 excerpt and 1 content_html for the package card.",
    "- excerpt: plain text, 1-2 short sentences, max 180 characters.",
    "- content_html: HTML only using <p>, <ul>, <li>, <strong>. No headings.",
    "- Use ONLY facts from INPUT JSON. Do NOT invent inclusions (no flights).",
    "- Prefer pulling inclusions from package_copy_source.guaranteed_inclusions[]; do not add anything outside it.",
    "- Keep content_html to 3-5 bullets, benefit-led.",
    "SEO:",
    "- Improve seo.h1 (page H1) for clarity and conversion; target 60-90 characters.",
    "- Improve seo.title and seo.meta_description for CTR and clarity.",
    "- NEVER mention any high-risk items unless supported by standard_context.flags (e.g., Nile/boat/cruise/flights/snorkeling/safari/private/tickets/lunch/pickup).",
    "",
    (bench ? ("BENCHMARK (internal/external insights, do not copy text):\n" + bench + "\n") : ""),
    "COMPETITIVE QUALITY (IMPORTANT):",
    "- Use OTA-level structure and persuasion, but write 100% original wording.",
    "- Do NOT copy or closely paraphrase any third-party site text.",
    "- Prefer clarity, specificity, and decision-enabling details over hype.",
    "",
    "STRICT:",
    "- Do NOT add headings (no h2/h3/h4).",
    "- Do NOT invent new destinations or logistics not supported by input.",
    "- Output must be JSON only.",
    "",
    "INPUT JSON:",
    JSON.stringify(input),
    "",
    "OUTPUT JSON SCHEMA:",
    JSON.stringify({
      seo: {
        h1: { score: 0, action: "keep", text: "" },
        title: { score: 0, action: "keep", text: "" },
        meta_description: { score: 0, action: "keep", text: "" },
        excerpt: { score: 0, action: "keep", text: "" },
        short_summary: { score: 0, action: "keep", text: "" }
      },
      description: { score: 0, action: "polish", html: "" },
      why_people_love: { score: 0, action: "polish", html: "" },
      highlights: { score: 0, action: "polish", items: [""] },
      itinerary: { score: 0, action: "polish", steps: [{ step_title: "", step_description: "", step_label: "", duration_value: null, duration_unit: "", meals_included: "" }] },
      included: { score: 0, action: "polish", items: [""], optional_items: [""] },
      excluded: { score: 0, action: "polish", items: [""], optional_items: [""] },
      faqs: { score: 0, action: "polish", items: [{ question: "", answer: "" }] },
      packages: { items: [{ airtable_record_id: "", action: "keep", severity: "low", reason: "", excerpt: "", content_html: "" }] },
      bold_promise: { score: 0, action: "polish", value: "" },
      at_a_glance: { score: 0, action: "polish", value: { duration: "", meeting_point: "", group_size: "", includes: "", excludes: "" } }
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

module.exports = {
  createConversionEnforcer,
  __test__: {
    init: (options) => initConversionEnforcer(options),
    convEnf_buildStandardContext_,
    convEnf_hasUnsupportedHighRiskClaims_,
    convEnf_removeUnsupportedHighRiskParts_,
    convEnf_rewriteUnsupportedContentText_,
    convEnf_sanitizeItineraryByFlags_,
    convEnf_rewriteUnsupportedFaqAnswer_,
    convEnf_serperSearch_,
    convEnf_serperScrape_,
    convEnf_serperScrapeFull_,
    convEnf_fetchExternalBenchmarkInsights_,
    convEnf_fetchGygOptionsIntel_,
    convEnf_playwrightExtractGygOptions_
  }
}
