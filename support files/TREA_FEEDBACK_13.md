# TREA Feedback #13 — OpenAI Rate Limiting + Image Title Uniqueness Fix

## Issue A: Rate Limiting (HTTP 429)

### Problem
When processing multiple images for a trip, the app hits OpenAI's rate limit (HTTP 429):
```
Rate limit reached for gpt-4o-mini on tokens per min (TPM): Limit 200000, Used 200000, Requested 1180
```
Node.js sends requests much faster than GAS did. The retry logic (500ms, 1s, 2s) is too short for TPM rate limits that need ~60 seconds to reset.

### Required Changes

#### 1. Sequential Request Processing in `images-enhancer.js`
In the image processing loop, ensure requests are strictly sequential. Add a minimum delay between consecutive OpenAI calls:
```javascript
await sleep(2000)  // 2 seconds minimum between requests
```

#### 2. Smart Rate-Limit Handling in `ai-provider.js`
Update `callOpenAiChatJsonWithMessages` and `callChatJson` to detect HTTP 429 and wait appropriately:
```javascript
for (let attempt = 0; attempt < maxRetries; attempt++) {
  try {
    const resp = await http.postJson(endpoint, headers, body)
    
    if (resp && resp.error && resp.error.code === 'rate_limit_exceeded') {
      throw { status: 429, message: resp.error.message }
    }
    // ... existing JSON parsing ...
  } catch (e) {
    const isRateLimit = (
      (e && e.status === 429) ||
      String(e && e.message ? e.message : '').includes('429') ||
      String(e && e.message ? e.message : '').includes('rate_limit')
    )
    
    if (isRateLimit) {
      const rateLimitDelay = Math.max(30000, 15000 * Math.pow(2, attempt))
      logger.warn(`Rate limit hit (attempt ${attempt + 1}), waiting ${rateLimitDelay / 1000}s...`)
      await sleep(rateLimitDelay)
    } else {
      await sleep(500 * Math.pow(2, attempt))
    }
    if (attempt >= maxRetries - 1) throw e
  }
}
```

#### 3. Check `http-client.js`
Ensure `postJson` properly throws or returns the HTTP status code on 429. The HTTP client should detect 429, include status in the error, and parse `Retry-After` header if present.

---

## Issue B: Image Titles Should Be Genuinely Unique (No Number Suffixes)

### Problem
Currently, when the AI generates a duplicate title, `makeUniqueTitleWithCounter_AiImages_` appends `- 2`, `- 3`, etc.:
```
Cairo Pyramids Light Show Giza Pyramids Egypt Sound - 5
```
This looks unnatural and is bad for SEO.

### Required Change
Instead of appending a counter number, the AI should generate genuinely different titles for each image. Change the approach:

#### 1. Remove the counter suffix logic
In `images-enhancer.js`, modify `makeUniqueTitleWithCounter_AiImages_` — when a duplicate is detected, instead of appending `- N`, re-prompt the AI to generate a NEW unique title.

#### 2. Improve the prompt for title uniqueness
Update the prompt in `callOpenAiVisionForImageMeta_AiImages_` to give stronger instructions:

Add to the prompt:
```
TITLE UNIQUENESS (CRITICAL):
- Each image MUST have a completely different, descriptive title.
- Do NOT just add numbers or suffixes to make titles unique.
- Use different aspects of the image/trip for each title:
  * Different landmarks, activities, or scenes
  * Different angles: cultural, historical, scenic, experiential
  * Different descriptive words and phrasing
- Previously used titles for this trip (DO NOT reuse or create similar ones): [forbiddenTitles]
```

#### 3. If AI still returns a duplicate after retry, use a descriptive fallback
Instead of `"Title - 5"`, generate a fallback like:
```javascript
// Instead of:  "Cairo Pyramids Light Show - 5"
// Generate:    "Evening Spectacle at Giza Pyramids"
// Or:          "Ancient Egypt Sound and Light Experience"
```

The fallback should combine elements from: trip title + image role (featured/gallery) + image filename context.

#### 4. Keep `forbiddenTitles` mechanism
The existing `forbiddenTitles` array that tracks used titles is good — keep passing it to the AI. But remove the counter fallback (`- N`) entirely.

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/ai/images-enhancer.js` | Add `await sleep(2000)` between consecutive image AI calls |
| `src/ai/images-enhancer.js` | Remove `- N` counter from `makeUniqueTitleWithCounter_AiImages_` |
| `src/ai/images-enhancer.js` | On duplicate title: re-prompt AI or use descriptive fallback (not counter) |
| `src/ai/images-enhancer.js` | Strengthen prompt instructions for title uniqueness |
| `src/ai/ai-provider.js` | Detect 429 rate limit and wait 30+ seconds before retry |
| `src/core/http-client.js` | Ensure 429 responses include status code in error |
