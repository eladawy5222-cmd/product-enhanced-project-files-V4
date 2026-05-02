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

  await createServices(root, { logger })

  const { __test__ } = require('../src/ai/conversion-enforcer')
  assert_(__test__ && typeof __test__ === 'object', 'conversion-enforcer test hooks are available')

  const {
    convEnf_buildStandardContext_,
    convEnf_hasUnsupportedHighRiskClaims_,
    convEnf_removeUnsupportedHighRiskParts_,
    convEnf_rewriteUnsupportedContentText_,
    convEnf_sanitizeItineraryByFlags_,
    convEnf_rewriteUnsupportedFaqAnswer_
  } = __test__

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
