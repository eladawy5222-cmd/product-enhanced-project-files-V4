import { Sidebar } from './components/sidebar.js'
import { DashboardPage } from './pages/dashboard.js'
import { ImportPage } from './pages/import.js'
import { AiPipelinePage } from './pages/ai-pipeline.js'
import { PublisherPage } from './pages/publisher.js'
import { MigrationPage } from './pages/migration.js'
import { SchedulerPage } from './pages/scheduler.js'
import { SettingsPage } from './pages/settings.js'
import { LogsPage } from './pages/logs.js'

function el(tag, attrs, ...children) {
  const node = document.createElement(tag)
  const a = attrs && typeof attrs === 'object' ? attrs : {}
  for (const k of Object.keys(a)) {
    const v = a[k]
    if (k === 'class') node.className = String(v)
    else if (k === 'text') node.textContent = String(v)
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v)
    else node.setAttribute(k, String(v))
  }
  for (const c of children) {
    if (c == null) continue
    if (Array.isArray(c)) {
      for (const cc of c) if (cc) node.appendChild(cc)
    } else if (typeof c === 'string') {
      node.appendChild(document.createTextNode(c))
    } else {
      node.appendChild(c)
    }
  }
  return node
}

function createToastHost() {
  const host = el('div', { class: 'toast-host' })
  document.body.appendChild(host)
  function push(title, body, ttlMs) {
    const toast = el('div', { class: 'toast' },
      el('div', { class: 't-title', text: title || 'Notice' }),
      el('div', { class: 't-body', text: body || '' })
    )
    host.appendChild(toast)
    const t = window.setTimeout(() => {
      try { host.removeChild(toast) } catch {}
    }, Math.max(1500, Number(ttlMs || 3500)))
    toast.addEventListener('click', () => {
      window.clearTimeout(t)
      try { host.removeChild(toast) } catch {}
    })
  }
  return { push }
}

const toast = createToastHost()

const api = window.fts
if (!api) {
  toast.push('Missing Bridge', 'preload.js did not expose window.fts', 9000)
}

const state = {
  route: '/dashboard',
  trips: [],
  schedules: [],
  logs: [],
  lastTask: null,
  loadingTrips: false,
  routeScrollTop: {}
}

const routes = {
  '/dashboard': DashboardPage,
  '/import': ImportPage,
  '/ai-pipeline': AiPipelinePage,
  '/publisher': PublisherPage,
  '/migration': MigrationPage,
  '/scheduler': SchedulerPage,
  '/settings': SettingsPage,
  '/logs': LogsPage
}

function parseRoute() {
  const raw = String(location.hash || '').replace(/^#/, '')
  const path = raw.startsWith('/') ? raw : '/dashboard'
  return routes[path] ? path : '/dashboard'
}

function formatTime(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return String(iso)
    return d.toLocaleString()
  } catch {
    return String(iso)
  }
}

async function refreshTrips() {
  if (!api) return
  state.loadingTrips = true
  try {
    state.trips = await api.tripsFetchAll()
  } catch (e) {
    toast.push('Trips Fetch Failed', String(e && e.message ? e.message : e))
  } finally {
    state.loadingTrips = false
  }
}

async function refreshSchedules() {
  if (!api) return
  try {
    state.schedules = await api.schedulerGetAll()
  } catch (e) {
    toast.push('Scheduler Fetch Failed', String(e && e.message ? e.message : e))
  }
}

function attachIpc() {
  if (!api) return () => {}

  const unsub = []
  unsub.push(api.onLogEntry((entry) => {
    state.logs.push(entry)
    if (state.logs.length > 2000) state.logs.splice(0, state.logs.length - 2000)
    if (state.route === '/logs') render()
  }))
  unsub.push(api.onTaskStarted((t) => {
    state.lastTask = { ...t, status: 'started' }
    if (state.route === '/dashboard' || state.route === '/import' || state.route === '/scheduler') render()
  }))
  unsub.push(api.onTaskCompleted((t) => {
    state.lastTask = { ...t, status: 'completed' }
    toast.push('Task Completed', String(t && t.task ? t.task : 'Task'))
    if (state.route === '/scheduler') refreshSchedules().then(render)
    else render()
  }))
  unsub.push(api.onTaskError((t) => {
    state.lastTask = { ...t, status: 'error' }
    toast.push('Task Error', String(t && t.error ? t.error : 'Unknown error'), 6500)
    if (state.route === '/scheduler') refreshSchedules().then(render)
    else render()
  }))
  unsub.push(api.onTripsUpdated(() => {
    refreshTrips().then(render)
  }))

  if (typeof api.onServicesReady === 'function') {
    unsub.push(api.onServicesReady(() => {
      toast.push('Services Ready', 'Backend services loaded successfully')
      refreshTrips().then(render)
      refreshSchedules().then(() => {
        if (state.route === '/scheduler') render()
      })
    }))
  }

  if (typeof api.onServicesError === 'function') {
    unsub.push(api.onServicesError((p) => {
      const err = p && p.error ? String(p.error) : 'Unknown error'
      toast.push('Services Error', err, 9000)
    }))
  }

  return () => {
    for (const u of unsub) {
      try { u() } catch {}
    }
  }
}

const detach = attachIpc()

const appRoot = document.getElementById('app')

function render() {
  const prevRoute = state.route
  const prevContent = appRoot ? appRoot.querySelector('.content') : null
  if (prevContent && prevRoute) {
    state.routeScrollTop[prevRoute] = prevContent.scrollTop
  }

  const route = parseRoute()
  state.route = route

  const Page = routes[route]
  const sidebar = Sidebar({ route })

  const headerTitle = {
    '/dashboard': 'Dashboard',
    '/import': 'Import',
    '/ai-pipeline': 'AI Pipeline',
    '/publisher': 'Publisher',
    '/migration': 'Migration',
    '/scheduler': 'Scheduler',
    '/settings': 'Settings',
    '/logs': 'Logs'
  }[route] || 'FTS Trip Manager'

  const topbar = el('div', { class: 'topbar' },
    el('h1', { text: headerTitle }),
    el('div', { class: 'meta' },
      state.loadingTrips ? el('span', { class: 'muted', text: 'Loading trips…' }) : el('span', { class: 'muted', text: `Trips: ${state.trips.length}` }),
      state.lastTask ? el('span', { class: 'muted', text: `Last: ${state.lastTask.task} (${state.lastTask.status})` }) : el('span', { class: 'muted', text: 'Ready' })
    )
  )

  const content = el('div', { class: 'content' })
  Page.render(content, {
    api,
    toast,
    state,
    refreshTrips,
    refreshSchedules,
    formatTime
  })

  const main = el('div', { class: 'main' }, topbar, content)
  appRoot.replaceChildren(sidebar, main)

  const nextContent = appRoot ? appRoot.querySelector('.content') : null
  if (nextContent && state.routeScrollTop && state.routeScrollTop.hasOwnProperty(route)) {
    nextContent.scrollTop = state.routeScrollTop[route]
  }
}

window.addEventListener('hashchange', () => render())

if (!location.hash) location.hash = '#/dashboard'

refreshTrips().then(() => {
  refreshSchedules().then(() => render())
})

window.addEventListener('beforeunload', () => {
  try { detach() } catch {}
})
