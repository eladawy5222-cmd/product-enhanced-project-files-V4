# TREA Feedback #19 — Translation Update Fails with 500 When WP Post is Deleted (No Fallback to Create)

## Problem
When a translated trip post has been deleted from WordPress but its ID still exists in the `existingTranslations` map (from Airtable `Translation_Map` or WP API `language.translations`), the Updater tries to UPDATE a non-existent post. WordPress returns a **500 Internal Server Error** (the PHP endpoint crashes instead of returning 404). The Updater then throws an error and marks the entire trip as failed — **without attempting to re-create the translation**.

This means the Updater previously **could** create translations that didn't exist yet (the `else` branch), but if a translation was deleted and its stale ID remained in the map, the Updater would always fail on it with no recovery path.

## Evidence (from app.log)
```
Line 58: Found existing translations map: {"de":"29095","en":"26144","es":"29118","fr":"29098","ro":"29137","ru":"29125","tr":"29131","zh-hans":"29143"}
Line 59: languagesToUpdate=["zh-hans"] languagesToCreate=[]
Line 106: UPDATING EXISTING TRANSLATION: zh-hans -> 29143
Line 107: Error processing language zh-hans: WP API Error (500): {"code":"internal_server_error","message":"<p>There has been a critical error on this website.</p>..."}
Line 108: Trip recGTjnq4X13zaOpG not marked Published due to translation failures
```

WP post 29143 returns 404 (confirmed via direct API call):
```
GET https://ftstravels.com/wp-json/fts/v1/trip/29143
→ 404: {"code":"not_found","message":"Trip not found"}

GET https://ftstravels.com/wp-json/wp/v2/posts/29143
→ 404: {"code":"rest_post_invalid_id","message":"Invalid post ID."}
```

But the WP API for the primary trip (26144) no longer lists zh-hans in its translations (it was removed when the post was deleted), while Airtable's `Translation_Map` still has the stale reference.

## Root Cause
In `runUpdaterBatch()`, the translation update/create logic was a simple if/else:

```javascript
// BEFORE (BROKEN):
if (existingTranslations[targetLang]) {
    transWpId = existingTranslations[targetLang];
    await pushToWordPress_Updater_(transWpId, translatedPayload);  // ← THROWS on deleted post
    // No catch, no fallback
} else {
    transWpId = await createNewTripOnWordPress_Updater_(translatedPayload);  // ← Never reached
}
```

When `pushToWordPress_Updater_` throws (HTTP 500), the error propagates up and kills the entire translation loop.

## The Fix
Wrap the UPDATE attempt in a try/catch. On failure, fall back to CREATE:

```javascript
// AFTER (FIXED):
if (existingTranslations[targetLang]) {
    transWpId = existingTranslations[targetLang];
    log('UPDATING EXISTING TRANSLATION: ' + targetLang + ' -> ' + transWpId);
    
    // Update existing — with fallback to CREATE if the post was deleted
    try {
      await pushToWordPress_Updater_(transWpId, translatedPayload);
      log('Updater: Successfully UPDATED translation ' + transWpId);
    } catch (eUpdateTrans) {
      log('Updater: Update failed for ' + targetLang + ' (WP ID ' + transWpId + '): ' + eUpdateTrans.message);
      log('Updater: Translation post may have been deleted. Falling back to CREATE...');
      // Ensure translation_of is set for the new creation
      translatedPayload.translation_of = primaryWpId;
      transWpId = await createNewTripOnWordPress_Updater_(translatedPayload);
      log('Updater: Successfully CREATED replacement translation ' + transWpId + ' for ' + targetLang);
    }
} else {
    // ... existing create logic unchanged ...
}
```

## Why This Fix Works
- If `pushToWordPress_Updater_` succeeds → normal update flow, no change
- If it throws (500, 404, or any error) → catches the error, logs it, and falls back to `createNewTripOnWordPress_Updater_` which creates a brand new translation post
- `translatedPayload.translation_of` is already set (line 1021), but we re-set it for safety before create
- `transWpId` gets overwritten with the NEW post ID, so downstream logic (packages, schema, linking) uses the correct ID
- The final linking step will update both WP and Airtable `Translation_Map` with the new ID, cleaning up the stale reference

## Files Changed
- `src/publish/updater.js` — Translation update/create block in `runUpdaterBatch()` (~line 1040)
- `updater.gs` — Same location (~line 733)

## Impact
Any translation that was previously deleted from WordPress will now be automatically re-created instead of causing the entire update to fail. The Airtable `Translation_Map` and WP language linking will be updated with the new post ID.
