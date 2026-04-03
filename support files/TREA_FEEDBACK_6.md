# TREA Feedback #6 — Window Still Not Opening (createServices blocks createWindow)

## Problem
After applying Feedback #5 fix (`await app.whenReady()` at top of `main()`), the window STILL doesn't open when running `npx electron .`.

However, `debug-main.js` (which creates the window BEFORE loading services) works perfectly — window opens, ALL SERVICES CREATED SUCCESSFULLY.

## Root Cause
The current order in `main()` is:
```
1. await app.whenReady()       ✅
2. await rebuildServices()     ← BLOCKS HERE (hangs or takes too long)
3. ipcMain.handle(...)         ← never reached
4. createWindow()              ← never reached
```

`rebuildServices()` → `createServices()` calls many constructors including `createLogger` (winston), `createTaskScheduler` (node-cron), etc. One of these is either hanging, taking very long, or throwing a silent error that causes Electron to exit.

## Proof
- `debug-main.js` opens window FIRST, then loads services → works ✅
- `main.js` loads services first, then opens window → silent exit ❌

## The Fix
Move `createWindow()` BEFORE `await rebuildServices()`. The window should open immediately, then services load in the background. IPC handlers that depend on services should gracefully wait or show "loading" state.

### Current Code (BROKEN order):
```javascript
async function main() {
  await app.whenReady()
  // ... broadcaster setup ...
  await rebuildServices()        // ← blocks everything
  // ... ipcMain.handle(...) ...
  createWindow()                 // ← never reached
}
```

### Fixed Code:
```javascript
async function main() {
  await app.whenReady()

  const rootDir = path.resolve(__dirname)
  ensureDir(path.resolve(rootDir, 'data'))

  const broadcaster = createBroadcaster()

  // Define createWindow FIRST
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
    return win
  }

  // OPEN WINDOW IMMEDIATELY
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  // NOW load services and register IPC handlers
  const services = { current: null }

  async function rebuildServices() {
    if (services.current && services.current.scheduler) {
      try { services.current.scheduler.stopAll() } catch {}
    }
    services.current = await createServices(rootDir, {
      store: services.current ? services.current.store : null,
      logger: services.current ? services.current.logger : null,
      onTaskEvent: (channel, payload) => { broadcaster.send(channel, payload) }
    })
    if (services.current && services.current.logger) {
      services.current.logger.onEntry((entry) => broadcaster.send('log:entry', entry))
    }
  }

  function current() {
    if (!services.current) throw new Error('Services not ready')
    return services.current
  }

  // Register ALL ipcMain.handle(...) handlers HERE (same as before)
  // ... (keep all existing ipcMain.handle registrations exactly as they are) ...

  // THEN load services in background
  try {
    await rebuildServices()
    console.log('All services loaded successfully')
    // Notify renderer that services are ready
    broadcaster.send('services:ready', { ts: new Date().toISOString() })
  } catch (err) {
    console.error('Failed to load services:', err)
  }
}
```

### Key Changes:
1. `createWindow()` called IMMEDIATELY after `app.whenReady()` — before services
2. `app.on('activate')` and `app.on('window-all-closed')` registered early
3. All `ipcMain.handle(...)` registered BEFORE `rebuildServices()` (they reference `current()` which will have services once loaded)
4. `rebuildServices()` runs LAST — if it fails, window is already open and user sees the error in UI
5. Added try/catch around `rebuildServices()` so a failure doesn't crash the app

### Why This Works:
The IPC handlers use `current()` which lazily reads `services.current`. When the renderer calls an IPC method before services are ready, it gets "Services not ready" error — which the UI already handles as toast messages. Once services load, everything works normally.
