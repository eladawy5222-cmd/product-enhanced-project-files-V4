# TREA Feedback #18 — Slug Preservation Bug in updater.js / updater.gs

## Problem
When the Updater pushes content to WordPress, it regenerates slugs from AI-enhanced SEO data (`AI_SEO_Permalink`) or trip titles — even for trips that already have published slugs on WordPress. This overwrites existing permalinks, breaking:
- **Backlinks** from external sites and partners
- **SEO rankings** built over months/years of indexing
- **Indexed URLs** in Google, Bing, and other search engines
- **Bookmarks** saved by users

The problem affects BOTH primary trips (English) and ALL translations (de, es, fr, ro, ru, tr, zh-hans).

## Root Cause
`mapAirtableToWordPress_Updater_()` (line ~1430 in GAS, ~1530 in JS) always sets `payload.core.slug` from either:
1. `tripFields.Slug` (Airtable Slug field)
2. `g.AI_SEO_Permalink` (AI-generated slug)
3. A sanitized version of `payload.core.title`

For translations, the AI translation stage also generates localized slugs (e.g. `sanitizeTranslatedSlug_(assets.slug)`), overwriting whatever the translation already has on WordPress.

**Neither path checks whether the trip already has a live slug on WordPress.** So every update cycle regenerates and overwrites the slug.

## Evidence
WordPress API confirms WPML creates language-specific slugs:
```
GET https://ftstravels.com/wp-json/fts/v1/trip/26144
→ core.slug = "nile-cruise-trip-from-luxor-5-days"

GET https://ftstravels.com/wp-json/fts/v1/trip/29098  (French)
→ core.slug = "croisiere-sur-le-nil-depuis-louxor-5-jours"

GET https://ftstravels.com/wp-json/fts/v1/trip/29095  (German)
→ core.slug = "nilkreuzfahrt-ab-luxor-5-tage"
```

Each language has a unique, SEO-optimized, human-readable slug. Overwriting these with AI-generated slugs destroys established permalink structure.

## The Fix

### Fix 1: Primary Trip Slug Preservation
After building the payload, check if the trip already exists on WP and preserve its slug:

**updater.js** (after `mapAirtableToWordPress_Updater_` call, before `if (!wpId)` block):
```javascript
// 🛡️ SLUG PRESERVATION: If the trip already exists on WordPress, preserve its slug
// Changing slugs on published trips breaks backlinks, SEO rankings, and indexed URLs
if (primaryTripInfoFromWp && primaryTripInfoFromWp.core && primaryTripInfoFromWp.core.slug) {
  var existingSlug = String(primaryTripInfoFromWp.core.slug).trim();
  if (existingSlug) {
    payload.core.slug = existingSlug;
    log('Updater: PRESERVING existing slug for primary trip: ' + existingSlug);
  }
}
```

**updater.gs** (same location — fetch WP info first, then preserve):
```javascript
var primaryTripInfoFromWp = null;
try {
  if (wpId) primaryTripInfoFromWp = getTripInfoFromWpCached_Updater_(wpId);
} catch (eWpInfoPrimary) {}

// ... after payload is built ...

if (primaryTripInfoFromWp && primaryTripInfoFromWp.core && primaryTripInfoFromWp.core.slug) {
  var existingSlug = String(primaryTripInfoFromWp.core.slug).trim();
  if (existingSlug) {
    payload.core.slug = existingSlug;
    Logger.log('Updater: PRESERVING existing slug for primary trip: ' + existingSlug);
  }
}
```

### Fix 2: Translation Slug Preservation
Before pushing/creating a translation, check if it already has a slug on WP:

**updater.js** (before the `if (existingTranslations[targetLang])` check):
```javascript
// 🛡️ SLUG PRESERVATION: If translation already exists on WP, preserve its slug
var existingTransWpInfo = null;
try {
  if (existingTranslations[targetLang]) {
    existingTransWpInfo = await getTripInfoFromWpCached_Updater_(existingTranslations[targetLang]);
  }
} catch (eSlugCheck) {}
if (existingTransWpInfo && existingTransWpInfo.core && existingTransWpInfo.core.slug) {
  var existingTransSlug = String(existingTransWpInfo.core.slug).trim();
  if (existingTransSlug) {
    translatedPayload.core = translatedPayload.core || {};
    translatedPayload.core.slug = existingTransSlug;
    log('Updater: PRESERVING existing slug for ' + targetLang + ' translation: ' + existingTransSlug);
  }
}
```

**updater.gs** (same logic, synchronous):
```javascript
var existingTransWpInfo = null;
try {
  if (existingTranslations[targetLang]) {
    existingTransWpInfo = getTripInfoFromWpCached_Updater_(existingTranslations[targetLang]);
  }
} catch (eSlugCheck) {}
if (existingTransWpInfo && existingTransWpInfo.core && existingTransWpInfo.core.slug) {
  var existingTransSlug = String(existingTransWpInfo.core.slug).trim();
  if (existingTransSlug) {
    translatedPayload.core = translatedPayload.core || {};
    translatedPayload.core.slug = existingTransSlug;
    Logger.log('Updater: PRESERVING existing slug for ' + targetLang + ' translation: ' + existingTransSlug);
  }
}
```

## Why This Fix Works
- `getTripInfoFromWpCached_Updater_()` already exists and returns full WP API response including `core.slug`
- The cache means no extra API calls — the trip info is already fetched for other purposes
- Only overwrites `payload.core.slug` when there's an actual existing slug on WP
- **New trips** (no `wpId`) skip the check entirely, so first-time slug generation from AI still works
- **New translations** (no `existingTranslations[lang]`) skip the check, so first-time localized slug generation still works

## Files Changed
- `src/publish/updater.js` — Two locations in `runUpdaterBatch()`:
  1. After primary payload build (~line 749)
  2. Before translation push (~line 888)
- `updater.gs` — Same two locations:
  1. After primary payload build (~line 460)
  2. Before translation push (~line 715)

## Impact
ALL existing trips and translations will now preserve their WordPress slugs during updates. New trips and new translations still get AI-generated slugs as before. Zero disruption to existing permalink structure.
