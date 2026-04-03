# TREA Feedback #11 — `fetchMainAiImprovementForTrip_` Not Defined in `inc-exc-enhancer.js`

## Error
```
AI Inc/Exc: error for Trip recstfS5va75ZPQN3 — fetchMainAiImprovementForTrip_ is not defined
```

## Root Cause
`inc-exc-enhancer.js` line 365 calls `fetchMainAiImprovementForTrip_(tripId)` but this function is NOT defined in this file. In the GAS original, it was a global function in `ai_highlights.gs` accessible to all files. In Node.js, each module is isolated.

The function IS defined in `highlights-enhancer.js` (line 828), but it's not exported or available to `inc-exc-enhancer.js`.

## Two Issues
1. **Function not defined** in `inc-exc-enhancer.js`
2. **Missing `await`** — line 365 calls `fetchMainAiImprovementForTrip_(tripId)` without `await` but the function is async

## The Fix
Add the `fetchMainAiImprovementForTrip_` function inside `inc-exc-enhancer.js`. Copy it from `highlights-enhancer.js` (line 828-839), but also fix it to use the multi-strategy lookup (tripPublicId) instead of just tripId:

```javascript
async function fetchMainAiImprovementForTrip_(tripId, tripNumber) {
  if (!tripId) return null;
  var tableName = 'Improvement With AI';
  var conditions = [];
  conditions.push("FIND('" + tripId + "', ARRAYJOIN({Trip}))");
  if (tripNumber) conditions.push("FIND('" + tripNumber + "', ARRAYJOIN({Trip}))");
  var formula = conditions.length > 1 ? "OR(" + conditions.join(", ") + ")" : conditions[0];
  var params = {
    filterByFormula: formula,
    maxRecords: 1
  };
  var res = await airtableGet_(tableName, params);
  if (!res || !res.records || !res.records.length) return null;
  return res.records[0];
}
```

And fix line 365 to use `await` and pass `tripNumber`:
```javascript
var mainAiRec = await fetchMainAiImprovementForTrip_(tripId, tripNumber);
```

## Also Check
The same function in `highlights-enhancer.js` (line 828) also only searches by `tripId` without `tripNumber`. Fix it too to use the multi-strategy OR lookup pattern.

## Global Check
Search ALL converted files for any function calls that reference functions defined in OTHER files (GAS globals that weren't properly localized). Run:
```
grep -n "function " src/ai/*.js | grep -v "async\|const\|let\|var\|=>" > /tmp/defined.txt
```
Then check if any called function is missing from its file.
