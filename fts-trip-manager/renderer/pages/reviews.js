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

export const ReviewsPage = {
  render(container, ctx) {
    const { api, toast, formatTime, state } = ctx

    let stats = null
    let recent = []
    let loading = false
    let selectedTripId = ''

    const header = el('div', { class: 'toolbar', style: 'justify-content: space-between;' },
      el('div', { class: 'toolbar', style: 'margin:0;' },
        el('button', { class: 'btn', onClick: async () => { await runNow('reviewsSync') } }, el('span', { text: 'Sync Now' })),
        el('button', { class: 'btn', onClick: async () => { await runNow('reviewsPublish') } }, el('span', { text: 'Publish Now' })),
        el('button', { class: 'btn secondary', onClick: async () => { await resetCursor() } }, el('span', { text: 'Reset Cursor' })),
        el('button', { class: 'btn secondary', onClick: async () => { await refresh() } }, el('span', { text: 'Refresh' }))
      ),
      el('div', { class: 'muted', style: 'font-size: 12px;', text: '' })
    )
    const meta = header.lastChild

    const trips = (state && Array.isArray(state.trips)) ? state.trips : []
    const publishControls = el('div', { class: 'card' })
    const tripSelect = el('select', {
      style: 'min-width: 520px;',
      onChange: (e) => { selectedTripId = String(e && e.target ? e.target.value : '') }
    },
      el('option', { value: '', text: 'Select a trip to publish its reviews…' }),
      ...trips.slice(0, 500).map((t) => {
        const f = t.fields || {}
        const label = `${String(f.TripID || '').padEnd(7)} — ${String(f.Title || '').slice(0, 70)}`
        return el('option', { value: t.id, text: label })
      })
    )
    publishControls.appendChild(el('div', { class: 'card-title', text: 'Publish Reviews for One Trip' }))
    publishControls.appendChild(el('div', { class: 'toolbar' },
      tripSelect,
      el('button', {
        class: 'btn',
        onClick: async () => {
          const id = String(selectedTripId || '').trim()
          if (!id) {
            toast.push('Select Trip', 'Please select a trip first.')
            return
          }
          if (!api || !api.reviewsPublishTrip) return
          const r = await api.reviewsPublishTrip(id)
          if (!r || !r.ok) {
            toast.push('Publish Failed', r && r.error ? r.error : 'Unknown error')
          } else {
            const res = r.result || {}
            const msg = res && res.ok === false
              ? String(res.message || 'Not published')
              : `Published: ${String(res.reviews || 0)} review(s)`
            toast.push('Publish Trip Reviews', msg)
          }
          await refresh()
        }
      }, el('span', { text: 'Publish Selected Trip' }))
    ))

    const cards = el('div', { class: 'grid cards', style: 'grid-template-columns: repeat(5, minmax(0, 1fr));' })
    const countsHost = el('div', { class: 'toolbar', style: 'margin: 10px 0 6px 0;' })

    const table = el('table', { class: 'table' })
    const thead = el('thead', {}, el('tr', {},
      el('th', { text: 'Date' }),
      el('th', { text: 'Stars' }),
      el('th', { text: 'Customer' }),
      el('th', { text: 'Trip' }),
      el('th', { text: 'Booking' }),
      el('th', { text: 'Status' }),
      el('th', { text: 'Method' }),
      el('th', { text: 'Score' })
    ))
    const tbody = el('tbody')
    table.appendChild(thead)
    table.appendChild(tbody)

    function card(title, value) {
      return el('div', { class: 'card' },
        el('div', { class: 'card-title', text: title }),
        el('div', { class: 'card-value', text: String(value) })
      )
    }

    function render() {
      const s = stats && stats.ok ? stats : null
      const by = s && s.byStatus ? s.byStatus : {}
      const total = s ? Number(s.total || 0) : 0
      const matched = s ? Number((by && by.Matched) || 0) : 0
      const needs = s ? Number((by && by.NeedsReview) || 0) : 0
      const pending = s ? Number((by && by.Pending) || 0) : 0
      const other = s ? Number((by && by.Other) || 0) : 0

      cards.replaceChildren(
        card('Total Reviews', total),
        card('Matched', matched),
        card('Needs Review', needs),
        card('Pending', pending),
        card('Other', other)
      )

      const cursor = s && s.cursor ? String(s.cursor) : ''
      const cursorSince = s && s.cursorSince ? String(s.cursorSince) : ''
      const cursorBefore = s && s.cursorBefore ? String(s.cursorBefore) : ''
      const truncated = s && s.truncated ? ' (truncated)' : ''
      meta.textContent = loading
        ? 'Loading…'
        : ((cursorSince || cursorBefore)
          ? `Since: ${cursorSince || 'none'} | Before: ${cursorBefore || 'none'}${truncated}`
          : `Cursor: ${cursor || 'none'}${truncated}`)

      countsHost.replaceChildren(
        el('span', { class: 'pill done', text: `Matched ${matched}` }),
        el('span', { class: 'pill pending', text: `Pending ${pending}` }),
        el('span', { class: 'pill waiting', text: `NeedsReview ${needs}` }),
        el('span', { class: 'pill waiting', text: `Other ${other}` })
      )

      const rows = []
      for (const r of recent) {
        const d = r && r.date ? String(r.date) : ''
        const dt = d ? (formatTime ? formatTime(d) : d) : ''
        rows.push(el('tr', {},
          el('td', {}, el('div', { class: 'mono', text: dt || '' })),
          el('td', {}, el('div', { class: 'mono', text: String(r.stars || '') })),
          el('td', {}, el('div', { text: String(r.customer || '') })),
          el('td', {}, el('div', { text: String(r.trip || '') })),
          el('td', {}, el('div', { class: 'mono', text: String(r.booking || '') })),
          el('td', {}, el('div', { text: String(r.status || '') })),
          el('td', {}, el('div', { class: 'mono', text: String(r.method || '') })),
          el('td', {}, el('div', { class: 'mono', text: String(r.score || '') }))
        ))
      }
      tbody.replaceChildren(...rows)
    }

    async function refresh() {
      if (!api || !api.reviewsGetStats || !api.reviewsFetchRecent) return
      loading = true
      render()
      try {
        stats = await api.reviewsGetStats()
        const rr = await api.reviewsFetchRecent(20)
        recent = rr && rr.ok && Array.isArray(rr.records) ? rr.records : []
      } catch (e) {
        toast.push('Reviews Load Failed', String(e && e.message ? e.message : e))
      } finally {
        loading = false
        render()
      }
    }

    async function runNow(taskName) {
      if (!api || !api.schedulerRunNow) return
      const r = await api.schedulerRunNow(String(taskName))
      if (!r || !r.ok) toast.push('Task Failed', r && r.error ? r.error : 'Unknown error')
      await refresh()
    }

    async function resetCursor() {
      if (!api || !api.reviewsResetCursor) return
      const ok = window.confirm('Reset reviews ingest cursor? This will make the next sync start from newest again.')
      if (!ok) return
      const r = await api.reviewsResetCursor()
      if (!r || !r.ok) toast.push('Reset Failed', r && r.error ? r.error : 'Unknown error')
      await refresh()
    }

    const autoRefresh = window.setInterval(() => {
      refresh().catch(() => {})
    }, 60_000)

    container.replaceChildren(publishControls, cards, header, countsHost, table)
    render()
    refresh().catch(() => {})
    container.addEventListener('DOMNodeRemoved', () => { try { window.clearInterval(autoRefresh) } catch {} }, { once: true })
  }
}
