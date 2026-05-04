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
