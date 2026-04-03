# TREA Feedback #15 — Missing `await` in updater.js (Breaks Translations + Image Localization)

## Problem
Three async function calls in `updater.js` are missing `await`, causing:
1. Image metadata translation not working
2. New translation posts getting Promise objects instead of WordPress IDs
3. Packages not linking to translated posts

## Fixes Required (3 lines)

### Fix 1: Line 801 — `getTripInfoFromWpCached_Updater_` 🔴 CRITICAL
```javascript
// CURRENT (broken):
sourceTripInfoFromWp = getTripInfoFromWpCached_Updater_(primaryWpId);

// FIXED:
sourceTripInfoFromWp = await getTripInfoFromWpCached_Updater_(primaryWpId);
```
**Impact:** Without await, `sourceTripInfoFromWp` is a Promise, not the actual trip data. This breaks:
- Translation map extraction (line 802-806)
- Image clone (line 870+)
- Image metadata localization (line 1023-1032)
- Schema generation for translations

### Fix 2: Line 999 — `createNewTripOnWordPress_Updater_` 🔴 CRITICAL
```javascript
// CURRENT (broken):
transWpId = createNewTripOnWordPress_Updater_(translatedPayload);

// FIXED:
transWpId = await createNewTripOnWordPress_Updater_(translatedPayload);
```
**Impact:** Without await, `transWpId` is a Promise, not a WordPress post ID. This breaks:
- Translation linking (`newTranslationIds[targetLang]` stores a Promise)
- Package publishing for translations (line 1008)
- Schema generation for translations (line 1013)
- Image metadata localization (line 1023)
- Translation_Map stored in Airtable will contain `[object Promise]`

### Fix 3: Line 1008 — `publishPackagesSafe_Updater_` 🟡 HIGH
```javascript
// CURRENT (broken):
publishPackagesSafe_Updater_(tripId, transWpId, { lang: targetLang, skipAirtableSync: true, tripTitle: imageTripTitleForLang });

// FIXED:
await publishPackagesSafe_Updater_(tripId, transWpId, { lang: targetLang, skipAirtableSync: true, tripTitle: imageTripTitleForLang });
```
**Impact:** Without await, packages are published in the background without waiting — if the next operation depends on packages being ready, it will fail silently.

## File
`src/publish/updater.js` — Lines 801, 999, 1008

## How These Were Missed
In GAS, all functions are synchronous (UrlFetchApp blocks). When converting to Node.js async/await, these three calls were missed. The rest of the file correctly uses `await`.
