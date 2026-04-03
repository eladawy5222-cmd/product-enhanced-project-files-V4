import { TripRow, TripDetails } from '../components/trip-card.js'

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
    } else node.appendChild(c)
  }
  return node
}

function countByStatus(trips, fieldName) {
  const out = { Waiting: 0, Pending: 0, Processing: 0, Done: 0, Error: 0, Other: 0 }
  for (const t of trips) {
    const f = t.fields || {}
    const v = String(f[fieldName] || '')
    if (out[v] != null) out[v] += 1
    else out.Other += 1
  }
  return out
}

export const DashboardPage = {
  render(container, ctx) {
    const { state, refreshTrips } = ctx
    const trips = state.trips || []

    let filterPipeline = 'ALL'
    let filterErrorsOnly = false
    let expandedId = null

    const pipelineCounts = countByStatus(trips, 'Pipeline_Status')
    const completed = pipelineCounts.Completed || 0
    const errors = pipelineCounts.Error || 0

    const cards = el('div', { class: 'grid cards' },
      el('div', { class: 'card' }, el('div', { class: 'card-title', text: 'Total Trips' }), el('div', { class: 'card-value', text: String(trips.length) })),
      el('div', { class: 'card' }, el('div', { class: 'card-title', text: 'Pipeline Active' }), el('div', { class: 'card-value', text: String((pipelineCounts['In Progress'] || 0) + (pipelineCounts.Initialized || 0) + (pipelineCounts.Pending || 0) + (pipelineCounts.Processing || 0)) })),
      el('div', { class: 'card' }, el('div', { class: 'card-title', text: 'Completed' }), el('div', { class: 'card-value', text: String(completed) })),
      el('div', { class: 'card' }, el('div', { class: 'card-title', text: 'Errors' }), el('div', { class: 'card-value', text: String(errors) }))
    )

    const refreshBtn = el('button', { class: 'btn', onClick: async () => { await refreshTrips(); renderTable() } }, el('span', { text: 'Refresh Trips' }))
    const errorsToggle = el('label', { class: 'muted', style: 'display:flex; align-items:center; gap:8px; cursor:pointer;' },
      el('input', { type: 'checkbox', onChange: (e) => { filterErrorsOnly = !!e.target.checked; renderTable() } }),
      el('span', { text: 'Errors only' })
    )

    const pipelineSelect = el('select', { onChange: (e) => { filterPipeline = e.target.value; renderTable() } },
      el('option', { value: 'ALL', text: 'Pipeline: All' }),
      ...['Initialized', 'In Progress', 'Completed', 'Error'].map((v) => el('option', { value: v, text: v }))
    )

    const toolbar = el('div', { class: 'toolbar' }, refreshBtn, pipelineSelect, errorsToggle)

    const table = el('table', { class: 'table' })
    const thead = el('thead', {}, el('tr', {},
      el('th', { text: 'TripID' }),
      el('th', { text: 'Title' }),
      el('th', { text: 'Pipeline' }),
      el('th', { text: 'Publish' }),
      el('th', { text: 'AI Stages' })
    ))
    const tbody = el('tbody')
    table.appendChild(thead)
    table.appendChild(tbody)

    const detailsHost = el('div', { class: 'stack', style: 'margin-top: 12px;' })

    function tripHasError(fields) {
      const keys = ['AI_Status', 'AI_AddOns_Status', 'AI_Highlights_Status', 'AI_Itinerary_Status', 'AI_IncExc_Status', 'AI_TripFacts_Status', 'AI_FAQs_Status', 'AI_Images_Status', 'AI_SEO_Status']
      for (const k of keys) if (String(fields[k] || '') === 'Error') return true
      return false
    }

    function renderTable() {
      const rows = []
      let view = trips
      if (filterPipeline !== 'ALL') view = view.filter((t) => String((t.fields || {}).Pipeline_Status || '') === filterPipeline)
      if (filterErrorsOnly) view = view.filter((t) => tripHasError(t.fields || {}))

      for (const t of view) rows.push(TripRow(t, (id) => { expandedId = expandedId === id ? null : id; renderDetails() }))
      tbody.replaceChildren(...rows)
      renderDetails()
    }

    function renderDetails() {
      detailsHost.replaceChildren()
      if (!expandedId) return
      const rec = trips.find((t) => t.id === expandedId)
      if (!rec) return
      detailsHost.appendChild(TripDetails(rec))
    }

    const autoRefresh = window.setInterval(() => {
      refreshTrips().then(renderTable)
    }, 30_000)

    container.replaceChildren(cards, toolbar, table, detailsHost)
    renderTable()
    container.addEventListener('DOMNodeRemoved', () => { try { window.clearInterval(autoRefresh) } catch {} }, { once: true })
  }
}
