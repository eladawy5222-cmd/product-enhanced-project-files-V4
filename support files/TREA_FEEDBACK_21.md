# TREA Feedback #21 — Translated Image Filenames Are Hex-Encoded Gibberish

## Problem
When the Updater localizes image metadata for translated trips, it sends the **translated title** (e.g. Chinese `赫尔格达观星望远镜`) to the `/media/ensure-filename` PHP endpoint. WordPress's `sanitize_file_name()` converts all non-ASCII characters to hex bytes, producing unreadable filenames like:

```
e8b5abe5b094e6a0bce8bebee8a782e6989fe69c9be8bf9c-29331.webp
```

This affects ALL non-Latin languages (Chinese, Arabic, Russian, etc.).

## Expected Behavior
Filenames should use the **language code prefix + English title**, producing clean readable filenames:

```
zh-desert-tour-sahl-hasheesh-stargazing-bbq-29331.webp
de-desert-tour-sahl-hasheesh-stargazing-bbq-29330.jpg
fr-desert-tour-sahl-hasheesh-stargazing-bbq-29329.jpg
ru-desert-tour-sahl-hasheesh-stargazing-bbq-29328.jpg
```

## Root Cause
In `localizeTripImagesMetadataForLang_Updater_()`, the call to `ensureFilenameForMedia_Updater_()` passes `translated.title` (the non-English translated title) as the desired filename:

```javascript
// BEFORE (BROKEN):
if (translated && translated.title) await ensureFilenameForMedia_Updater_(targetId, translated.title);
```

The PHP endpoint receives `赫尔格达观星望远镜` and sanitizes it to hex.

## The Fix
Use the **English source title** prefixed with the **language code** instead:

### updater.js (line ~5233):
```javascript
// AFTER (FIXED):
// Use lang-prefixed English title for filename (e.g. "zh-Desert Tour Stargazing" → "zh-desert-tour-stargazing.jpg")
var englishTitle = sourceEn && sourceEn.title ? sourceEn.title : (current && current.title ? current.title : '');
if (englishTitle) {
  await ensureFilenameForMedia_Updater_(targetId, lang + '-' + englishTitle);
}
```

### updater.gs (line ~4912):
```javascript
// AFTER (FIXED):
var englishTitle = sourceEn && sourceEn.title ? sourceEn.title : (current && current.title ? current.title : '');
if (englishTitle) {
  ensureFilenameForMedia_Updater_(targetId, lang + '-' + englishTitle);
}
```

## Why This Works
- `sourceEn` already contains the English image metadata (title, alt, caption, description) — it's fetched earlier in the same function from `englishMap[sourceId]` or from the WP API
- The `lang` variable (e.g. `zh-hans`, `de`, `fr`) is already available in scope
- The PHP `ensure-filename` endpoint sanitizes the title to a slug, so `"zh-hans-Desert Tour Stargazing"` becomes `zh-hans-desert-tour-stargazing.jpg`
- The translated title, alt, caption, and description are still correctly set on the attachment metadata via `updateMediaOnWordPress_Updater_()` — only the **filename** uses English

## Important
This change does NOT affect:
- Image **title** (still translated) ✅
- Image **alt text** (still translated) ✅  
- Image **caption** (still translated) ✅
- Image **description** (still translated) ✅

Only the **physical filename** on disk uses English with a language prefix.

## Files to Change
- `src/publish/updater.js` — inside `localizeTripImagesMetadataForLang_Updater_()`, replace the `ensureFilenameForMedia_Updater_` call
- `updater.gs` — same location, same change (synchronous version)
