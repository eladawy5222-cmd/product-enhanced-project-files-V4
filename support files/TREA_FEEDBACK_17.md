# TREA Feedback #17 — TripCode Override Bug in updater.js (New Trip Creation)

## Problem
When creating a NEW trip on WordPress (`!wpId` branch), the code unconditionally generates a random `TRIP-XXXXXXXX` code and overwrites `payload.meta.trip_code` — even when the trip already has a valid TripCode from Airtable (e.g. `WTE-26144`).

## Evidence
WordPress API response for trip 26144:
```
GET https://ftstravels.com/wp-json/fts/v1/trip/26144

general.trip_code = "TRIP-53A1824C"   ← WRONG (random code)
meta.trip_code    = "TRIP-53A1824C"   ← WRONG (random code)
```

Expected: `WTE-26144` (the value from Airtable `Trips.TripCode` field)

## Root Cause
In `src/publish/updater.js`, the `mapAirtableToWordPress_Updater_()` function correctly sets TripCode in TWO places:

1. **Line ~1655**: `payload.general.trip_code = tripFields.TripCode || ''` → sets `"WTE-26144"` ✅
2. **Line ~1812**: `payload.meta.trip_code = tripFields.TripCode` → sets `"WTE-26144"` ✅

But then in `runUpdaterBatch()`, the new-trip creation block **overwrites** it:

```javascript
// Line ~754-758 (CURRENT — BROKEN):
if (!wpId) {
    log('Updater: Creating NEW trip on WordPress for Airtable Trip ' + tripId);
    var newTripCode = 'TRIP-' + getUuid().slice(0, 8).toUpperCase();
    payload.meta = payload.meta || {};
    payload.meta.trip_code = newTripCode;    // ← OVERWRITES the correct value!
    ...
}
```

The `mapAirtableToWordPress_Updater_()` runs BEFORE this block and sets the correct value, but this block blindly replaces it with a random code.

## The Fix
Only generate a random TripCode if the trip doesn't already have one from Airtable:

```javascript
// Line ~754-761 (FIXED):
if (!wpId) {
    log('Updater: Creating NEW trip on WordPress for Airtable Trip ' + tripId);
    payload.meta = payload.meta || {};
    // Only generate a new TripCode if Airtable doesn't already have one
    if (!payload.meta.trip_code && !f.TripCode) {
      var newTripCode = 'TRIP-' + getUuid().slice(0, 8).toUpperCase();
      payload.meta.trip_code = newTripCode;
    }
    payload.core = payload.core || {};
    payload.core.status = 'publish';
    ...
}
```

## Why This Fix Works
- `payload.meta.trip_code` is already set by `mapAirtableToWordPress_Updater_()` if `tripFields.TripCode` exists (line ~1812)
- `f.TripCode` is the raw Airtable field value (double-check)
- If BOTH are empty/null, it falls back to generating a random code (preserving original behavior for trips with no TripCode)
- If either has a value, the existing TripCode is preserved

## Files to Change
- `src/publish/updater.js` — lines ~754-758 in the `if (!wpId)` block inside `runUpdaterBatch()`

## Impact
ALL migrated trips (TripID starting with 99xxxxx) and any trip with a TripCode in Airtable will now correctly send their TripCode to WordPress instead of getting a random one.
