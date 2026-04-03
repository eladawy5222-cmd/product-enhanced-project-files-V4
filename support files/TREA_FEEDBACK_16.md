# TREA Feedback #16 — Language Validation Fails for Chinese (and other variant codes)

## Problem
ALL translations for languages with variant codes (zh-hans, pt-br, etc.) fail language validation, causing:
1. `generateLocalizedSEOAssets_` returns English instead of translated content
2. Image metadata translation fails silently
3. Section titles, FAQs, includes/excludes remain in English

## Evidence from Logs
```
LANGUAGE VALIDATION FAILED – regenerating (zh-hans)    ← repeated 6+ times
LOCALIZED SEO TITLE (zh-hans): Desert Tour: Sahl Hasheesh Stargazing & BBQ Dinner  ← ENGLISH!
LOCALIZED META DESCRIPTION (zh-hans): This desert tour in Sahl Hasheesh offers...  ← ENGLISH!
```

## Root Cause
In `callAiForTargetLangWithRetry_Updater_()` (line ~3745):
```javascript
var detected = detectLanguageSafe_Updater_(checkText);  // returns 'zh'
if (detected === lang) {  // lang = 'zh-hans' → 'zh' !== 'zh-hans' → ALWAYS FAILS!
```

`detectLanguageSafe_Updater_()` uses regex and returns base codes like `'zh'`, `'pt'`, `'es'`, etc.
But `lang` is the full variant code like `'zh-hans'`, `'pt-br'`, etc.

In the GAS original, this worked because `LanguageApp.detectLanguage()` (Google's built-in) could return matching codes. In Node.js, the regex-based replacement can only detect base language codes.

## The Fix

### Option A: Fix the comparison (simplest)
In `callAiForTargetLangWithRetry_Updater_()`, change the comparison:

```javascript
// CURRENT (broken):
if (detected === lang) {

// FIXED:
var detectedBase = detected.split('-')[0]
var langBase = lang.split('-')[0]
if (detected === lang || detectedBase === langBase) {
```

### Option B: Also improve `detectLanguageSafe_Updater_`
The regex detector returns `'zh'` but never `'zh-hans'` or `'zh-hant'`. Improve it:

```javascript
function detectLanguageSafe_Updater_(text) {
  try {
    var s = String(text || '');
    if (!s) return '';
    // Chinese (Simplified & Traditional)
    if (/[\u4E00-\u9FFF]/.test(s)) {
      // Simplified Chinese indicators
      if (/[\u7B80\u4F53\u8BED]/.test(s)) return 'zh-hans';
      return 'zh';  // Base Chinese
    }
    if (/[\u0400-\u04FF]/.test(s)) return 'ru';
    if (/[\u3040-\u30FF]/.test(s)) return 'ja';
    if (/[\uAC00-\uD7AF]/.test(s)) return 'ko';
    if (/[ğşıçöüİ]/i.test(s)) return 'tr';
    if (/[ąćęłńóśźż]/i.test(s)) return 'pl';
    if (/[ăâîșț]/i.test(s)) return 'ro';
    if (/[áéíóúñ¿¡]/i.test(s)) return 'es';
    if (/[àâçéèêëîïôûùüÿœ]/i.test(s)) return 'fr';
    if (/[äöüß]/i.test(s)) return 'de';
    // Arabic
    if (/[\u0600-\u06FF]/.test(s)) return 'ar';
    return '';
  } catch (e) {
    return '';
  }
}
```

**IMPORTANT:** Option A is required regardless. Option B is a nice improvement.

### Option C (recommended): Use both fixes together
Apply Option A (fuzzy comparison) AND Option B (better detection).

## Affected Languages
Any language with a variant code:
- `zh-hans` (Chinese Simplified) — detected as `zh` → FAILS
- `zh-hant` (Chinese Traditional) — detected as `zh` → FAILS  
- `pt-br` (Brazilian Portuguese) — would be detected as `pt` → FAILS
- Any future variant codes

## Impact
This single bug causes ALL non-Latin translations to partially fail:
- SEO titles/descriptions stay in English
- Image metadata stays in English
- The `translateTripData_` core translation works (because it's a separate chunk) but `generateLocalizedSEOAssets_` overwrites the translated SEO fields with English fallback

## Files to Change
- `src/publish/updater.js` — `callAiForTargetLangWithRetry_Updater_()` comparison fix + `detectLanguageSafe_Updater_()` improvement
