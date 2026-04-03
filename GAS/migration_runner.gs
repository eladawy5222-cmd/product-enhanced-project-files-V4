/************************************************************
 * MIGRATION RUNNER
 * Main logic to fetch from old base and write to new base
 ************************************************************/

/**
 * Fetch records from old Airtable base
 */
function fetchOldTrips_(maxRecords) {
  var baseId = MIGRATION_CONFIG.OLD_BASE_ID;
  var tableName = MIGRATION_CONFIG.OLD_TABLE_NAME;
  var apiKey = CONFIG.AIRTABLE_API_KEY;
  
  var url = 'https://api.airtable.com/v0/' + encodeURIComponent(baseId) + 
            '/' + encodeURIComponent(tableName);
  
  // Build query parameters
  var params = [];
  
  if (maxRecords) {
    params.push('maxRecords=' + maxRecords);
  }
  
  // Filter: only fetch trips that are NOT migrated yet
  if (MIGRATION_CONFIG.MARK_AS_MIGRATED) {
    var statusField = MIGRATION_CONFIG.MIGRATION_STATUS_FIELD;
    // Filter formula: NOT({Migrated}) - only get unchecked records
    var formula = 'NOT({' + statusField + '})';
    params.push('filterByFormula=' + encodeURIComponent(formula));
  }
  
  if (params.length) {
    url += '?' + params.join('&');
  }
  
  var headers = {
    'Authorization': 'Bearer ' + apiKey,
    'Content-Type': 'application/json'
  };
  
  if (MIGRATION_CONFIG.DEBUG) {
    Logger.log('Fetching from old base: ' + url);
  }
  
  var response = httpGetJson(url, headers);
  
  if (!response || !response.records) {
    throw new Error('Failed to fetch records from old base');
  }
  
  if (MIGRATION_CONFIG.DEBUG) {
    Logger.log('Fetched ' + response.records.length + ' unmigrated records from old base');
  }
  
  return response.records;
}

/**
 * Main migration function - migrate trips from old to new base
 */
