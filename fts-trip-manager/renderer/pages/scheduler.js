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

export const SchedulerPage = {
  render(container, ctx) {
    const { api, toast, state, refreshSchedules, formatTime } = ctx

    let savedScrollTop = container.scrollTop || 0
    let suppressScrollTracking = false
    const onScroll = () => {
      if (suppressScrollTracking) return
      savedScrollTop = container.scrollTop
    }
    container.addEventListener('scroll', onScroll)

    function restoreScroll(scrollTopOverride) {
      const targetTop = scrollTopOverride != null ? scrollTopOverride : savedScrollTop
      suppressScrollTracking = true
      requestAnimationFrame(() => {
        container.scrollTop = targetTop
        savedScrollTop = targetTop
        suppressScrollTracking = false
      })
    }

    const toolbar = el('div', { class: 'toolbar' },
      el('button', { class: 'btn', onClick: async () => {
        await refreshSchedules();
        renderTable()
      } }, el('span', { text: 'Refresh' })),
      el('button', { class: 'btn', onClick: async () => {
        const r = await api.schedulerStartAll();
        if (!r.ok) toast.push('Start All Failed', r.error)
        await refreshSchedules();
        renderTable()
      } }, el('span', { text: 'Start All' })),
      el('button', { class: 'btn danger', onClick: async () => {
        const r = await api.schedulerStopAll();
        if (!r.ok) toast.push('Stop All Failed', r.error)
        await refreshSchedules();
        renderTable()
      } }, el('span', { text: 'Stop All' }))
    )

    const table = el('table', { class: 'table' })
    const thead = el('thead', {}, el('tr', {},
      el('th', { text: 'Task' }),
      el('th', { text: 'Cron' }),
      el('th', { text: 'Enabled' }),
      el('th', { text: 'Running' }),
      el('th', { text: 'Last Run' }),
      el('th', { text: 'Next Run' }),
      el('th', { text: 'Runs' }),
      el('th', { text: 'Errors' }),
      el('th', { text: 'Actions' })
    ))
    const tbody = el('tbody')
    table.appendChild(thead)
    table.appendChild(tbody)

    const rowMap = new Map()

    function ensureRow(s) {
      const name = String(s.name)
      if (rowMap.has(name)) return rowMap.get(name)

      const cronInput = el('input', { value: String(s.cron || ''), style: 'min-width: 170px;' })
      const enabled = el('input', { type: 'checkbox' })
      enabled.checked = !!s.enabled

      const runningPill = el('span', { class: 'pill ' + (s.running ? 'done' : 'waiting'), text: s.running ? 'Yes' : 'No' })
      const lastRunSpan = el('span', { class: 'muted', text: s.lastRun ? formatTime(s.lastRun) : '' })
      const nextRunSpan = el('span', { class: 'muted', text: s.nextRun ? formatTime(s.nextRun) : '' })
      const runCountSpan = el('span', { class: 'mono', text: String(s.runCount || 0) })
      const errorCountSpan = el('span', { class: 'mono', text: String(s.errorCount || 0) })

      const saveBtn = el('button', { class: 'btn secondary', onClick: async () => {
        savedScrollTop = container.scrollTop
        const patch = { cron: String(cronInput.value || '').trim(), enabled: !!enabled.checked }
        try {
          await api.schedulerUpdate(String(name), patch)
          await refreshSchedules();
          toast.push('Saved', `Updated ${name}`)
          renderTable()
        } catch (e) {
          toast.push('Save Failed', String(e && e.message ? e.message : e))
        }
      } }, el('span', { text: 'Save' }))

      const runBtn = el('button', { class: 'btn', onClick: async () => {
        savedScrollTop = container.scrollTop
        const r = await api.schedulerRunNow(String(name))
        if (!r.ok) toast.push('Run Failed', r.error)
        await refreshSchedules();
        renderTable()
      } }, el('span', { text: 'Run Now' }))

      const row = el('tr', {},
        el('td', {}, el('div', { class: 'mono', text: String(name) })),
        el('td', {}, cronInput),
        el('td', {}, enabled),
        el('td', {}, runningPill),
        el('td', {}, lastRunSpan),
        el('td', {}, nextRunSpan),
        el('td', {}, runCountSpan),
        el('td', {}, errorCountSpan),
        el('td', {}, el('div', { class: 'toolbar', style: 'margin:0;' }, saveBtn, runBtn))
      )

      const ref = { row, cronInput, enabled, runningPill, lastRunSpan, nextRunSpan, runCountSpan, errorCountSpan }
      rowMap.set(name, ref)
      tbody.appendChild(row)
      return ref
    }

    function renderTable() {
      const schedulesNow = state.schedules || []
      const seen = new Set()
      for (const s of schedulesNow) {
        const ref = ensureRow(s)
        ref.cronInput.value = String(s.cron || '')
        ref.enabled.checked = !!s.enabled
        ref.runningPill.className = 'pill ' + (s.running ? 'done' : 'waiting')
        ref.runningPill.textContent = s.running ? 'Yes' : 'No'
        ref.lastRunSpan.textContent = s.lastRun ? formatTime(s.lastRun) : ''
        ref.nextRunSpan.textContent = s.nextRun ? formatTime(s.nextRun) : ''
        ref.runCountSpan.textContent = String(s.runCount || 0)
        ref.errorCountSpan.textContent = String(s.errorCount || 0)
        seen.add(String(s.name))
      }

      for (const name of Array.from(rowMap.keys())) {
        if (!seen.has(name)) {
          const ref = rowMap.get(name)
          try { tbody.removeChild(ref.row) } catch {}
          rowMap.delete(name)
        }
      }

      restoreScroll(savedScrollTop)
    }

    container.replaceChildren(toolbar, table)
    renderTable()
    restoreScroll()
  }
}
