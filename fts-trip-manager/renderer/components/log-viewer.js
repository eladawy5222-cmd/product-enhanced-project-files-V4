function el(tag, attrs, ...children) {
  const node = document.createElement(tag)
  const a = attrs && typeof attrs === 'object' ? attrs : {}
  for (const k of Object.keys(a)) {
    const v = a[k]
    if (k === 'class') node.className = String(v)
    else if (k === 'text') node.textContent = String(v)
    else if (k === 'value') node.value = String(v)
    else if (k === 'checked') node.checked = !!v
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v)
    else node.setAttribute(k, String(v))
  }
  for (const c of children) {
    if (c == null) continue
    if (Array.isArray(c)) {
      for (const cc of c) if (cc) node.appendChild(cc)
    } else if (typeof c === 'string') node.appendChild(document.createTextNode(c))
    else node.appendChild(c)
  }
  return node
}

function levelColor(level) {
  const l = String(level || '').toLowerCase()
  if (l === 'error') return 'rgba(255, 93, 93, 0.95)'
  if (l === 'warn') return 'rgba(245, 197, 66, 0.95)'
  if (l === 'info') return 'rgba(61, 220, 151, 0.95)'
  return 'rgba(255, 255, 255, 0.60)'
}

const LOG_VIEWER_STATE = {
  level: 'ALL',
  q: '',
  autoScroll: true,
  stickToBottom: true,
  scrollTop: null
}

export function LogViewer(props) {
  const logs = props.logs || []
  const onClear = props.onClear
  const onExport = props.onExport

  let level = LOG_VIEWER_STATE.level || 'ALL'
  let q = LOG_VIEWER_STATE.q || ''
  let autoScroll = LOG_VIEWER_STATE.autoScroll !== false

  const list = el('div', { style: 'height: 520px; overflow:auto; border:1px solid rgba(255,255,255,0.08); border-radius: 12px; padding:10px; background: rgba(0,0,0,0.18);' })

  function isNearBottom() {
    const gap = list.scrollHeight - list.scrollTop - list.clientHeight
    return gap < 24
  }

  function scheduleScroll() {
    requestAnimationFrame(() => {
      if (autoScroll && LOG_VIEWER_STATE.stickToBottom) {
        list.scrollTop = list.scrollHeight
      } else if (LOG_VIEWER_STATE.scrollTop != null) {
        list.scrollTop = LOG_VIEWER_STATE.scrollTop
      }
    })
  }

  function renderList() {
    const nearBottomBefore = isNearBottom()
    const items = []
    for (const e of logs) {
      const lv = String(e.level || '').toUpperCase()
      if (level !== 'ALL' && lv !== level) continue
      const line = `${String(e.ts || '')} ${lv} ${String(e.message || '')}`
      if (q && line.toLowerCase().indexOf(q.toLowerCase()) === -1) continue

      const row = el('div', { style: 'display:flex; gap:10px; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.06);' })
      row.appendChild(el('div', { class: 'mono', style: `width: 170px; color: rgba(255,255,255,0.55); font-size: 11px;`, text: String(e.ts || '') }))
      row.appendChild(el('div', { class: 'mono', style: `width: 56px; color: ${levelColor(e.level)}; font-size: 11px;`, text: lv }))
      row.appendChild(el('div', { style: 'flex: 1; font-size: 12px; color: rgba(255,255,255,0.86); white-space: pre-wrap; word-break: break-word;', text: String(e.message || '') }))
      items.push(row)
    }
    list.replaceChildren(...items)
    LOG_VIEWER_STATE.level = level
    LOG_VIEWER_STATE.q = q
    LOG_VIEWER_STATE.autoScroll = autoScroll
    if (autoScroll) {
      LOG_VIEWER_STATE.stickToBottom = nearBottomBefore || LOG_VIEWER_STATE.stickToBottom
    }
    scheduleScroll()
  }

  const controls = el('div', { class: 'toolbar' },
    el('select', { onChange: (e) => { level = e.target.value; renderList() } },
      ...['ALL', 'DEBUG', 'INFO', 'WARN', 'ERROR'].map((v) => {
        const o = el('option', { value: v, text: v })
        if (v === level) o.setAttribute('selected', 'selected')
        return o
      })
    ),
    el('input', { placeholder: 'Search logs…', style: 'min-width: 220px;', value: q, onInput: (e) => { q = e.target.value; renderList() } }),
    el('label', { class: 'muted', style: 'display:flex; align-items:center; gap:8px; cursor:pointer;' },
      el('input', { type: 'checkbox', checked: autoScroll, onChange: (e) => { autoScroll = !!e.target.checked; LOG_VIEWER_STATE.autoScroll = autoScroll; if (autoScroll) LOG_VIEWER_STATE.stickToBottom = true; scheduleScroll() } }),
      el('span', { text: 'Auto-scroll' })
    ),
    el('button', { class: 'btn secondary', onClick: async () => { if (onExport) await onExport() } }, el('span', { text: 'Export Logs' })),
    el('button', { class: 'btn danger', onClick: async () => { if (onClear) await onClear(); renderList() } }, el('span', { text: 'Clear Logs' }))
  )

  list.addEventListener('scroll', () => {
    LOG_VIEWER_STATE.scrollTop = list.scrollTop
    LOG_VIEWER_STATE.stickToBottom = isNearBottom()
  })

  renderList()

  return el('div', { class: 'stack' }, controls, list)
}
