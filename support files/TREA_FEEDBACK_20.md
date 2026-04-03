# TREA Feedback #20 — ENOTDIR Crash After Install (app.asar Path Issue)

## Problem
When the app is installed via the NSIS installer and launched, it crashes immediately with:
```
Error: ENOTDIR, not a directory
at ensureDir (main.js:6:35)
at setup (main.js:241:3)
```

The app tries to create `data/` directory inside `__dirname`, which points to the `app.asar` archive after packaging. Writing inside `app.asar` is impossible.

## Root Cause
In `main.js`, `setup()` uses `path.resolve(__dirname)` as `rootDir` for BOTH:
1. Reading source code files (preload.js, renderer/index.html) — needs `__dirname` (inside asar)
2. Writing data files (.env, data/, logs) — needs a writable location

After packaging, `__dirname` = `C:\Program Files\FTS Trip Manager\resources\app.asar` which is read-only.

## The Fix
Split into two paths:

```javascript
function setup() {
  const appDir = path.resolve(__dirname)  // Source code (read-only, inside asar)
  const rootDir = app.isPackaged ? app.getPath('userData') : path.resolve(__dirname)  // Data (writable)
  ensureDir(path.resolve(rootDir, 'data'))

  // Copy default .env to userData if it doesn't exist yet
  if (app.isPackaged) {
    const userEnvPath = path.join(rootDir, '.env')
    if (!fs.existsSync(userEnvPath)) {
      const templatePath = path.join(appDir, '.env.example')
      if (fs.existsSync(templatePath)) {
        fs.copyFileSync(templatePath, userEnvPath)
      } else {
        fs.writeFileSync(userEnvPath, '', 'utf8')
      }
    }
  }
```

Use `appDir` for:
- `preload: path.join(appDir, 'preload.js')`
- `win.loadFile(path.join(appDir, 'renderer', 'index.html'))`

Use `rootDir` for everything else (data, .env, logs, config-store).

Also removed `process.chdir(rootDir)` from `createServices()` — it would change CWD to userData which breaks `require('./src/...')` paths.

Also added `.env.example` to `electron-builder.yml` files list so it's included in the asar.

## Files Changed
- `main.js` — setup() function, createServices() function
- `electron-builder.yml` — added .env.example to files list

## userData Path
When packaged, `app.getPath('userData')` resolves to:
`C:\Users\{username}\AppData\Roaming\FTS Trip Manager\`

This is the standard Electron location for user data — writable, per-user, and persists across app updates.
