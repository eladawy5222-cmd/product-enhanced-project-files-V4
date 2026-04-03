# TREA Feedback #9 — CRITICAL: Linked Record Lookups Fail Across Entire Project

## Problem
Almost ALL Airtable lookups for linked records (child tables like "Improvement With AI", "Highlights Improvement With AI", "Itinerary Improvement With AI", "TripFacts Improvement With AI", etc.) **fail silently** because the code searches by `tripRecordId` (Airtable Record ID like `recstfS5va75ZPQN3`) but `ARRAYJOIN({Trip})` returns the **display value** (TripID number like `7411`), not the Record ID.

## Evidence
```
Found 1 trip(s) with active pipelines
❌ No Improvement record found for Trip recstfS5va75ZPQN3
```

The formula `FIND('recstfS5va75ZPQN3', ARRAYJOIN({Trip}))` returns 0 results because `ARRAYJOIN({Trip})` outputs `"7411"` (the primary field / display name of the linked record), not the Record ID.

## Root Cause
In the GAS original, `fetchRecordsByTrip_` (in `context_utils.gs`) used a **multi-strategy OR lookup**:

```javascript
// GAS ORIGINAL — context_utils.gs fetchRecordsByTrip_()
var conditions = [];

// Strategy 1: Search by Record ID
conditions.push("FIND('" + tripId + "', ARRAYJOIN({" + linkField + "}))");

// Strategy 2: Search by TripID number (the public ID like 7411)
if (tripNumber) {
  conditions.push("FIND('" + tripNumber + "', ARRAYJOIN({" + linkField + "}))");
}

// Strategy 3: Search by Trip Name
if (tripName) {
  conditions.push("FIND('" + safeName + "', ARRAYJOIN({" + linkField + "}))");
}

// Strategy 4: Fallback direct field (e.g., TripID field in child table)
if (tripIdField && tripNumber) {
  conditions.push("{" + tripIdField + "} = '" + tripNumber + "'");
}

var formula = "OR(" + conditions.join(", ") + ")";
```

This works because even if `ARRAYJOIN({Trip})` doesn't contain the Record ID, it WILL contain the TripID number.

**In the converted code**, most lookups only pass `tripRecordId` and never pass `tripPublicId`/`tripNumber`. The `fetchRecordsByTrip_` equivalent in `context-utils.js` and `enhancement-helpers.js` only gets the Record ID, so the OR condition only has one strategy that doesn't match.

## The Fix — Project-Wide

### 1. Every function that looks up child records MUST pass BOTH `tripRecordId` AND `tripPublicId` (TripID number)

The `tripPublicId` is available from `tripFields.TripID` in every context where trips are processed. For example, in `orchestrator.js`:

```javascript
// CURRENT (broken):
const improvementRec = await findImprovementRecordForTrip_(tripId)

// FIXED:
const tripNumber = f.TripID || ''  // f = trip.fields (already available)
const improvementRec = await findImprovementRecordForTrip_(tripId, tripNumber)
```

And `findImprovementRecordForTrip_` should pass both:
```javascript
async function findImprovementRecordForTrip_(tripId, tripNumber) {
  const rec = await ImprovementRepository.fetchImprovementRecordForTrip({
    tripRecordId: tripId,
    tripPublicId: tripNumber || '',  // ← ADD THIS
    tableName: 'Improvement With AI',
    tripLinkField: 'Trip'
  });
  // ...
}
```

### 2. The shared `fetchRecordsByTrip_` in `context-utils.js` must match the GAS original pattern

Compare the GAS original (`context_utils.gs` lines 1-49) with the converted `context-utils.js` and ensure:
- It receives `tripId` (Record ID), `tripNumber` (public TripID), and `tripName`
- It builds an OR formula with ALL available strategies
- It includes the `TABLE_LINK_FIELD_MAP` and `TABLE_TRIPID_FALLBACK_MAP` configurations

### 3. Files to audit and fix

Every file that queries child/linked tables needs to pass `tripPublicId`/`tripNumber` alongside `tripRecordId`:

**Core lookup functions:**
- `src/ai/enhancement-helpers.js` — `fetchImprovementRecordForTrip()`, `getOrCreateActive()`
- `src/ai/context-utils.js` — `fetchRecordsByTrip_()`
- `src/ai/orchestrator.js` — `findImprovementRecordForTrip_()`

**All enhancers (they all have `fetchRecordsByTrip_` calls):**
- `src/ai/seo-enhancer.js`
- `src/ai/content-enhancer.js`
- `src/ai/addons-enhancer.js`
- `src/ai/highlights-enhancer.js`
- `src/ai/itinerary-enhancer.js`
- `src/ai/inc-exc-enhancer.js`
- `src/ai/trip-facts-enhancer.js`
- `src/ai/faqs-enhancer.js`
- `src/ai/images-enhancer.js`

**Publish modules:**
- `src/publish/publisher.js`
- `src/publish/updater.js`

### 4. How to get `tripNumber` everywhere

In every batch function, trips are fetched from Airtable with `tripRec.fields`. The TripID number is always at `tripRec.fields.TripID`. Pass it through to every child lookup.

Example pattern in each enhancer's batch function:
```javascript
// Current:
const tripId = tripRec.id;
const tripFields = tripRec.fields || {};

// Add:
const tripNumber = tripFields.TripID || '';

// Then pass tripNumber to every fetchRecordsByTrip_ / findImprovementRecordForTrip_ call
```

### 5. Verify with this test

After fixing, run "Run Full Pipeline Check" on a trip. The logs should show:
```
✅ Found Improvement record for Trip recXXX
```
Instead of:
```
❌ No Improvement record found for Trip recXXX
```

## Summary
This is not a single-file fix — it's a **systemic issue** where the converted code lost the multi-strategy lookup pattern from the GAS original. Every linked record query in the project needs to support lookup by BOTH Record ID and TripID number.
