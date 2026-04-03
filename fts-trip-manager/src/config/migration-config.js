const MIGRATION_CONFIG = {
  OLD_BASE_ID: 'appTp5YgSp9DV2HYc',
  OLD_TABLE_NAME: "Product's",

  NEW_BASE_ID: 'apphGHAvy5IhAWVw9',

  TRIP_ID_PREFIX: '99',
  TRIP_ID_START: 9900001,
  TRIP_ID_PROPERTY_KEY: 'MIGRATION_LAST_TRIP_ID',

  TEST_BATCH_SIZE: 5,
  MAX_RECORDS_PER_RUN: 10,

  MIGRATION_STATUS_FIELD: 'Migrated',
  MARK_AS_MIGRATED: true,

  FIELD_MAP: {
    TRIPS: {
      'Trip Name': 'Title',
      Duration: 'Duration_Hours',
      Price: 'Price_From'
    },
    HIGHLIGHTS: {
      source: 'Highlights',
      targetTable: 'TripHighlights',
      targetField: 'Highlight'
    },
    ITINERARY: {
      source: 'Itinerary',
      targetTable: 'ItinerarySteps',
      targetField: 'StepDescription'
    },
    INCLUDES: {
      source: 'Includes',
      targetTable: 'TripIncludes',
      targetField: 'IncludeItem'
    },
    EXCLUDES: {
      source: 'Not Includes',
      targetTable: 'TripExcludes',
      targetField: 'ExcludeItem'
    },
    PACKAGES: {
      optionPrefix: 'Option ',
      pricePrefix: 'Price ',
      maxOptions: 10,
      targetTable: 'Packages'
    }
  },

  SPLIT_PATTERNS: {
    HIGHLIGHTS: /[\r\n]+|•|–|—|\d+\./,
    ITINERARY: /Day \d+|[\r\n]{2,}/i,
    INCLUDES: /[\r\n]+|•|–|—/,
    EXCLUDES: /[\r\n]+|•|–|—/
  },

  DEBUG: true,
  LOG_TABLE: 'AuditLog'
}

module.exports = { MIGRATION_CONFIG }

