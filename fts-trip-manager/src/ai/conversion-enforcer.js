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
  const _logTripId = (data && typeof data === 'object' && data.id) ? data.id : String(data || '')
  let _success = false
  try {
    console.log('🚀 Conversion Enforcer START for Trip: ' + _logTripId)
    const trip = await convEnf_normalizeTripRecord_(data)
    if (!trip || !trip.id) return
    const tripId = trip.id
    const tripFields = trip.fields || {}
    console.log('📥 Input Data:')
    console.log(JSON.stringify(tripFields, null, 2))
    const tripNumber = tripFields.TripID || ''
    const imp = await convEnf_fetchMainImprovementRecord_(tripId, tripFields, tripNumber)
    if (!imp || !imp.id) return
    const impFields = imp.fields || {}
    const nowIso = new Date().toISOString()

    const tripLinkValue = String(tripNumber || tripId || '').trim()
    const existingHighlights = await convEnf_fetchHighlights_(tripLinkValue)
    const existingItinerary = await convEnf_fetchItinerary_(tripLinkValue)
    const existingIncludes = await convEnf_fetchIncExc_(tripLinkValue, 'TripIncludes Improvement With AI', 'IncludeItem')
    const existingExcludes = await convEnf_fetchIncExc_(tripLinkValue, 'TripExcludes Improvement With AI', 'ExcludeItem')
    const existingFaqs = await convEnf_fetchFaqs_(tripLinkValue)
    const existingPackages = await convEnf_fetchPackages_(tripLinkValue)
    console.log('Fetched Highlights count: ' + (existingHighlights && existingHighlights.items ? existingHighlights.items.length : 0))
    console.log('Fetched Itinerary count: ' + (existingItinerary && existingItinerary.steps ? existingItinerary.steps.length : 0))
    console.log('Fetched Includes count: ' + (existingIncludes && existingIncludes.items ? existingIncludes.items.length : 0))
    console.log('Fetched FAQs count: ' + (existingFaqs && existingFaqs.faqs ? existingFaqs.faqs.length : 0))
    console.log('Fetched Packages count: ' + (existingPackages && existingPackages.packages ? existingPackages.packages.length : 0))
    if (!existingHighlights.items.length) console.log('⚠️ No Highlights found using TripID filter')
    if (!existingItinerary.steps.length) console.log('⚠️ No Itinerary found using TripID filter')
    if (!existingIncludes.items.length) console.log('⚠️ No Includes found using TripID filter')
    if (!existingFaqs.faqs.length) console.log('⚠️ No FAQs found using TripID filter')
    if (!existingPackages.packages.length) console.log('⚠️ No Packages found using TripID filter')
    console.log('🔹 Processing Highlights...')
    console.log('Original Highlights count: ' + (existingHighlights && existingHighlights.items ? existingHighlights.items.length : 0))
    console.log('🔹 Processing Itinerary...')
    console.log('Original Steps: ' + (existingItinerary && existingItinerary.steps ? existingItinerary.steps.length : 0))
    console.log('🔹 Processing Includes...')
    console.log('Original Includes: ' + (existingIncludes && existingIncludes.items ? existingIncludes.items.length : 0))
    console.log('🔹 Processing FAQs...')
    console.log('Original FAQs: ' + (existingFaqs && existingFaqs.faqs ? existingFaqs.faqs.length : 0))
    console.log('🔹 Processing Packages...')
    console.log('Original Packages: ' + (existingPackages && existingPackages.packages ? existingPackages.packages.length : 0))

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

    const standardContext = convEnf_buildStandardContext_(payload)
    console.log('🧭 Standard Context:')
    console.log(JSON.stringify(standardContext, null, 2))

    const prompt = convEnf_buildPrompt_(payload, standardContext)
    const ai = await callAi_(prompt)
    if (!ai || typeof ai !== 'object') return

    const updateMain = {}
    const flags = (standardContext && standardContext.flags) ? standardContext.flags : {}
    const evidence = (standardContext && standardContext.evidence) ? standardContext.evidence : {}
    const entranceTruth = convEnf_detectEntranceFeesTruth_(payload.included, payload.excluded)
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
    if (descHtmlClean && descHtmlClean.length >= 80) updateMain.AI_Trip_Description = descHtmlClean
    const whyHtml = convEnf_getString_(ai, ['why_people_love', 'html'])
    let whyHtmlClean = whyHtml ? convEnf_sanitizeWhyPeopleLoveHtml_(whyHtml) : ''
    if (whyHtmlClean) whyHtmlClean = convEnf_rewriteUnsupportedContentText_(whyHtmlClean, flags, evidence)
    if (whyHtmlClean) whyHtmlClean = convEnf_applyEntranceFeesTruthToText_(whyHtmlClean, entranceTruth)
    if (whyHtmlClean) whyHtmlClean = convEnf_applyGuideTruthToText_(whyHtmlClean, guideTruth)
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
    console.log('📤 Writing updates to Airtable...')
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
      console.log('✅ Improved Highlights:')
      console.log(JSON.stringify(newHighlights, null, 2))
      await convEnf_replaceHighlights_(tripId, existingHighlights.records, newHighlights, nowIso)
    }

    let newItinerary = convEnf_getArray_(ai, ['itinerary', 'steps'])
    newItinerary = convEnf_sanitizeItinerarySteps_(newItinerary, { max: 20 })
    newItinerary = convEnf_applyItineraryDurationSuffix_(newItinerary)
    newItinerary = convEnf_sanitizeItineraryByFlags_(newItinerary, flags, evidence)
    if (newItinerary && newItinerary.length >= 2) {
      console.log('✅ Improved Itinerary:')
      console.log(JSON.stringify(newItinerary, null, 2))
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

    if (newIncluded && newIncluded.length >= 3) {
      console.log('✅ Improved Includes:')
      console.log(JSON.stringify(newIncluded, null, 2))
      await convEnf_replaceIncExc_(tripId, existingIncludes.records, 'TripIncludes Improvement With AI', 'IncludeItem', newIncluded, nowIso)
    }
    if (newExcluded && newExcluded.length >= 2) {
      await convEnf_replaceIncExc_(tripId, existingExcludes.records, 'TripExcludes Improvement With AI', 'ExcludeItem', newExcluded, nowIso)
    }
    let newFaqs = convEnf_getArray_(ai, ['faqs', 'items'])
    newFaqs = convEnf_sanitizeFaqItems_(newFaqs, { max: 15 }, { included: newIncluded, excluded: newExcluded, flags })
    newFaqs = convEnf_sortFaqItems_(newFaqs)
    if (newFaqs && newFaqs.length >= 3) {
      console.log('✅ Improved FAQs:')
      console.log(JSON.stringify(newFaqs, null, 2))
      await convEnf_replaceFaqs_(tripId, existingFaqs.records, newFaqs, nowIso)
    }
    let packageCopyItems = convEnf_getArray_(ai, ['packages', 'items'])
    packageCopyItems = convEnf_sanitizePackageCopyItems_(packageCopyItems, flags, evidence)
    if (packageCopyItems && packageCopyItems.length) {
      await convEnf_updatePackagesCopy_(existingPackages.records, packageCopyItems)
    }
    _success = true
  } catch (e) {
    console.log('❌ Conversion Enforcer ERROR:')
    console.log(e && e.message ? e.message : String(e))
    console.log(e && e.stack ? e.stack : '')
  } finally {
    if (_success) console.log('✅ Airtable update SUCCESS for Trip: ' + _logTripId)
    console.log('🏁 Conversion Enforcer FINISHED for Trip: ' + _logTripId)
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

    if (value === null) { console.log(prefix + ' = null'); return }
    if (value === undefined) { console.log(prefix + ' = undefined'); return }
    if (typeof value === 'number' || typeof value === 'boolean') { console.log(prefix + ' = ' + String(value)); return }

    if (Array.isArray(value)) {
      console.log(prefix + ' (array items=' + String(value.length) + '):')
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
      console.log(prefix + ' (json len=' + String(js.length) + '):')
      convEnf_logChunks_(prefix + ' = ', js)
      return
    }

    const s = String(value)
    console.log(prefix + ' (len=' + String(s.length) + '):')
    convEnf_logChunks_(prefix + ' = ', s)
  } catch {}
}

