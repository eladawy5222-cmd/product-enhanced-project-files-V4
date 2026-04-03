# TREA Feedback #12 — Missing Functions in `inc-exc-enhancer.js` (GAS Globals Not Localized)

## Problem
`inc-exc-enhancer.js` calls `buildUnifiedTripContext_()` (line 159) which is NOT defined in this file. This causes a runtime error that manifests as `fetchMainAiImprovementForTrip_ is not defined` because the error occurs inside `buildTripIncExcContext_` which is called first.

## Verification
```
Has fetchMainAi: true         ✅ (was added in Feedback #11)
Has buildUnifiedTripContext: false  ❌ MISSING
```

## Root Cause (Recurring Pattern)
In GAS, all functions were global. In Node.js, each module is isolated. TREA added `buildUnifiedTripContext_` to all other enhancers but MISSED `inc-exc-enhancer.js`.

## The Fix
Add `buildUnifiedTripContext_` function to `inc-exc-enhancer.js`. Copy from any other enhancer (e.g., `addons-enhancer.js` line 89 or `highlights-enhancer.js` line 88). It should:
- Accept `(tripId, tripFields)`
- Use `fetchRecordsByTrip_` (already in the file) to gather context from child tables
- Return the unified context object `U`

## CRITICAL: Do a Global Audit
This is the THIRD time we find a missing GAS global function. Please run a comprehensive audit:

```bash
# 1. Find all function CALLS in inc-exc-enhancer.js
grep -oP '\b\w+_\(' src/ai/inc-exc-enhancer.js | sort -u > /tmp/calls.txt

# 2. Find all function DEFINITIONS in inc-exc-enhancer.js  
grep -oP 'function \K\w+' src/ai/inc-exc-enhancer.js | sort -u > /tmp/defs.txt

# 3. Find calls without definitions
comm -23 /tmp/calls.txt /tmp/defs.txt
```

Do this for EVERY file in `src/ai/`, `src/publish/`, and `src/import/`. Every function that is called but not defined in its file needs to be added.

Common GAS globals to check in ALL files:
- `buildUnifiedTripContext_`
- `fetchMainAiImprovementForTrip_`
- `fetchRecordsByTrip_`
- `fetchRecordsByTripLocal_`
- `buildTripContextText_`
- Any function ending in `_` that was defined in one GAS file and used in another

## Files Most Likely Affected
- `src/ai/inc-exc-enhancer.js` — confirmed missing `buildUnifiedTripContext_`
- `src/publish/publisher.js` — may reference functions from other modules
- `src/publish/updater.js` — may reference functions from other modules
