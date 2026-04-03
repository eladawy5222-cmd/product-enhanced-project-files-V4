# TREA Feedback #14 — Add Dynamic Destinations Taxonomy Support to Updater & Publisher

## Background
The Updater and Publisher currently push `activities` and `trip_types` taxonomies to WordPress, but do NOT push `destination` taxonomy. Destinations must be assigned to trips when publishing/updating.

## WordPress Destination Taxonomy Details
- Taxonomy name: `destination`
- REST API endpoint: `GET /wp-json/wp/v2/destination?per_page=100`
- For translations: `GET /wp-json/wp/v2/destination?per_page=100&lang={langCode}`
- Each destination has: `id`, `name`, `slug`, `parent`
- Hierarchical: Egypt (parent) → Cairo, Luxor, Hurghada, etc. (children)
- Each language has DIFFERENT term IDs for the same destination

## Approach: Dynamic (fetch from WordPress API at runtime)

Do NOT hardcode destination IDs. Instead:

### 1. Add Destination Fetching Utility

Create a utility function (in `src/publish/updater.js` and/or a shared helper) that fetches all destinations from WordPress:

```javascript
async function fetchAllDestinations_(lang) {
  var baseUrl = CONFIG.WP_API_BASE.replace(/\/fts\/v1.*$/, '')
  var url = baseUrl + '/wp/v2/destination?per_page=100'
  if (lang) url += '&lang=' + encodeURIComponent(lang)
  
  var resp = await fetchUrl(url, {
    method: 'get',
    headers: { 'Authorization': 'Basic ' + base64Encode(CONFIG.WP_API_USER + ':' + CONFIG.WP_API_PASS) }
  })
  
  return JSON.parse(resp.getContentText())
}
```

Cache the results per language to avoid re-fetching on every trip:
```javascript
var _destinationCache = {}

async function getDestinationId_(destinationName, lang) {
  lang = lang || 'en'
  if (!_destinationCache[lang]) {
    _destinationCache[lang] = await fetchAllDestinations_(lang)
  }
  
  var destinations = _destinationCache[lang]
  var name = String(destinationName || '').trim().toLowerCase()
  
  // Match by name (case-insensitive)
  for (var i = 0; i < destinations.length; i++) {
    if (destinations[i].name.toLowerCase() === name) return destinations[i].id
    if (destinations[i].slug === name.replace(/\s+/g, '-')) return destinations[i].id
  }
  
  return null
}
```

### 2. Determine the Destination for Each Trip

The destination can be determined from:
- `tripFields.Destination` — if there's a Destination field in Airtable Trips table
- `data.tripDetails.TourLocation` or `data.tripDetails.Location` — from TripDetails
- Or from the existing trip's taxonomies (fetched via GET endpoint) — `trip.taxonomies.destination[0].name`

In `fetchCompleteTripData_Updater_`, add destination detection:
```javascript
// After fetching trip data from WordPress (for existing trips)
if (wpTripData && wpTripData.taxonomies && wpTripData.taxonomies.destination) {
  data.destinations = wpTripData.taxonomies.destination  // [{id, name, slug}]
}
```

### 3. Add Destination to Payload Mapping

In `mapAirtableToWordPress_Updater_()`, add after the `activities` and `trip_types` mapping:

```javascript
// Map Destinations
if (data.destinations && data.destinations.length > 0) {
  // For the primary language, use the IDs directly from the WordPress trip data
  payload.destinations = data.destinations.map(function(d) { return d.id })
  log('Updater: Payload.destinations set to: ' + JSON.stringify(payload.destinations))
}
```

For translations (different languages), map by name:
```javascript
// During translation, get the destination ID for the target language
var destName = data.destinations && data.destinations[0] ? data.destinations[0].name : ''
if (destName) {
  var translatedDestId = await getDestinationId_(destName, targetLang)
  if (translatedDestId) {
    translatedPayload.destinations = [translatedDestId]
  }
}
```

### 4. Update PHP Endpoint (`fts-trip-api-update.php`)

Add destination handling alongside activities and trip_types:

```php
// After the trip_types handling block, add:
if (isset($params['destinations'])) {
    $dest_ids = array_map('intval', (array) $params['destinations']);
    $res = wp_set_object_terms($trip_id, $dest_ids, 'destination');
    if (is_wp_error($res)) {
        // Fallback: try 'destinations' (plural)
        $res = wp_set_object_terms($trip_id, $dest_ids, 'destinations');
    }
    if (is_wp_error($res)) {
        // Fallback: try 'trip_destination'
        $res = wp_set_object_terms($trip_id, $dest_ids, 'trip_destination');
    }
    $debug_tax_log['destinations'] = is_wp_error($res) ? $res->get_error_message() : 'updated (' . count($dest_ids) . ' ids)';
}
```

### 5. Files to Modify

| File | Change |
|------|--------|
| `src/publish/updater.js` | Add `fetchAllDestinations_()`, `getDestinationId_()`, destination cache, payload mapping |
| `src/publish/publisher.js` | Same destination support for new trip creation |
| `fts-trip-api-update.php` | Add `destinations` handling in taxonomy update section |

### 6. Important Notes
- Cache destinations per language per session (clear cache on app restart)
- Always match by **name** (case-insensitive) or **slug** — never hardcode IDs
- A trip can have MULTIPLE destinations (e.g., Cairo + Luxor for a multi-city trip)
- Always assign the PARENT destination too (e.g., if assigning Cairo, also assign Egypt)
