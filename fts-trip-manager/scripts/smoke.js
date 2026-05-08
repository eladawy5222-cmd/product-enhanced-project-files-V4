const path = require('path')

function assert_(cond, msg) {
  if (cond) return
  throw new Error('Smoke assert failed: ' + String(msg || ''))
}

async function main() {
  const root = path.resolve(__dirname, '..')
  process.chdir(root)

  require('dotenv').config({ path: path.join(root, '.env') })

  const { getAppConfig } = require('../src/config/app-config')
  const { createLogger } = require('../src/logger/app-logger')
  const { createHttpClient } = require('../src/core/http-client')
  const { createAirtableClient } = require('../src/core/airtable-client')
  const { createServices } = require('../main')

  const config = getAppConfig({ rootDir: root })
  const logger = createLogger({ rootDir: root, debug: config.DEBUG })
  const http = createHttpClient({ logger, debug: config.DEBUG })
  function out(level, msg) {
    const s = String(msg == null ? '' : msg)
    if (level === 'warn') logger.warn(s)
    else if (level === 'error') logger.error(s)
    else logger.info(s)
    console.log(s)
  }
  let airtableClient = null
  const airtableApiKey = String(process.env.AIRTABLE_API_KEY || config.AIRTABLE_API_KEY || '').trim()
  const airtableBaseId = String(process.env.AIRTABLE_BASE_ID || config.AIRTABLE_BASE_ID || '').trim()
  if (airtableApiKey && airtableBaseId) {
    airtableClient = createAirtableClient({ http, logger, baseId: airtableBaseId, apiKey: airtableApiKey })
  }

  const reviewsApiKey = String(process.env.REVIEWS_AIRTABLE_API_KEY || config.REVIEWS_AIRTABLE_API_KEY || airtableApiKey || '').trim()
  const reviewsBaseId = String(process.env.REVIEWS_AIRTABLE_BASE_ID || config.REVIEWS_AIRTABLE_BASE_ID || airtableBaseId || '').trim()
  const reviewsSourceClient = (reviewsApiKey && reviewsBaseId)
    ? createAirtableClient({ http, logger, baseId: reviewsBaseId, apiKey: reviewsApiKey })
    : null

  const services = await createServices(root, { logger })

  const { __test__ } = require('../src/ai/conversion-enforcer')
  assert_(__test__ && typeof __test__ === 'object', 'conversion-enforcer test hooks are available')
  if (__test__.init && services) __test__.init(services)

  const {
    convEnf_buildStandardContext_,
    convEnf_hasUnsupportedHighRiskClaims_,
    convEnf_removeUnsupportedHighRiskParts_,
    convEnf_rewriteUnsupportedContentText_,
    convEnf_sanitizeItineraryByFlags_,
    convEnf_rewriteUnsupportedFaqAnswer_,
    convEnf_serperSearch_,
    convEnf_serperScrape_
  } = __test__

  const wantReviewsFetch = String(process.env.SMOKE_RUN_REVIEWS_FETCH || '').trim() === '1'
  if (wantReviewsFetch) {
    if (!reviewsSourceClient) {
      out('warn', 'Reviews smoke: skipped (REVIEWS_AIRTABLE_API_KEY / REVIEWS_AIRTABLE_BASE_ID not set)')
    } else {
      const sourceTable = String(process.env.REVIEWS_SOURCE_TABLE || config.REVIEWS_SOURCE_TABLE || 'List').trim() || 'List'
      const limit = Math.min(50, Math.max(1, Number.parseInt(String(process.env.SMOKE_REVIEWS_LIMIT || '10'), 10) || 10))
      out('info', `Reviews smoke: fetching ${limit} records from source table "${sourceTable}"`)
      try {
        const res = await reviewsSourceClient.airtableGet(sourceTable, {
          maxRecords: limit,
          pageSize: Math.min(100, limit)
        })
        const recs = res && res.records ? res.records : []
        out('info', `Reviews smoke: got ${recs.length} records`)
        const tripNameField = String(process.env.REVIEWS_SOURCE_TRIP_NAME_FIELD || config.REVIEWS_SOURCE_TRIP_NAME_FIELD || 'TripName')
        const bookingNrField = String(process.env.REVIEWS_SOURCE_BOOKING_NR_FIELD || config.REVIEWS_SOURCE_BOOKING_NR_FIELD || 'Booking Nr.')
        const customerField = String(process.env.REVIEWS_SOURCE_CUSTOMER_NAME_FIELD || config.REVIEWS_SOURCE_CUSTOMER_NAME_FIELD || 'CustomerName')
        const dateField = String(process.env.REVIEWS_SOURCE_REVIEW_DATE_FIELD || config.REVIEWS_SOURCE_REVIEW_DATE_FIELD || 'ReviewDate')
        const starsField = String(process.env.REVIEWS_SOURCE_STARS_FIELD || config.REVIEWS_SOURCE_STARS_FIELD || 'Stars')
        const contentField = String(process.env.REVIEWS_SOURCE_CONTENT_FIELD || config.REVIEWS_SOURCE_CONTENT_FIELD || 'Content')
        for (const r of recs) {
          const f = (r && r.fields) ? r.fields : {}
          const row = {
            id: r && r.id ? r.id : '',
            trip: f[tripNameField] || '',
            booking: f[bookingNrField] || '',
            customer: f[customerField] || '',
            date: f[dateField] || '',
            stars: f[starsField] || '',
            content_chars: String(f[contentField] || '').length
          }
          out('info', JSON.stringify(row))
        }
      } catch (e) {
        out('warn', 'Reviews smoke failed: ' + String(e && e.message ? e.message : e))
      }
    }
  }

  const smokeMode = String(process.env.SMOKE_MODE || '').trim().toLowerCase()
  const reviewsOnlyMode = wantReviewsFetch && (smokeMode === '' || smokeMode === 'reviews' || smokeMode === 'reviews-only' || smokeMode === 'reviewsonly')
  if (reviewsOnlyMode) {
    out('info', 'Smoke mode: reviews-only (skipping other smoke steps)')
    out('info', 'Smoke test ok')
    return
  }

  const basePayload = {
    trip: { id: 'rec_test', TripID: 'T-000', Title: 'Cairo City Tour', TourType: '', Slug: 'cairo-city-tour', Duration_Hours: '6', Duration_Minutes: '', Duration_Unit: 'hours' },
    seo: { title: '', meta_description: '', short_summary: '', excerpt: '', focus_keywords: '', focus_keywords_list: '', permalink: '' },
    description: '',
    why_people_love: '',
    highlights: ['Guided visit to top city landmarks'],
    itinerary: [{ step_title: 'Hotel pickup', step_description: 'Meet your guide and start the tour.', step_label: 'Start', duration_value: 30, duration_unit: 'minutes', meals_included: '' }],
    included: ['Egyptologist guide', 'Air-conditioned vehicle'],
    excluded: ['Optional activities'],
    faqs: [{ question: 'Are flights included?', answer: 'Yes, flights are included.' }],
    packages: [],
    package_copy_source: { guaranteed_inclusions: ['Egyptologist guide'], guaranteed_exclusions: ['Optional activities'] }
  }

  const ctxA = convEnf_buildStandardContext_(basePayload)
  assert_(ctxA && ctxA.flags && ctxA.evidence, 'standardContext has flags/evidence')
  assert_(ctxA.flags.has_nile === false, 'has_nile false when not evidenced')
  assert_(ctxA.flags.has_boat === false, 'has_boat false when not evidenced')
  assert_(ctxA.flags.has_cruise === false, 'has_cruise false when not evidenced')

  const badText = 'Enjoy a Nile cruise by boat with felucca ride.'
  assert_(convEnf_hasUnsupportedHighRiskClaims_(badText, ctxA.flags) === true, 'unsupported claims detected when not evidenced')
  const rewritten = convEnf_rewriteUnsupportedContentText_(badText, ctxA.flags, ctxA.evidence)
  assert_(!/\bnile\b/i.test(rewritten), 'rewrite removes nile when unsupported')
  assert_(!/\bcruise\b/i.test(rewritten), 'rewrite removes cruise when unsupported')
  assert_(!/\bboat\b/i.test(rewritten), 'rewrite removes boat when unsupported')
  assert_(!/\b(felucca|faluka)\b/i.test(rewritten), 'rewrite removes felucca when unsupported')

  const seoClean = convEnf_removeUnsupportedHighRiskParts_('Nile cruise by boat in Cairo', ctxA.flags)
  assert_(!/\bnile\b/i.test(seoClean), 'SEO sanitizer removes nile when unsupported')

  const safeFaq = convEnf_rewriteUnsupportedFaqAnswer_('Are flights included?', 'Yes, flights are included.', ctxA.flags, { hasEntranceIncluded: false, hasEntranceExcluded: false })
  assert_(/\bnot included\b/i.test(safeFaq), 'FAQ rewrite corrects unsupported flights claim')

  const itOut = convEnf_sanitizeItineraryByFlags_([{ step_title: 'Lunch stop', step_description: 'Enjoy lunch and a boat ride.', step_label: 'Meal', duration_value: 60, duration_unit: 'minutes', meals_included: 'Lunch' }], ctxA.flags, ctxA.evidence)
  const it0 = itOut[0] || {}
  assert_(!/\blunch\b/i.test(String(it0.step_title || '')), 'itinerary rewrite removes lunch when unsupported')
  assert_(!/\bboat\b/i.test(String(it0.step_description || '')), 'itinerary rewrite removes boat when unsupported')
  assert_(!/\blunch\b/i.test(String(it0.meals_included || '')), 'itinerary rewrite removes lunch in meals_included when unsupported')

  const payloadB = JSON.parse(JSON.stringify(basePayload))
  payloadB.trip.TourType = 'Private Tour'
  payloadB.itinerary = [{ step_title: 'Nile cruise', step_description: 'Cruise on the Nile by boat.', step_label: 'Cruise', duration_value: 60, duration_unit: 'minutes', meals_included: '' }]
  const ctxB = convEnf_buildStandardContext_(payloadB)
  assert_(ctxB.flags.has_private === true, 'TourType contributes to private evidence')
  assert_(ctxB.flags.has_nile === true, 'itinerary evidence enables nile')
  assert_(convEnf_hasUnsupportedHighRiskClaims_('Nile cruise by boat', ctxB.flags) === false, 'claims allowed when evidenced')

  const serperKey = String(process.env.SERPER_API_KEY || '').trim()
  if (serperKey && typeof convEnf_serperSearch_ === 'function' && typeof convEnf_serperScrape_ === 'function') {
    out('info', 'Serper smoke: testing search + scrape')
    try {
      const queries = [
        'NMEC Citadel Old Cairo day tour site:getyourguide.com',
        'Cairo day tour NMEC Citadel Old Cairo',
        'GetYourGuide Cairo day tour',
        'Cairo day tour',
        'guided day tour',
        'private guided tour',
        'book tours online',
        'حجز جولات سياحية',
        'جولة سياحية',
        'tour',
        'travel'
      ]
      let results = []
      let used = ''
      for (const q of queries) {
        used = q
        results = await convEnf_serperSearch_(q, serperKey)
        out('info', `Serper smoke: query="${q}" results_count=${Array.isArray(results) ? results.length : 0}`)
        if (Array.isArray(results) && results.length) break
      }

      if (Array.isArray(results) && results.length) {
        let pickedUrl = ''
        let bestLen = 0
        function isUsefulTourUrl(url) {
          const u = String(url || '').toLowerCase()
          if (!u) return false
          return u.includes('/tour') ||
            u.includes('/tours/') ||
            u.includes('/attractionproductreview') ||
            u.includes('things-to-do') ||
            u.includes('activities') ||
            u.includes('/activity/')
        }
        const filtered = results.filter((r) => r && r.url && isUsefulTourUrl(r.url))
        const candidates = filtered.length ? filtered : results
        const lim = Math.min(5, candidates.length)
        for (let i = 0; i < lim; i++) {
          const r = candidates[i]
          if (!r || !r.url) continue
          const text = await convEnf_serperScrape_(r.url, serperKey)
          const len = String(text || '').length
          out('info', `Serper smoke: scrape_try url=${String(r.url)} chars=${len}`)
          if (len > bestLen) {
            bestLen = len
            pickedUrl = r.url
          }
          if (len > 200) break
        }
        out('info', 'Serper smoke: picked_url=' + String(pickedUrl || (candidates[0] && candidates[0].url ? candidates[0].url : '')))
        out('info', 'Serper smoke: best_scrape_chars=' + String(bestLen) + (used ? (' | used_query="' + used + '"') : ''))
      }
    } catch (e) {
      out('warn', 'Serper smoke failed: ' + String(e && e.message ? e.message : e))
    }
  } else {
    out('info', 'Serper smoke: skipped (SERPER_API_KEY not set)')
  }

  if (airtableClient) {
    let tripRec = null
    let tripRecId = null
    let tripTitle = ''
    let TRIP_ID = String(process.env.SMOKE_TRIP_ID || '').trim()

    if (TRIP_ID) {
      out('info', 'Airtable smoke: checking trip ' + TRIP_ID)
      tripRec = await airtableClient.airtableFindOneByField('Trips', 'TripID', TRIP_ID)
    }

    if (!tripRec) {
      out('warn', 'Airtable smoke: SMOKE_TRIP_ID not provided or not found. Falling back to first Trips record.')
      const resTrips = await airtableClient.airtableGet('Trips', { maxRecords: 1, pageSize: 1 })
      tripRec = (resTrips && resTrips.records && resTrips.records[0]) ? resTrips.records[0] : null
      if (tripRec && tripRec.fields && tripRec.fields.TripID) TRIP_ID = String(tripRec.fields.TripID)
    }

    if (tripRec && tripRec.id) {
      tripRecId = tripRec.id
      tripTitle = tripRec.fields && tripRec.fields.Title ? String(tripRec.fields.Title) : ''
      out('info', 'Airtable smoke: trip_record_id=' + tripRecId + (TRIP_ID ? (' | TripID=' + TRIP_ID) : '') + (tripTitle ? (' | title=' + tripTitle) : ''))
    } else {
      out('warn', 'Airtable smoke: Trips table has no records or is not accessible. Running table existence checks only.')
    }

    const wantExternalBench = String(process.env.SMOKE_EXTERNAL_BENCHMARK || '').trim() === '1'
    if (wantExternalBench && tripRec && tripRec.fields && __test__ && typeof __test__.convEnf_fetchExternalBenchmarkInsights_ === 'function') {
      out('info', 'External benchmark smoke: building insights (safe output; no competitor text)')
      try {
        const hasDeepseek = !!String(process.env.DEEPSEEK_API_KEY || config.DEEPSEEK_API_KEY || '').trim()
        out('info', 'External benchmark smoke: deepseek_key_configured=' + String(hasDeepseek))
        const brief = await __test__.convEnf_fetchExternalBenchmarkInsights_(tripRec.fields, { truth: {} })
        const s = String(brief || '').trim()
        const urls = s.split('\n').map((x) => String(x || '').trim()).filter((x) => x.startsWith('- http'))
        const gygOnly = urls.every((u) => u.toLowerCase().includes('getyourguide.com') || u.toLowerCase().includes('serper://search'))
        out('info', 'External benchmark smoke: ok=' + String(!!s) + ' chars=' + String(s.length) + ' sources=' + String(urls.length) + ' gyg_only=' + String(gygOnly))
        if (urls.length) out('info', JSON.stringify({ sources: urls.slice(0, 6) }, null, 2))
      } catch (e) {
        out('warn', 'External benchmark smoke failed: ' + String(e && e.message ? e.message : e))
      }
    } else if (wantExternalBench) {
      out('warn', 'External benchmark smoke: skipped (missing trip record or test hook)')
    }

    const wantItinerary = String(process.env.SMOKE_RUN_ITINERARY || '').trim() === '1'
    if (wantItinerary && services && tripRecId) {
      out('info', 'Itinerary smoke: resetting stage -> running itinerary enhancer batch')
      try {
        await services.resetTripStage(tripRecId, 'itinerary')
        await services.itineraryEnhancer.runAiItineraryBatch()
        out('info', 'Itinerary smoke: done')
      } catch (e) {
        out('warn', 'Itinerary smoke failed: ' + String(e && e.message ? e.message : e))
      }
    } else if (wantItinerary) {
      out('warn', 'Itinerary smoke: skipped (missing trip record or services)')
    }

    const wantTripFacts = String(process.env.SMOKE_RUN_TRIPFACTS || '').trim() === '1'
    if (wantTripFacts && services && tripRecId) {
      out('info', 'TripFacts smoke: resetting stage -> running trip facts enhancer batch')
      try {
        await services.resetTripStage(tripRecId, 'tripfacts')
        await services.tripFactsEnhancer.runAiTripFactsEnhancementBatch()
        out('info', 'TripFacts smoke: done')
      } catch (e) {
        out('warn', 'TripFacts smoke failed: ' + String(e && e.message ? e.message : e))
      }
    } else if (wantTripFacts) {
      out('warn', 'TripFacts smoke: skipped (missing trip record or services)')
    }

    const wantConv = String(process.env.SMOKE_RUN_CONVERSION_ENFORCER || '').trim() === '1'
    if (wantConv && services && tripRecId) {
      out('info', 'Conversion Enforcer smoke: running (updates Airtable enhancement tables)')
      try {
        const { createConversionEnforcer } = require('../src/ai/conversion-enforcer')
        const conv = createConversionEnforcer({
          airtable: services.airtable,
          http: services.http,
          config: services.config,
          logger: services.logger,
          lock: services.lock,
          store: services.store,
          aiProvider: services.aiProvider
        })
        await conv.runConversionEnforcer({ id: tripRecId, fields: tripRec.fields || {} })
        out('info', 'Conversion Enforcer smoke: done')
      } catch (e) {
        out('warn', 'Conversion Enforcer smoke failed: ' + String(e && e.message ? e.message : e))
      }
    } else if (wantConv) {
      out('warn', 'Conversion Enforcer smoke: skipped (missing trip record or services)')
    }

    const wantPublish = String(process.env.SMOKE_PUBLISH || '').trim() === '1'
    if (wantPublish && services && tripRecId && TRIP_ID) {
      out('info', 'Publish smoke: setting Publish_Status=Pending -> running updater batch')
      try {
        process.env.UPDATER_ONLY_TRIP_ID = String(TRIP_ID)
        await services.airtable.airtableUpdate('Trips', tripRecId, { Publish_Status: 'Pending' })
        await services.updater.runUpdaterBatch()
        const tripAfter = await services.airtable.airtableFindOneByField('Trips', 'TripID', TRIP_ID)
        const st = tripAfter && tripAfter.fields ? String(tripAfter.fields.Publish_Status || '') : ''
        out('info', 'Publish smoke: finished. Publish_Status=' + st)
      } catch (e) {
        out('warn', 'Publish smoke failed: ' + String(e && e.message ? e.message : e))
      }
    } else if (wantPublish) {
      out('warn', 'Publish smoke: skipped (missing trip record/services or SMOKE_TRIP_ID)')
    }

    function findFormula(linkField) {
      const parts = []
      if (tripRecId) parts.push(`FIND('${String(tripRecId).replace(/'/g, "\\'")}', ARRAYJOIN({${linkField}}))`)
      if (TRIP_ID) parts.push(`FIND('${String(TRIP_ID).replace(/'/g, "\\'")}', ARRAYJOIN({${linkField}}))`)
      if (tripTitle) parts.push(`FIND('${tripTitle.replace(/'/g, "\\'")}', ARRAYJOIN({${linkField}}))`)
      if (!parts.length) return ''
      return parts.length === 1 ? parts[0] : `OR(${parts.join(', ')})`
    }

    async function sampleTable(tableName, linkField, pickFields) {
      const params = { maxRecords: 3, pageSize: 3 }
      const formula = linkField ? findFormula(linkField) : ''
      if (formula) params.filterByFormula = formula
      const res = await airtableClient.airtableGet(tableName, params)
      const recs = res && res.records ? res.records : []
      const sample = []
      for (let i = 0; i < recs.length; i++) {
        const f = recs[i].fields || {}
        const row = {}
        for (const k of pickFields) row[k] = f[k]
        sample.push(row)
      }
      return { count: recs.length, sample }
    }

    const checks = [
      { table: 'TripIncludes', link: 'Trip', fields: ['IncludeItem', 'Item', 'Title'] },
      { table: 'TripExcludes', link: 'Trip', fields: ['ExcludeItem', 'Item', 'Title'] },
      { table: 'TripIncludes Improvement With AI', link: 'Trip', fields: ['IncludeItem', 'AI_IncludeItem', 'AI_IncludeText'] },
      { table: 'TripExcludes Improvement With AI', link: 'Trip', fields: ['ExcludeItem', 'AI_ExcludeItem', 'AI_ExcludeText'] },
      { table: 'FAQs Improvement With AI', link: 'Trip', fields: ['AI_Question', 'AI_Answer'] },
      { table: 'TripFAQs', link: 'Trip', fields: ['Question', 'Answer'] },
      { table: 'AddOns', link: 'Trip', fields: ['AddOnTitle', 'AddOnPrice', 'Price', 'Cost'] },
      { table: 'AddOns Improvement With AI', link: 'Trip', fields: ['AI_AddOn_Title', 'AI_AddOn_Price'] },
      { table: 'Packages', link: 'Trip', fields: ['PackageName', 'ShortDescription'] },
      { table: 'TripDetails', link: 'Trip', fields: ['DetailTitle', 'DetailText', 'TourType'] },
      { table: 'Improvement With AI', link: 'Trip', fields: ['AI_Status', 'AI_SEO_Status', 'AI_Trip_Description', 'AI_SEO_Title'] }
    ]

    for (const c of checks) {
      try {
        const r = await sampleTable(c.table, c.link, c.fields)
        out('info', `Airtable smoke: ${c.table} -> sample_count=${r.count}`)
        if (r.sample && r.sample.length) out('info', JSON.stringify({ table: c.table, sample: r.sample }, null, 2))
      } catch (e) {
        out('warn', `Airtable smoke: ${c.table} check failed: ${String(e && e.message ? e.message : e)}`)
      }
    }
  } else {
    out('warn', 'Airtable smoke: skipped (missing AIRTABLE_API_KEY / AIRTABLE_BASE_ID)')
  }

  out('info', 'Smoke test ok')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
