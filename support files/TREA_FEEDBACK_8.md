# TREA Feedback #8 — `createImprovementRepository` Not Exported

## Error
```
createImprovementRepository is not a function
```
Occurs when clicking "Run Full Pipeline Check" in the AI Pipeline page.

## Root Cause
`orchestrator.js` line 2 imports:
```javascript
const { createImprovementRepository } = require('./enhancement-helpers')
```

But `enhancement-helpers.js` line 239 only exports:
```javascript
module.exports = { createEnhancementHelpers }
```

`createImprovementRepository` is defined at line 3 of `enhancement-helpers.js` but is **not included in `module.exports`**.

## The Fix
In `enhancement-helpers.js`, change line 239 from:
```javascript
module.exports = { createEnhancementHelpers }
```
To:
```javascript
module.exports = { createEnhancementHelpers, createImprovementRepository }
```

## Also Check
Search for any other functions in `enhancement-helpers.js` that are used by other files but not exported. Run:
```
grep -r "require.*enhancement-helpers" src/
```
And verify every imported name is in `module.exports`.
