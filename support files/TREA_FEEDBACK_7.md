# TREA Feedback #7 — Critical Bug: `el()` Helper Drops All Non-Array Children

## Problem
All UI pages except Dashboard appear empty — no buttons, no forms, no content. The HTML containers are created but have 0 children inside them.

## Root Cause
The `el()` helper function used in almost every renderer file has a **JavaScript parsing bug**. The `else` clause binds to the wrong `if`.

### BROKEN code (in settings.js, import.js, ai-pipeline.js, publisher.js, migration.js, scheduler.js, logs.js, stage-badge.js, sidebar.js, log-viewer.js):
```javascript
for (const c of children) {
    if (c == null) continue
    if (Array.isArray(c)) for (const cc of c) if (cc) node.appendChild(cc)
    else node.appendChild(c)
}
```

JavaScript parses this as:
```javascript
if (Array.isArray(c))
    for (const cc of c)
        if (cc)
            node.appendChild(cc)
        else          // ← else belongs to `if (cc)`, NOT `if (Array.isArray(c))`
            node.appendChild(c)
```

This means: when `c` is NOT an array (the normal case — a single DOM element), it is **silently skipped**. Only array children get appended.

### CORRECT code (already exists in trip-card.js):
```javascript
for (const c of children) {
    if (c == null) continue
    if (Array.isArray(c)) {
      for (const cc of c) if (cc) node.appendChild(cc)
    } else node.appendChild(c)
}
```

The curly braces `{ }` around the `for` loop ensure `else` binds to `if (Array.isArray(c))`.

## Proof
```javascript
// BROKEN version — returns [] for non-array children
function el_broken(tag, attrs, ...children) {
  const results = []
  for (const c of children) {
    if (c == null) continue
    if (Array.isArray(c)) for (const cc of c) if (cc) results.push(cc)
    else results.push(c)
  }
  return results
}
el_broken('div', {}, 'hello')  // → [] (WRONG — should be ['hello'])

// FIXED version — works correctly
function el_fixed(tag, attrs, ...children) {
  const results = []
  for (const c of children) {
    if (c == null) continue
    if (Array.isArray(c)) {
      for (const cc of c) if (cc) results.push(cc)
    } else results.push(c)
  }
  return results
}
el_fixed('div', {}, 'hello')  // → ['hello'] (CORRECT)
```

## The Fix
In ALL renderer files that contain the `el()` function, add curly braces around the `for` loop inside the `if (Array.isArray(c))` branch:

### Find (in all files under `renderer/`):
```javascript
    if (Array.isArray(c)) for (const cc of c) if (cc) node.appendChild(cc)
    else node.appendChild(c)
```

### Replace with:
```javascript
    if (Array.isArray(c)) {
      for (const cc of c) if (cc) node.appendChild(cc)
    } else node.appendChild(c)
```

## Files to Fix
All files under `renderer/` that contain `function el(`:
1. `renderer/pages/settings.js`
2. `renderer/pages/import.js`
3. `renderer/pages/ai-pipeline.js`
4. `renderer/pages/publisher.js`
5. `renderer/pages/migration.js`
6. `renderer/pages/scheduler.js`
7. `renderer/pages/dashboard.js` (has bug but Dashboard works via trip-card.js)
8. `renderer/components/sidebar.js`
9. `renderer/components/stage-badge.js`
10. `renderer/components/log-viewer.js`
11. `renderer/app.js`

**NOT broken:** `renderer/components/trip-card.js` (already has correct braces)

## Also Fix: main.js Entry Point

The current `main.js` has two additional issues that were fixed during testing:

### Issue A: `async function main()` with `await app.whenReady()` never resolves
**Fix:** Changed to sync `function setup()` with `app.whenReady().then(...)` pattern.

### Issue B: `if (require.main === module)` guard prevents execution
When Electron loads `main.js` via `package.json` `"main"` field, `require.main !== module`, so `setup()` was never called.
**Fix:** Call `setup()` unconditionally.

Both fixes are already applied in the current working `main.js`.
