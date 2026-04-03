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

function safeJson(s) {
  try { return JSON.parse(String(s || '')) } catch { return null }
}

export const ImportPage = {
  render(container, ctx) {
    const { api, toast } = ctx

    const idInput = el('input', { placeholder: 'Trip ID (public TripID or WP ID)', style: 'min-width: 280px;' })
    const stateBox = el('pre', { class: 'mono', style: 'margin:0; white-space: pre-wrap; word-break: break-word; font-size: 12px; color: rgba(255,255,255,0.80);' })

    async function refreshState() {
      if (!api) return
      const raw = await api.configGet('WP_IMPORT_STATE')
      const parsed = safeJson(raw)
      stateBox.textContent = JSON.stringify(parsed || { raw }, null, 2)
    }

    const runBtn = el('button', { class: 'btn', onClick: async () => {
      const res = await api.importRun()
      if (!res.ok) toast.push('Import Failed', res.error)
      await refreshState()
    } }, el('span', { text: 'Import All Trips' }))

    const singleBtn = el('button', { class: 'btn secondary', onClick: async () => {
      const id = String(idInput.value || '').trim()
      if (!id) { toast.push('Missing Trip ID', 'Enter a trip ID first'); return }
      const res = await api.importSingle(id)
      if (!res.ok) toast.push('Import Failed', res.error)
      await refreshState()
    } }, el('span', { text: 'Import Single Trip by ID' }))

    const resetBtn = el('button', { class: 'btn danger', onClick: async () => {
      const res = await api.importReset()
      if (!res.ok) toast.push('Reset Failed', res.error)
      await refreshState()
    } }, el('span', { text: 'Reset Import State' }))

    const toolbar = el('div', { class: 'toolbar' }, runBtn, idInput, singleBtn, resetBtn)
    const panel = el('div', { class: 'card' },
      el('div', { class: 'card-title', text: 'Current Import State (WP_IMPORT_STATE)' }),
      stateBox
    )

    container.replaceChildren(toolbar, panel)
    refreshState()
  }
}