function convEnf_logChunks_(linePrefix, text) {
  try {
    const p = String(linePrefix || '')
    const s = String(text || '')
    const chunkSize = 900
    if (!s) { console.log(p + '""'); return }
    for (let i = 0; i < s.length; i += chunkSize) {
      console.log(p + s.slice(i, i + chunkSize))
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
        console.log('✅ Fixed FAQ: group size question had language answer')
      } else if (!looksLikeGroupSize && !hasGroupEvidence) {
        a = "Group size depends on the option selected and availability. You'll receive the exact details after booking."
        console.log('✅ Fixed FAQ: normalized group size answer')
      }
      if (a.toLowerCase().includes('private') && !hasPrivateEvidence) {
        a = "Group size depends on the option selected and availability. You'll receive the exact details after booking."
        console.log('✅ Fixed FAQ: removed unsupported private claim')
      }
    }
    if (/languages?\b/.test(qLc) && !hasLanguageEvidence) {
      a = "Language availability is confirmed at booking."
      console.log('✅ Fixed FAQ: normalized language answer')
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
  if (/cruise|boat|felucca|nile/.test(qLc) && (!f.has_cruise || !f.has_boat || !f.has_felucca || !f.has_nile)) return "Activities depend on the option selected. Please refer to the itinerary and What's Included/Excluded section."
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

async function convEnf_fetchFaqs_(tripId) {
  const res = await airtableGet_('FAQs Improvement With AI', {
    filterByFormula: "FIND('" + convEnf_escapeFormulaString_(tripId) + "', ARRAYJOIN({Trip}))",
    pageSize: 100
  })
  const recs = res && res.records ? res.records : []
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

async function convEnf_fetchPackages_(tripId) {
  const res = await airtableGet_('Packages', {
    filterByFormula: "FIND('" + convEnf_escapeFormulaString_(tripId) + "', ARRAYJOIN({Trip}))",
    pageSize: 100
  })
  const recs = res && res.records ? res.records : []
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
  console.log('Deleted old records: ' + ids.length)
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
  console.log('Created new records: ' + fieldsArray.length)
}

async function convEnf_replaceItinerary_(tripId, existingRecords, steps, nowIso) {
  const recs = Array.isArray(existingRecords) ? existingRecords : []
  const ids = recs.map((r) => (r && r.id ? r.id : '')).filter(Boolean)
  if (ids.length) await airtableBatchDelete_('Itinerary Improvement With AI', ids)
  console.log('Deleted old records: ' + ids.length)
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
  console.log('Created new records: ' + fieldsArray.length)
}

async function convEnf_replaceIncExc_(tripId, existingRecords, tableName, textField, items, nowIso) {
  const recs = Array.isArray(existingRecords) ? existingRecords : []
  const ids = recs.map((r) => (r && r.id ? r.id : '')).filter(Boolean)
  if (ids.length) await airtableBatchDelete_(tableName, ids)
  console.log('Deleted old records: ' + ids.length)
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
  console.log('Created new records: ' + fieldsArray.length)
}

async function convEnf_replaceFaqs_(tripId, existingRecords, faqs, nowIso) {
  const recs = Array.isArray(existingRecords) ? existingRecords : []
  const ids = recs.map((r) => (r && r.id ? r.id : '')).filter(Boolean)
  if (ids.length) await airtableBatchDelete_('FAQs Improvement With AI', ids)
  console.log('Deleted old records: ' + ids.length)
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
  console.log('Created new records: ' + fieldsArray.length)
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
    convEnf_buildStandardContext_,
    convEnf_hasUnsupportedHighRiskClaims_,
    convEnf_removeUnsupportedHighRiskParts_,
    convEnf_rewriteUnsupportedContentText_,
    convEnf_sanitizeItineraryByFlags_,
    convEnf_rewriteUnsupportedFaqAnswer_
  }
}
