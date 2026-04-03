# TREA Feedback #10 — `getOrCreateActive()` Missing `tripPublicId` Passthrough

## Problem
In `src/ai/enhancement-helpers.js`, the `getOrCreateActive()` function receives `tripPublicId` in its options but does NOT pass it to `fetchImprovementRecordForTrip()`. This means the linked record lookup still only searches by Record ID, which fails because `ARRAYJOIN({Trip})` returns the TripID number, not the Record ID.

## Current Code (line ~75):
```javascript
const rec = await fetchImprovementRecordForTrip({
    tripRecordId,
    directRecordId: directId || null,
    tableName,
    tripLinkField
})
```

## Fixed Code:
```javascript
const tripPublicId = o.tripPublicId || (tripFields && tripFields.TripID ? String(tripFields.TripID) : null)
const tripName = o.tripName || (tripFields && tripFields.Title ? String(tripFields.Title) : null)

const rec = await fetchImprovementRecordForTrip({
    tripRecordId,
    tripPublicId,
    tripName,
    directRecordId: directId || null,
    tableName,
    tripLinkField
})
```

## Also Fix: Second `getOrCreateActive` call in `orchestrator.js`

The second call (around line 223 in `progressTripPipeline_`) does not pass `tripPublicId`:

```javascript
// CURRENT (missing tripPublicId):
const imp = await ImprovementRepository.getOrCreateActive({
    tripRecordId: tripId,
    tripFields: f,
    tableName: 'Improvement With AI',
    tripLinkField: 'Trip',
    initialFields: { AI_SEO_Status: 'Pending', AI_Status: 'Waiting' }
});

// FIXED (add tripPublicId and tripName):
const imp = await ImprovementRepository.getOrCreateActive({
    tripRecordId: tripId,
    tripFields: f,
    tripPublicId: f.TripID || '',
    tripName: f.Title || '',
    tableName: 'Improvement With AI',
    tripLinkField: 'Trip',
    initialFields: { AI_SEO_Status: 'Pending', AI_Status: 'Waiting' }
});
```

## Files to Change
1. `src/ai/enhancement-helpers.js` — `getOrCreateActive()` must extract and pass `tripPublicId` + `tripName` to `fetchImprovementRecordForTrip()`
2. `src/ai/orchestrator.js` — second `getOrCreateActive` call (~line 223) must include `tripPublicId` and `tripName`
