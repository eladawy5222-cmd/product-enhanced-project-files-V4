const path = require('path')

function parseBool(v, def) {
  const s = String(v == null ? '' : v).trim().toLowerCase()
  if (!s) return !!def
  if (s === 'true' || s === '1' || s === 'yes') return true
  if (s === 'false' || s === '0' || s === 'no') return false
  return !!def
}

function parseIntSafe(v, def) {
  const n = Number.parseInt(String(v == null ? '' : v), 10)
  return Number.isFinite(n) ? n : def
}

function parseFloatSafe(v, def) {
  const n = Number.parseFloat(String(v == null ? '' : v))
  return Number.isFinite(n) ? n : def
}

function getAppConfig(options) {
  const rootDir = options && options.rootDir ? String(options.rootDir) : process.cwd()
  const dataDir = path.resolve(rootDir, 'data')

  const WP_API_BASE = process.env.WP_API_BASE || 'https://ftstravels.com/wp-json/fts/v1'
  const WP_API_URL_SINGLE = process.env.WP_API_URL_SINGLE || 'https://ftstravels.com/wp-json/fts/v1/trip'

  return {
    rootDir,
    dataDir,

    WP_API_BASE,
    WP_API_URL_SINGLE,
    WP_API_USER: process.env.WP_API_USER || '',
    WP_API_PASS: process.env.WP_API_PASS || '',
    WP_PER_PAGE: parseIntSafe(process.env.WP_PER_PAGE, 20),

    AIRTABLE_API_KEY: process.env.AIRTABLE_API_KEY || '',
    AIRTABLE_BASE_ID: process.env.AIRTABLE_BASE_ID || 'apphGHAvy5IhAWVw9',

    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
    DEEPSEEK_ENDPOINT: process.env.DEEPSEEK_ENDPOINT || 'https://api.deepseek.com/chat/completions',
    DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    DEEPSEEK_MODEL_CONVERSION: process.env.DEEPSEEK_MODEL_CONVERSION || '',
    DEEPSEEK_MAX_TOKENS: parseIntSafe(process.env.DEEPSEEK_MAX_TOKENS, 0),
    DEEPSEEK_MAX_TOKENS_CONVERSION: parseIntSafe(process.env.DEEPSEEK_MAX_TOKENS_CONVERSION, 0),

    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',

    SERPER_API_KEY: process.env.SERPER_API_KEY || '',
    SERPER_HL: process.env.SERPER_HL || 'en',
    SERPER_GL: process.env.SERPER_GL || 'us',
    SERPER_COMPETITOR_MAX_RESULTS: parseIntSafe(process.env.SERPER_COMPETITOR_MAX_RESULTS, 10),

    DEBUG: parseBool(process.env.DEBUG, true),
    PUBLISHER_WORKFLOW_ENABLED: parseBool(process.env.PUBLISHER_WORKFLOW_ENABLED, false),

    SYNC: {
      MAX_TRIPS_PER_RUN: parseIntSafe(process.env.MAX_TRIPS_PER_RUN, 1),
      MAX_TRIPS_PER_DAY: parseIntSafe(process.env.MAX_TRIPS_PER_DAY, 5),
      MAX_RUNTIME_MS: 2 * 60 * 1000
    },

    WORKER_ID: process.env.WORKER_ID || 'desktop-app',

    REVIEWS_AIRTABLE_API_KEY: process.env.REVIEWS_AIRTABLE_API_KEY || '',
    REVIEWS_AIRTABLE_BASE_ID: process.env.REVIEWS_AIRTABLE_BASE_ID || '',
    REVIEWS_SOURCE_TABLE: process.env.REVIEWS_SOURCE_TABLE || 'List',
    REVIEWS_TARGET_TABLE: process.env.REVIEWS_TARGET_TABLE || 'TripReviews',
    REVIEWS_TRIPS_TABLE: process.env.REVIEWS_TRIPS_TABLE || 'Trips',
    REVIEWS_TRIPS_MAX_FETCH: parseIntSafe(process.env.REVIEWS_TRIPS_MAX_FETCH, 5000),
    REVIEWS_SOURCE_UPDATED_AT_FIELD: process.env.REVIEWS_SOURCE_UPDATED_AT_FIELD || 'UpdatedAt',
    REVIEWS_SOURCE_TRIP_NAME_FIELD: process.env.REVIEWS_SOURCE_TRIP_NAME_FIELD || 'TripName',
    REVIEWS_SOURCE_BOOKING_NR_FIELD: process.env.REVIEWS_SOURCE_BOOKING_NR_FIELD || 'Booking Nr.',
    REVIEWS_SOURCE_CUSTOMER_NAME_FIELD: process.env.REVIEWS_SOURCE_CUSTOMER_NAME_FIELD || 'CustomerName',
    REVIEWS_SOURCE_REVIEW_DATE_FIELD: process.env.REVIEWS_SOURCE_REVIEW_DATE_FIELD || 'ReviewDate',
    REVIEWS_SOURCE_STARS_FIELD: process.env.REVIEWS_SOURCE_STARS_FIELD || 'Stars',
    REVIEWS_SOURCE_CONTENT_FIELD: process.env.REVIEWS_SOURCE_CONTENT_FIELD || 'Content',
    REVIEWS_INGEST_MAX_PER_RUN: parseIntSafe(process.env.REVIEWS_INGEST_MAX_PER_RUN, 200),
    REVIEWS_MATCH_MAX_PER_RUN: parseIntSafe(process.env.REVIEWS_MATCH_MAX_PER_RUN, 100),
    REVIEWS_MATCH_THRESHOLD: Number(process.env.REVIEWS_MATCH_THRESHOLD || 0.72),
    REVIEWS_MATCH_AI_THRESHOLD: Number(process.env.REVIEWS_MATCH_AI_THRESHOLD || 0.55),
    REVIEWS_MATCH_MARGIN_MIN: Number(process.env.REVIEWS_MATCH_MARGIN_MIN || 0.18),
    REVIEWS_MATCH_MARGIN_SCORE_MIN: Number(process.env.REVIEWS_MATCH_MARGIN_SCORE_MIN || 0.5),
    REVIEWS_MATCH_AI_CONFIDENCE_MIN: Number(process.env.REVIEWS_MATCH_AI_CONFIDENCE_MIN || 0.55),
    REVIEWS_MATCH_MAX_AI_PER_RUN: parseIntSafe(process.env.REVIEWS_MATCH_MAX_AI_PER_RUN, 50),
    REVIEWS_MATCH_ALWAYS_USE_AI: parseBool(process.env.REVIEWS_MATCH_ALWAYS_USE_AI, false),
    REVIEWS_MATCH_MODE: process.env.REVIEWS_MATCH_MODE || 'hybrid',
    REVIEWS_ENRICH_ENABLED: parseBool(process.env.REVIEWS_ENRICH_ENABLED, true),
    REVIEWS_ENRICH_ONLY_IF_EMPTY: parseBool(process.env.REVIEWS_ENRICH_ONLY_IF_EMPTY, true),
    REVIEWS_ENRICH_MAX_AI_PER_RUN: parseIntSafe(process.env.REVIEWS_ENRICH_MAX_AI_PER_RUN, 50),
    REVIEWS_ENRICH_SUMMARY_MAX_CHARS: parseIntSafe(process.env.REVIEWS_ENRICH_SUMMARY_MAX_CHARS, 180),
    REVIEWS_ENRICH_SUMMARY_WRITE_FIELDS: process.env.REVIEWS_ENRICH_SUMMARY_WRITE_FIELDS || 'Content_Summary,Content Summary,Content_Summary_Text,Content Summary Text,Content_Summary_Generated',
    REVIEWS_ENRICH_SENTIMENT_WRITE_FIELDS: process.env.REVIEWS_ENRICH_SENTIMENT_WRITE_FIELDS || 'Sentiment',
    REVIEWS_ENRICH_SUMMARY_FILTER_FIELDS: process.env.REVIEWS_ENRICH_SUMMARY_FILTER_FIELDS || 'Content_Summary',
    REVIEWS_ENRICH_SENTIMENT_FILTER_FIELDS: process.env.REVIEWS_ENRICH_SENTIMENT_FILTER_FIELDS || 'Sentiment',
    REVIEWS_MATCH_MULTI_TRIP_MAX: parseIntSafe(process.env.REVIEWS_MATCH_MULTI_TRIP_MAX, 3),
    REVIEWS_MATCH_MULTI_TRIP_MIN_SCORE: parseFloatSafe(process.env.REVIEWS_MATCH_MULTI_TRIP_MIN_SCORE, 0.75),
    REVIEWS_MATCH_REQUIRE_CONSISTENCY: parseBool(process.env.REVIEWS_MATCH_REQUIRE_CONSISTENCY, true),
    REVIEWS_MATCH_REVIEW_TEXT_MAX_CHARS: parseIntSafe(process.env.REVIEWS_MATCH_REVIEW_TEXT_MAX_CHARS, 500),
    REVIEWS_MATCH_REPROCESS_MULTI_MATCHED: parseBool(process.env.REVIEWS_MATCH_REPROCESS_MULTI_MATCHED, true),
    REVIEWS_MATCH_AI_CANDIDATES: parseIntSafe(process.env.REVIEWS_MATCH_AI_CANDIDATES, 5),
    REVIEWS_MATCH_AI_CANDIDATES_FALLBACK: parseIntSafe(process.env.REVIEWS_MATCH_AI_CANDIDATES_FALLBACK, 10),
    REVIEWS_MATCH_TRIP_CONTEXT_TTL_HOURS: parseIntSafe(process.env.REVIEWS_MATCH_TRIP_CONTEXT_TTL_HOURS, 24),
    REVIEWS_MATCH_TRIP_CONTEXT_MAX_CHARS: parseIntSafe(process.env.REVIEWS_MATCH_TRIP_CONTEXT_MAX_CHARS, 1800),
    REVIEWS_MATCH_TRIP_CONTEXT_PER_TABLE_LIMIT: parseIntSafe(process.env.REVIEWS_MATCH_TRIP_CONTEXT_PER_TABLE_LIMIT, 25),
    REVIEWS_MATCH_TRIP_CONTEXT_TABLES: process.env.REVIEWS_MATCH_TRIP_CONTEXT_TABLES || 'Improvement With AI,Highlights Improvement With AI,Itinerary Improvement With AI,TripIncludes Improvement With AI,TripExcludes Improvement With AI,TripFacts Improvement With AI,FAQs Improvement With AI',

    REVIEWS_IMPROVEMENT_TABLE: process.env.REVIEWS_IMPROVEMENT_TABLE || 'Improvement With AI',
    REVIEWS_IMPROVEMENT_TRIP_LINK_FIELD: process.env.REVIEWS_IMPROVEMENT_TRIP_LINK_FIELD || 'Trip',
    REVIEWS_IMPROVEMENT_AI_SEO_TITLE_FIELD: process.env.REVIEWS_IMPROVEMENT_AI_SEO_TITLE_FIELD || 'AI_SEO_Title',
    REVIEWS_IMPROVEMENTS_MAX_FETCH: parseIntSafe(process.env.REVIEWS_IMPROVEMENTS_MAX_FETCH, 5000),
    REVIEWS_PUBLISH_MAX_TRIPS_PER_RUN: parseIntSafe(process.env.REVIEWS_PUBLISH_MAX_TRIPS_PER_RUN, 40),
    REVIEWS_PUBLISH_TOP_N: parseIntSafe(process.env.REVIEWS_PUBLISH_TOP_N, 12),
    REVIEWS_PUBLISH_REQUIRE_ALL_MATCHED: parseBool(process.env.REVIEWS_PUBLISH_REQUIRE_ALL_MATCHED, true),
    REVIEWS_PUBLISH_USE_SUMMARY_FALLBACK: parseBool(process.env.REVIEWS_PUBLISH_USE_SUMMARY_FALLBACK, true),

    TABLES: {
      TRIPS: 'Trips',
      PACKAGES: 'Packages',
      IMAGES: 'Images',
      PRICES: 'Prices',
      PICKUP_LOCATIONS: 'PickupLocations',
      DESTINATIONS: 'Destinations',
      ACTIVITIES: 'Activities',
      ITINERARIES: 'Itineraries',
      TRIP_HIGHLIGHTS: 'TripHighlights',
      ITINERARY_STEPS: 'ItinerarySteps',
      TRIP_FAQS: 'TripFAQs',
      TRIP_INCLUDES: 'TripIncludes',
      TRIP_EXCLUDES: 'TripExcludes',
      ADDONS: 'AddOns',
      TRIP_DETAILS: 'TripDetails',
      AI_CONTENT: 'AIContent',
      SUPPLIERS: 'Suppliers',
      PUBLISHING_SCHED: 'PublishingSchedule',
      EXTERNAL_SOURCES: 'ExternalSources',
      FIELD_MAPPINGS: 'FieldMappings',
      AUDIT_LOG: 'AuditLog'
    },

    DEFAULT_TRIP_LINK_FIELD: 'Trip',

    LINK_FIELDS: {
      TripHighlights: 'Trip',
      ItinerarySteps: 'Trip',
      TripFAQs: 'Trip',
      TripIncludes: 'Trip',
      TripExcludes: 'Trip',
      AddOns: 'Trip',
      PickupLocations: 'Trip',
      TripDetails: 'Trip',
      Packages: 'Trip',
      Prices: 'Trip',
      Images: 'SourceTrip'
    }
  }
}

module.exports = { getAppConfig }
