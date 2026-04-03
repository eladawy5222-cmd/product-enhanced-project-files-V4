# Migration System - Usage Guide

## 📚 Overview

This migration system transfers trip data from your old Airtable base (`Product's` table) to the new WPTE Sync base with intelligent field mapping and custom TripID generation.

## 🎯 Key Features

- ✅ **Custom TripID**: Generates unique IDs starting with `99xxxxx` (9900001, 9900002, etc.)
- ✅ **Smart Field Mapping**: Automatically maps old fields to new structure
- ✅ **Text Splitting**: Converts multi-line text into separate records
- ✅ **Package Conversion**: Transforms Options 1-10 into proper Packages
- ✅ **Duplicate Prevention**: Checks for existing trips before creating
- ✅ **Comprehensive Logging**: Detailed logs for debugging

## 📁 Files Created

1. **`migration_config.gs`**: Configuration (Base IDs, field mappings)
2. **`migration_mapper.gs`**: Data transformation logic
3. **`migration_runner.gs`**: Main migration engine
4. **`migration_test.gs`**: Testing functions

## 🚀 How to Use

### Step 1: Upload to Google Apps Script

1. Open your Google Apps Script project
2. Upload all 4 migration files
3. Ensure `config.gs` and other existing files are present

### Step 2: Test Connection

Run this function to verify access to the old base:

```javascript
testFetchOldTrips()
```

**Expected Output:**
```
Testing connection to old base...
✅ Successfully fetched 3 records
First record fields:
  Trip Name: Hurghada Tour...
  Duration: Full day tour
  Price: $50
  ...
```

### Step 3: Test Field Mapping (Recommended)

Test the mapping without creating records:

```javascript
testMapSingleRecord()
```

**What it does:**
- Fetches 1 record from old base
- Shows original fields
- Shows mapped fields for new base
- Shows extracted highlights, packages, etc.
- **Does NOT create any records** (safe to run)
- Resets TripID counter after test

### Step 4: Migrate Single Trip (Trial)

Migrate just one trip to verify everything works:

```javascript
testMigrateSingleTrip()
```

**What it does:**
- Migrates the first trip from old base
- Creates all related records (highlights, packages, etc.)
- Shows detailed logs

**Verify in Airtable:**
- Check `Trips` table for new record with TripID `9900001`
- Check child tables for linked records

### Step 5: Migrate 5 Trips (As Requested)

Once you're satisfied with the test, run:

```javascript
testMigrateFiveTrips()
```

**Expected Output:**
```
========================================
STARTING MIGRATION
Max records: 5
========================================

--- Processing record 1/5 ---
Trip: Hurghada Tour
Generated TripID: 9900001
Creating Trips record...
Created Trips record: recXXXXXXXXXXXXXX
Creating 5 highlights...
Creating 3 itinerary steps...
Creating 8 includes...
Creating 4 excludes...
Creating 6 packages...
✅ Trip migration complete

[... repeats for 5 trips ...]

========================================
MIGRATION COMPLETE
Duration: 45.2 seconds
Total: 5
Success: 5
Failed: 0
========================================
```

### Step 6: Verify Results

Check your Airtable base:

1. **Trips Table**: Should have 5 new trips (TripID: 9900001-9900005)
2. **TripHighlights**: Linked highlights for each trip
3. **ItinerarySteps**: Linked itinerary steps
4. **TripIncludes/Excludes**: Linked items
5. **Packages**: Multiple packages per trip (from Options 1-10)

## 🔧 Utility Functions

### View Migration State

Check the current TripID counter:

```javascript
viewMigrationState()
```

### Reset Migration State

Reset TripID counter to start over (use with caution):

```javascript
resetMigrationState()
```

**Warning:** This resets the counter but does NOT delete migrated trips. You may get duplicate TripIDs if you run migration again.

### Run Full Migration

Migrate up to 10 records (configured max):

```javascript
runFullMigration()
```

## 📊 Field Mapping Reference

| Old Field | New Table | New Field | Notes |
|-----------|-----------|-----------|-------|
| Trip Name | Trips | Title | Direct copy |
| Duration | Trips | Duration_Hours | Extracts number |
| Price | Trips | Price_From | Extracts number |
| Overview | Trips | Trip_Description | Combined with Full description |
| Full description | Trips | Trip_Description | Appended to Overview |
| Highlights | TripHighlights | Highlight | Split by lines |
| Itinerary | ItinerarySteps | StepDescription | Split by days |
| Includes | TripIncludes | IncludeItem | Split by lines |
| Not Includes | TripExcludes | ExcludeItem | Split by lines |
| Option 1-10 | Packages | PackageTitle | One package per option |
| Price 1-10 | Packages | SalePrice | Linked to option |

## ⚠️ Important Notes

1. **TripID Format**: Always `99xxxxx` (7 digits)
2. **No Deletion**: Old base is never modified (read-only)
3. **Duplicate Check**: Skips trips that already exist
4. **API Limits**: Respects Airtable rate limits
5. **Logging**: All operations are logged for debugging

## 🐛 Troubleshooting

### Error: "Failed to fetch records from old base"

**Solution:** Check that:
- `MIGRATION_CONFIG.OLD_BASE_ID` is correct
- `CONFIG.AIRTABLE_API_KEY` has access to old base
- Table name `Product's` is correct (note the apostrophe)

### Error: "Failed to create Trips record"

**Solution:** Check that:
- Required fields in Trips table are not missing
- Field names match configuration
- You have write access to new base

### TripID Not Sequential

**Solution:** Run `viewMigrationState()` to check counter, or `resetMigrationState()` to reset.

## 📞 Support

If you encounter issues:

1. Check the logs (View → Logs in Apps Script)
2. Run `testMapSingleRecord()` to see field mapping
3. Verify field names in both bases match configuration
4. Check API key permissions

## 🎉 Next Steps

After successful migration:

1. Review migrated trips in Airtable
2. Initialize AI enhancement pipeline if needed
3. Migrate remaining trips (adjust `MAX_RECORDS_PER_RUN`)
4. Archive or keep old base as backup
