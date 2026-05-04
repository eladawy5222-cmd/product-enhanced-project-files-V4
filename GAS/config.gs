/************************************************************
 * CONFIGURATION FILE — WPTE → Airtable Sync
 * This file is the single source of truth for IDs & settings.
 * We are continuing on the EXISTING "WPTE Sync" base schema.
 ************************************************************/

var CONFIG = {
  
  /********************* WORDPRESS API ************************/
  // TODO: ضع هنا الـ endpoint الفعلي اللي بيرجع رحلات WPTE JSON
  WP_API_BASE: "https://ftstravels.com/wp-json/fts/v1",   // مثال، عدّل حسب رابطك الصحيح
  WP_API_URL_SINGLE: "https://ftstravels.com/wp-json/fts/v1/trip", // Endpoint for single trip
  WP_API_USER: "",   // Script Properties: WP_API_USER
  WP_API_PASS: "",   // Script Properties: WP_API_PASS
  WP_PER_PAGE: 20,   // أو أي رقم يناسبك (10, 20, 50...)

  /********************** AIRTABLE API ************************/
  // IMPORTANT: This must be your personal Airtable API key (v0)
  AIRTABLE_API_KEY: "", // Script Properties: AIRTABLE_API_KEY

  // We are using the "WPTE Sync" base:
  // Base ID from schema: apphGHAvy5IhAWVw9
  AIRTABLE_BASE_ID: "apphGHAvy5IhAWVw9",

  /********************* TABLE NAMES **************************/
  // All table names are taken EXACTLY from your current schema.
  // We are NOT creating new tables, just filling/using existing ones.
  TABLES: {
    // Core content
    TRIPS:             "Trips",
    PACKAGES:          "Packages",
    IMAGES:            "Images",
    PRICES:            "Prices",
    PICKUP_LOCATIONS:  "PickupLocations",
    DESTINATIONS:      "Destinations",
    ACTIVITIES:        "Activities",
    ITINERARIES:       "Itineraries",

    // AI / content structure tables
    TRIP_HIGHLIGHTS:   "TripHighlights",
    ITINERARY_STEPS:   "ItinerarySteps",
    TRIP_FAQS:         "TripFAQs",
    TRIP_INCLUDES:     "TripIncludes",
    TRIP_EXCLUDES:     "TripExcludes",
    ADDONS:            "AddOns",
    TRIP_DETAILS:      "TripDetails",
    AI_CONTENT:        "AIContent",

    // Meta / management tables
    SUPPLIERS:         "Suppliers",
    PUBLISHING_SCHED:  "PublishingSchedule",
    EXTERNAL_SOURCES:  "ExternalSources",
    FIELD_MAPPINGS:    "FieldMappings",
    AUDIT_LOG:         "AuditLog"
  },

  /********************* COMMON LINK FIELDS *******************/
  // Many of the child tables use a field called "Trip" to link
  // back to the main Trips table. Some use other names like
  // "Trips" or "SourceTrip". We'll handle exceptions in code,
  // but this is the default.
  DEFAULT_TRIP_LINK_FIELD: "Trip",

  // Exceptions (field names that link back to Trips for each table)
  LINK_FIELDS: {
    TripHighlights:   'Trip',
    ItinerarySteps:   'Trip',
    TripFAQs:         'Trip',
    TripIncludes:     'Trip',
    TripExcludes:     'Trip',
    AddOns:           'Trip',
    PickupLocations:  'Trip',
    TripDetails:      'Trip',
    Packages:         'Trip',
    Prices:           'Trip',
    Images:           'SourceTrip'   // 👈 مهم عشان جدول Images بيستخدم SourceTrip
  // باقي الجداول الإدارية هنستخدمها لاحقًا لو احتجنا
  },

  /********************* SYNC LIMITS ***************************/
  SYNC: {
  MAX_TRIPS_PER_RUN: 1,
  MAX_TRIPS_PER_DAY: 5,
  MAX_RUNTIME_MS: 2 * 60 * 1000
},

  /********************* LOGGING *******************************/
  DEBUG: true
};

function loadConfigSecrets_() {
  if (CONFIG && CONFIG.__secretsLoaded) return;
  var props = PropertiesService.getScriptProperties();
  CONFIG.WP_API_USER = CONFIG.WP_API_USER || props.getProperty('WP_API_USER') || '';
  CONFIG.WP_API_PASS = CONFIG.WP_API_PASS || props.getProperty('WP_API_PASS') || '';
  CONFIG.AIRTABLE_API_KEY = CONFIG.AIRTABLE_API_KEY || props.getProperty('AIRTABLE_API_KEY') || '';
  CONFIG.__secretsLoaded = true;
}
