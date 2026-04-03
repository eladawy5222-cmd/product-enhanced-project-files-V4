# TREA Feedback #5 — Electron App Won't Launch (Critical Bug in main.js)

## Problem
Running `npx electron .` opens and immediately closes without showing a window. No error output.

## Root Cause
In `main.js`, the `main()` function calls `await rebuildServices()` and registers all `ipcMain.handle(...)` handlers **before** `app.whenReady()` resolves. The `app.whenReady()` call is at the very end of `main()` as a non-awaited `.then()`, so the window never gets created before Electron decides there's nothing to do and quits.

## Proof
- `npx electron test-electron.js` (simple window + loadFile) → works fine ✅
- `debug-main.js` (await app.whenReady() FIRST, then create window, then load services) → works fine, ALL SERVICES CREATED SUCCESSFULLY ✅
- `npx electron .` (original main.js) → silent crash ❌

## The Fix
Move `await app.whenReady()` to the **beginning** of `main()`, and call `createWindow()` directly after it (not inside a `.then()`).

### Current Code (BROKEN):
```javascript
async function main() {
  const rootDir = path.resolve(__dirname)
  ensureDir(path.resolve(rootDir, 'data'))

  const broadcaster = createBroadcaster()
  // ... rebuildServices, ipcMain.handle registrations ...

  app.whenReady().then(() => {        // ❌ Not awaited, runs too late
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
```

### Fixed Code:
```javascript
async function main() {
  await app.whenReady()               // ✅ Wait for Electron to be ready FIRST

  const rootDir = path.resolve(__dirname)
  ensureDir(path.resolve(rootDir, 'data'))

  const broadcaster = createBroadcaster()

  // ... rebuildServices() ...
  // ... all ipcMain.handle() registrations ...

  // Create window AFTER services and handlers are ready
  function createWindow() {
    const win = new BrowserWindow({
      width: 1280,
      height: 800,
      backgroundColor: '#0b0f14',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(rootDir, 'preload.js')
      }
    })
    win.loadFile(path.join(rootDir, 'renderer', 'index.html'))
  }

  createWindow()                       // ✅ Open window immediately

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
```

### Key Changes:
1. `await app.whenReady()` moved to **line 1** of `main()`
2. `createWindow()` called **directly** after all IPC handlers are registered (not inside `.then()`)
3. `app.on('activate', ...)` moved alongside `createWindow()`
4. Everything else stays exactly the same

## Expected Result
`npx electron .` should open the FTS Trip Manager window with all IPC handlers working (Dashboard loads trips, Settings saves, AI Pipeline runs stages, etc.)
