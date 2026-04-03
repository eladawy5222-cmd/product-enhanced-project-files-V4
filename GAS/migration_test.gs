/************************************************************
 * MIGRATION TESTING
 * Functions to test and run the migration
 ************************************************************/

/**
 * Test: Fetch records from old base
 */
function testFetchOldTrips() {
  Logger.log('Testing connection to old base...');
  
  try {
    var records = fetchOldTrips_(3);
    Logger.log('✅ Successfully fetched ' + records.length + ' records');
    
    if (records.length > 0) {
      Logger.log('\nFirst record fields:');
      var firstRecord = records[0];
      var fields = firstRecord.fields || {};
      
      for (var key in fields) {
        if (fields.hasOwnProperty(key)) {
          var value = fields[key];
          if (typeof value === 'string' && value.length > 100) {
            value = value.substring(0, 100) + '...';
          }
          Logger.log('  ' + key + ': ' + value);
        }
      }
    }
    
    return records;
    
  } catch (err) {
    Logger.log('❌ Error: ' + err.message);
    throw err;
  }
}

/**
 * Test: Migrate a single trip (first record)
 */
function testMigrateSingleTrip() {
  Logger.log('Testing single trip migration...');
  
  try {
    var records = fetchOldTrips_(1);
    
    if (!records.length) {
      Logger.log('No records found to migrate');
      return;
    }
    
    var oldRecord = records[0];
    var tripName = (oldRecord.fields && oldRecord.fields['Trip Name']) || 'Unknown';
    
    Logger.log('Migrating trip: ' + tripName);
    migrateSingleTrip_(oldRecord);
    
    Logger.log('✅ Single trip migration test complete');
    
  } catch (err) {
    Logger.log('❌ Error: ' + err.message);
    throw err;
  }
}

/**
 * Test: Migrate 5 trips as requested
 */
function testMigrateFiveTrips() {
  Logger.log('Migrating 5 trips for testing...');
  
  try {
    var results = migrateTrips_(5);
    
    Logger.log('\n📊 RESULTS:');
    Logger.log('Total: ' + results.total);
    Logger.log('Success: ' + results.success);
    Logger.log('Failed: ' + results.failed);
    
    return results;
    
  } catch (err) {
    Logger.log('❌ Error: ' + err.message);
    throw err;
  }
}

/**
 * View current migration state
 */
function viewMigrationState() {
  var currentId = getCurrentTripID_();
  
  Logger.log('========================================');
  Logger.log('MIGRATION STATE');
  Logger.log('========================================');
  
  if (currentId) {
    Logger.log('Last TripID used: ' + currentId);
    Logger.log('Next TripID will be: ' + (currentId + 1));
  } else {
    Logger.log('No trips migrated yet');
    Logger.log('Next TripID will be: ' + MIGRATION_CONFIG.TRIP_ID_START);
  }
  
  Logger.log('========================================');
}

/**
 * Reset migration state (for testing)
 */
function resetMigrationState() {
  Logger.log('⚠️  Resetting migration state...');
  resetTripIDCounter_();
  Logger.log('✅ Migration state reset');
  viewMigrationState();
}

/**
 * Test: Map a single record without creating it
 */
function testMapSingleRecord() {
  Logger.log('Testing field mapping...');
  
  try {
    var records = fetchOldTrips_(1);
    
    if (!records.length) {
      Logger.log('No records found');
      return;
    }
    
    var oldRecord = records[0];
    var tripName = (oldRecord.fields && oldRecord.fields['Trip Name']) || 'Unknown';
    
    Logger.log('Mapping trip: ' + tripName);
    Logger.log('\n--- OLD RECORD ---');
    Logger.log(JSON.stringify(oldRecord.fields, null, 2));
    
    var mapped = mapOldTripToNew_(oldRecord);
    
    Logger.log('\n--- NEW MAPPED FIELDS ---');
    Logger.log('TripID: ' + mapped.tripId);
    Logger.log(JSON.stringify(mapped.fields, null, 2));
    
    // Test child extractions
    Logger.log('\n--- HIGHLIGHTS ---');
    var highlights = extractHighlightsFromOld_(oldRecord.fields['Highlights'], mapped.tripId);
    Logger.log('Count: ' + highlights.length);
    if (highlights.length) {
      Logger.log(JSON.stringify(highlights, null, 2));
    }
    
    Logger.log('\n--- PACKAGES ---');
    var packages = extractPackagesFromOld_(oldRecord, mapped.tripId);
    Logger.log('Count: ' + packages.length);
    if (packages.length) {
      Logger.log(JSON.stringify(packages, null, 2));
    }
    
    // Reset the TripID counter since we're just testing
    resetTripIDCounter_();
    
    Logger.log('\n✅ Mapping test complete (TripID counter reset)');
    
  } catch (err) {
    Logger.log('❌ Error: ' + err.message);
    throw err;
  }
}

/**
 * Run full migration (use with caution)
 */
function runFullMigration() {
  var maxRecords = MIGRATION_CONFIG.MAX_RECORDS_PER_RUN;
  
  Logger.log('⚠️  Running full migration with max ' + maxRecords + ' records');
  Logger.log('Press Ctrl+C to cancel if this was a mistake...');
  
  Utilities.sleep(3000); // 3 second delay to allow cancellation
  
  var results = migrateTrips_(maxRecords);
  
  Logger.log('\n✅ Full migration complete');
  return results;
}
