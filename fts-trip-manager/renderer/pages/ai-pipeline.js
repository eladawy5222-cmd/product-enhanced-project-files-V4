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

const STAGES = [
  { key: 'content', label: 'Stage 1: Content', field: 'AI_Status' },
  { key: 'addons', label: 'Stage 2: AddOns', field: 'AI_AddOns_Status' },
  { key: 'highlights', label: 'Stage 3: Highlights', field: 'AI_Highlights_Status' },
  { key: 'itinerary', label: 'Stage 4: Itinerary', field: 'AI_Itinerary_Status' },
  { key: 'incexc', label: 'Stage 5: Includes/Excludes', field: 'AI_IncExc_Status' },
  { key: 'tripfacts', label: 'Stage 6: Trip Facts', field: 'AI_TripFacts_Status' },
  { key: 'faqs', label: 'Stage 7: FAQs', field: 'AI_FAQs_Status' },
  { key: 'seo', label: 'Stage 8: SEO', field: 'AI_SEO_Status' },
  { key: 'images', label: 'Stage 9: Images', field: 'AI_Images_Status' }
]

function countStatuses(trips, field) {
  const out = { Waiting: 0, Pending: 0, Processing: 0, Done: 0, Error: 0, Other: 0 }
  for (const t of trips) {
    const v = String(((t.fields || {})[field]) || 'Waiting')
    if (out[v] != null) out[v] += 1
    else out.Other += 1
  }
  return out
}

export const AiPipelinePage = {
  render(container, ctx) {
    const { api, toast, state, refreshTrips } = ctx
    const trips = state.trips || []

    const topActions = el('div', { class: 'toolbar' },
      el('button', { class: 'btn', onClick: async () => { const r = await api.pipelineCheck(); if (!r.ok) toast.push('Pipeline Check Failed', r.error); await refreshTrips(); renderStages() } }, el('span', { text: 'Run Full Pipeline Check' })),
      el('button', { class: 'btn secondary', onClick: async () => { const r = await api.pipelineDetectStuck(); if (!r.ok) toast.push('Detect Stuck Failed', r.error); await refreshTrips(); renderStages() } }, el('span', { text: 'Detect Stuck Processes' }))
    )

    const stageGrid = el('div', { class: 'grid', style: 'grid-template-columns: repeat(3, minmax(0, 1fr));' })
    const controls = el('div', { class: 'card' })

    const tripSelect = el('select', { style: 'min-width: 360px;' },
      el('option', { value: '', text: 'Select a trip…' }),
      ...trips.slice(0, 200).map((t) => {
        const f = t.fields || {}
        const label = `${String(f.TripID || '').padEnd(7)} — ${String(f.Title || '').slice(0, 46)}`
        return el('option', { value: t.id, text: label })
      })
    )

    const stageSelect = el('select', {},
      ...STAGES.map((s) => el('option', { value: s.key, text: s.label }))
    )

    controls.appendChild(el('div', { class: 'card-title', text: 'Per-trip Controls' }))
    controls.appendChild(el('div', { class: 'toolbar' },
      tripSelect,
      el('button', { class: 'btn', onClick: async () => {
        const id = String(tripSelect.value || '')
        if (!id) { toast.push('Select Trip', 'Choose a trip first'); return }
        const r = await api.aiInitPipeline(id)
        if (!r.ok) toast.push('Init Failed', r.error)
        await refreshTrips();
        renderStages()
      } }, el('span', { text: 'Initialize Pipeline' })),
      stageSelect,
      el('button', { class: 'btn secondary', onClick: async () => {
        const id = String(tripSelect.value || '')
        if (!id) { toast.push('Select Trip', 'Choose a trip first'); return }
        const st = String(stageSelect.value || '')
        const r = await api.aiResetStage(id, st)
        if (!r.ok) toast.push('Reset Failed', r.error)
        await refreshTrips();
        renderStages()
      } }, el('span', { text: 'Reset Trip Stage → Pending' }))
    ))

    function renderStages() {
      stageGrid.replaceChildren()
      for (const s of STAGES) {
        const counts = countStatuses(trips, s.field)
        const card = el('div', { class: 'card' },
          el('div', { class: 'card-title', text: s.label }),
          el('div', { class: 'toolbar' },
            el('span', { class: 'pill waiting', text: `Waiting ${counts.Waiting}` }),
            el('span', { class: 'pill pending', text: `Pending ${counts.Pending}` }),
            el('span', { class: 'pill processing' }, el('span', { class: 'spinner' }), el('span', { text: `Processing ${counts.Processing}` })),
            el('span', { class: 'pill done', text: `Done ${counts.Done}` }),
            el('span', { class: 'pill error', text: `Error ${counts.Error}` })
          ),
          el('div', { class: 'toolbar' },
            el('button', { class: 'btn', onClick: async () => {
              const r = await api.aiRunStage(s.key)
              if (!r.ok) toast.push('Stage Run Failed', r.error)
              await refreshTrips();
              renderStages()
            } }, el('span', { text: 'Run Stage Manually' }))
            ,
            el('button', { class: 'btn secondary', onClick: async () => {
              const id = String(tripSelect.value || '')
              if (!id) { toast.push('Select Trip', 'Choose a trip first'); return }
              const r = await api.aiRunStage(s.key, id)
              if (!r.ok) toast.push('Stage Run Failed', r.error)
              await refreshTrips();
              renderStages()
            } }, el('span', { text: 'Run For Selected Trip' }))
          )
        )
        stageGrid.appendChild(card)
      }
    }

    container.replaceChildren(topActions, el('div', { class: 'split' }, stageGrid, controls))
    renderStages()
  }
}
