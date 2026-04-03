import { LogViewer } from '../components/log-viewer.js'

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

export const MigrationPage = {
  render(container, ctx) {
    const { api, toast, state } = ctx

    const toolbar = el('div', { class: 'toolbar' },
      el('button', { class: 'btn', onClick: async () => {
        const r = await api.migrationTest();
        if (!r.ok) toast.push('Test Migration Failed', r.error)
      } }, el('span', { text: 'Run Test Migration (5)' })),
      el('button', { class: 'btn secondary', onClick: async () => {
        const r = await api.migrationRun();
        if (!r.ok) toast.push('Full Migration Failed', r.error)
      } }, el('span', { text: 'Run Full Migration' })),
      el('button', { class: 'btn danger', onClick: async () => {
        const r = await api.migrationReset();
        if (!r.ok) toast.push('Reset Failed', r.error)
      } }, el('span', { text: 'Reset TripID Counter' }))
    )

    const viewer = LogViewer({
      logs: state.logs,
      onClear: async () => { await api.logsClear() },
      onExport: async () => {
        const r = await api.logsExport();
        if (!r.ok) toast.push('Export Failed', r.error || 'Canceled')
      }
    })

    const tip = el('div', { class: 'card' },
      el('div', { class: 'card-title', text: 'Notes' }),
      el('div', { class: 'muted', text: 'Migration logs stream live from the main process. Use Logs page for filtering/search.' })
    )

    container.replaceChildren(toolbar, tip, viewer)
  }
}
