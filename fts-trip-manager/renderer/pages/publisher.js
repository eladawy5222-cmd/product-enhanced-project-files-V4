import { StageBadge } from '../components/stage-badge.js'

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

export const PublisherPage = {
  render(container, ctx) {
    const { api, toast, state, refreshTrips } = ctx
    const trips = state.trips || []

    const enabledToggle = el('input', { type: 'checkbox' })

    async function syncToggleFromStore() {
      const v = await api.configGet('PUBLISHER_WORKFLOW_ENABLED')
      enabledToggle.checked = String(v || '').toLowerCase() === 'true'
    }

    const toolbar = el('div', { class: 'toolbar' },
      el('label', { class: 'muted', style: 'display:flex; align-items:center; gap:8px; cursor:pointer;' },
        enabledToggle,
        el('span', { text: 'Enable publisher workflow' })
      ),
      el('button', { class: 'btn', onClick: async () => {
        const r = await api.publishRun();
        if (!r.ok) toast.push('Publisher Failed', r.error)
        await refreshTrips();
        renderTable()
      } }, el('span', { text: 'Run Publisher Batch' })),
      el('button', { class: 'btn secondary', onClick: async () => {
        const r = await api.updateRun();
        if (!r.ok) toast.push('Updater Failed', r.error)
        await refreshTrips();
        renderTable()
      } }, el('span', { text: 'Run Updater Batch' }))
    )

    enabledToggle.addEventListener('change', async () => {
      const r = await api.publishToggle(!!enabledToggle.checked)
      if (!r.ok) toast.push('Toggle Failed', r.error)
    })

    const table = el('table', { class: 'table' })
    table.appendChild(el('thead', {}, el('tr', {},
      el('th', { text: 'TripID' }),
      el('th', { text: 'Title' }),
      el('th', { text: 'Publish_Status' }),
      el('th', { text: 'Pipeline_Status' })
    )))
    const tbody = el('tbody')
    table.appendChild(tbody)

    function renderTable() {
      const rows = []
      const view = trips.filter((t) => {
        const f = t.fields || {}
        const ps = String(f.Publish_Status || '')
        return ps && ps !== 'Not Started'
      })
      for (const t of view) {
        const f = t.fields || {}
        const row = el('tr', {},
          el('td', {}, el('div', { class: 'mono', text: String(f.TripID || '') || t.id.slice(0, 8) })),
          el('td', {}, el('div', { text: String(f.Title || '') })),
          el('td', {}, StageBadge(f.Publish_Status || 'Not Started')),
          el('td', {}, StageBadge(f.Pipeline_Status || ''))
        )
        rows.push(row)
      }
      tbody.replaceChildren(...rows)
    }

    container.replaceChildren(toolbar, table)
    syncToggleFromStore().then(() => {
      renderTable()
    })
  }
}
