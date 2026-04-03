/************************************************************
 * MIGRATION CONFIGURATION
 * Settings for migrating trips from old Airtable base to new base
 ************************************************************/

var MIGRATION_CONFIG = {
  
  /********************* OLD BASE (SOURCE) *********************/
  OLD_BASE_ID: 'appTp5YgSp9DV2HYc',
  OLD_TABLE_NAME: "Product's",
  
  /********************* NEW BASE (TARGET) *********************/
  // Uses same base as CONFIG.AIRTABLE_BASE_ID
  NEW_BASE_ID: 'apphGHAvy5IhAWVw9',
  
  /********************* TRIP ID GENERATION ********************/
  // TripID format: 99xxxxx (starts at 9900001)
  TRIP_ID_PREFIX: '99',
  TRIP_ID_START: 9900001,
  TRIP_ID_PROPERTY_KEY: 'MIGRATION_LAST_TRIP_ID',
  
  /********************* MIGRATION LIMITS **********************/
  TEST_BATCH_SIZE: 5,  // Number of records to migrate for testing
  MAX_RECORDS_PER_RUN: 10,
  
  /********************* MIGRATION STATUS TRACKING *************/
  // Field in old base to mark migrated trips (prevents duplicates)
  MIGRATION_STATUS_FIELD: 'Migrated',  // Checkbox field in old base
  MARK_AS_MIGRATED: true,  // Set to true to update old base after migration
  
  /********************* FIELD MAPPINGS ************************/
  // Map old field names to new field names
  FIELD_MAP: {
    // Main Trips table
    TRIPS: {
      'Trip Name': 'Title',
      'Duration': 'Duration_Hours',
      'Price': 'Price_From'
      // Note: Overview and Full description are combined into Trip_Description in mapper
      // Destinations will be skipped for now (can be added to schema later)
    },
    
    // Child tables - these will be split from text
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
    
    // Packages - from Option 1-10 + Price 1-10
    PACKAGES: {
      optionPrefix: 'Option ',
      pricePrefix: 'Price ',
      maxOptions: 10,
      targetTable: 'Packages'
    }
  },
  
  /********************* TEXT SPLITTING ************************/
  // How to split multi-line text into separate records
  SPLIT_PATTERNS: {
    // Split by newlines or bullet points
    HIGHLIGHTS: /[\r\n]+|•|–|—|\d+\./,
    ITINERARY: /Day \d+|[\r\n]{2,}/i,
    INCLUDES: /[\r\n]+|•|–|—/,
    EXCLUDES: /[\r\n]+|•|–|—/
  },
  
  /********************* LOGGING *******************************/
  DEBUG: true,
  LOG_TABLE: 'AuditLog'  // Optional: log migration activities
};
