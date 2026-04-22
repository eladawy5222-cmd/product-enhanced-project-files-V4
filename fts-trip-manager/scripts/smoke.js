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
  if (config.AIRTABLE_API_KEY && config.AIRTABLE_BASE_ID) {
    createAirtableClient({ http, logger, baseId: config.AIRTABLE_BASE_ID, apiKey: config.AIRTABLE_API_KEY })
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

  logger.info('Smoke test ok')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