function migrateTrips_(maxRecords) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    Logger.log('migrateTrips_: lock busy, skipping');
    return;
  }

  try {
  loadConfigSecrets_();
  maxRecords = maxRecords || MIGRATION_CONFIG.TEST_BATCH_SIZE;
  
  Logger.log('========================================');
  Logger.log('STARTING MIGRATION');
  Logger.log('Max records: ' + maxRecords);
  Logger.log('========================================');
  
  var startTime = new Date();
  var results = {
    total: 0,
    success: 0,
    failed: 0,
    errors: []
  };
  
  try {
    // 1. Fetch records from old base
    var oldRecords = fetchOldTrips_(maxRecords);
    results.total = oldRecords.length;
    
    if (!oldRecords.length) {
      Logger.log('No records to migrate');
      return results;
    }
    
    // 2. Process each record
    for (var i = 0; i < oldRecords.length; i++) {
      var oldRecord = oldRecords[i];
      
      try {
        Logger.log('\n--- Processing record ' + (i + 1) + '/' + oldRecords.length + ' ---');
        
        // Get trip name for logging
        var tripName = (oldRecord.fields && oldRecord.fields['Trip Name']) || 'Unknown';
        Logger.log('Trip: ' + tripName);
        
        // Migrate this single trip
        migrateSingleTrip_(oldRecord);
        
        results.success++;
        Logger.log('✅ Successfully migrated: ' + tripName);
        
      } catch (err) {
        results.failed++;
        var errorMsg = 'Failed to migrate record ' + (i + 1) + ': ' + err.message;
        Logger.log('❌ ' + errorMsg);
        results.errors.push(errorMsg);
      }
    }
    
  } catch (err) {
    Logger.log('❌ Migration failed: ' + err.message);
    results.errors.push('Fatal error: ' + err.message);
  }
  
  // 3. Summary
  var endTime = new Date();
  var duration = (endTime - startTime) / 1000;
  
  Logger.log('\n========================================');
  Logger.log('MIGRATION COMPLETE');
  Logger.log('Duration: ' + duration + ' seconds');
  Logger.log('Total: ' + results.total);
  Logger.log('Success: ' + results.success);
  Logger.log('Failed: ' + results.failed);
  if (results.errors.length) {
    Logger.log('Errors:');
    results.errors.forEach(function(err) {
      Logger.log('  - ' + err);
    });
  }
  Logger.log('========================================');
  
  return results;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Migrate a single trip record
 */
function migrateSingleTrip_(oldRecord) {
  // 1. Map main trip fields
  var mapped = mapOldTripToNew_(oldRecord);
  var tripId = mapped.tripId;
  var tripFields = mapped.fields;
  
  Logger.log('Generated TripID: ' + tripId);
  
  // 2. Check if trip already exists
  var existingRecordId = AirtableUtils.getTripRecordIdByTripID(tripId);
  if (existingRecordId) {
    Logger.log('⚠️  Trip ' + tripId + ' already exists (Record: ' + existingRecordId + '). Skipping.');
    return;
  }
  
  // 3. Create main Trips record
  Logger.log('Creating Trips record...');
  var tripRecordId = createTripRecord_(tripFields);
  
  if (!tripRecordId) {
    throw new Error('Failed to create Trips record');
  }
  
  Logger.log('Created Trips record: ' + tripRecordId);
  
  // 4. Create child records
  var fields = oldRecord.fields || {};
  
  // Highlights
  var highlights = extractHighlightsFromOld_(fields['Highlights'], tripId);
  if (highlights.length) {
    Logger.log('Creating ' + highlights.length + ' highlights...');
    replaceChildRecordsForTrip_('TripHighlights', highlights, tripId, tripRecordId);
  }
  
  // Itinerary
  var itinerary = extractItineraryFromOld_(fields['Itinerary'], tripId);
  if (itinerary.length) {
    Logger.log('Creating ' + itinerary.length + ' itinerary steps...');
    replaceChildRecordsForTrip_('ItinerarySteps', itinerary, tripId, tripRecordId);
  }
  
  // Includes
  var includes = extractIncludesFromOld_(fields['Includes'], tripId);
  if (includes.length) {
    Logger.log('Creating ' + includes.length + ' includes...');
    replaceChildRecordsForTrip_('TripIncludes', includes, tripId, tripRecordId);
  }
  
  // Excludes
  var excludes = extractExcludesFromOld_(fields['Not Includes'], tripId);
  if (excludes.length) {
    Logger.log('Creating ' + excludes.length + ' excludes...');
    replaceChildRecordsForTrip_('TripExcludes', excludes, tripId, tripRecordId);
  }
  
  // Packages
  var packages = extractPackagesFromOld_(oldRecord, tripId);
  if (packages.length) {
    Logger.log('Creating ' + packages.length + ' packages...');
    replaceChildRecordsForTrip_('Packages', packages, tripId, tripRecordId);
  }
  
  // 5. Initialize AI enhancement pipeline
  Logger.log('Initializing AI enhancement pipeline...');
  if (tripRecordId && typeof initializeEnhancementPipeline_ === 'function') {
    initializeEnhancementPipeline_(tripRecordId);
    Logger.log('✅ Trip migration complete and pipeline initialized');
  } else {
    Logger.log('✅ Trip migration complete (pipeline initialization skipped)');
  }
  
  // 6. Mark as migrated in old base (to prevent re-migration)
  if (MIGRATION_CONFIG.MARK_AS_MIGRATED) {
    markTripAsMigrated_(oldRecord.id, tripId);
  }
}

/**
 * Mark trip as migrated in old base
 */
function markTripAsMigrated_(oldRecordId, tripId) {
  if (!oldRecordId) {
    Logger.log('⚠️  Cannot mark as migrated: missing old record ID');
    return;
  }
  
  try {
    var baseId = MIGRATION_CONFIG.OLD_BASE_ID;
    var tableName = MIGRATION_CONFIG.OLD_TABLE_NAME;
    var apiKey = CONFIG.AIRTABLE_API_KEY;
    var statusField = MIGRATION_CONFIG.MIGRATION_STATUS_FIELD;
    
    var url = 'https://api.airtable.com/v0/' + encodeURIComponent(baseId) + 
              '/' + encodeURIComponent(tableName) + '/' + encodeURIComponent(oldRecordId);
    
    var headers = {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    };
    
    var body = {
      fields: {}
    };
    body.fields[statusField] = true;  // Check the checkbox
    
    var response = httpPatchJson(url, headers, body);
    
    if (MIGRATION_CONFIG.DEBUG) {
      Logger.log('✅ Marked trip ' + tripId + ' as migrated in old base');
    }
    
  } catch (err) {
    Logger.log('⚠️  Failed to mark trip as migrated in old base: ' + err.message);
    // Don't throw - migration was successful, this is just a tracking issue
  }
}

/**
 * Create a Trips record and return its record ID
 */
function createTripRecord_(fields) {
  var created = airtableCreate_('Trips', fields);
  
  if (created && created.id) {
    return created.id;
  }
  
  // Fallback: query by TripID
  if (fields.TripID) {
    var formula = '({TripID} = "' + AirtableUtils.escapeFormulaValue(fields.TripID) + '")';
    var result = airtableGet_('Trips', {
      filterByFormula: formula,
      maxRecords: 1
    });
    
    if (result.records && result.records.length) {
      return result.records[0].id;
    }
  }
  
  return null;
}

