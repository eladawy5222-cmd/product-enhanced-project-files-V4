import { StageBadge } from './stage-badge.js'

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

function getStageFields(fields) {
  return {
    seo: fields.AI_SEO_Status,
    content: fields.AI_Status,
    addons: fields.AI_AddOns_Status,
    highlights: fields.AI_Highlights_Status,
    itinerary: fields.AI_Itinerary_Status,
    incexc: fields.AI_IncExc_Status,
    tripfacts: fields.AI_TripFacts_Status,
    faqs: fields.AI_FAQs_Status,
    images: fields.AI_Images_Status
  }
}

export function TripRow(record, onToggle) {
  const r = record || { id: '', fields: {} }
  const f = r.fields || {}
  const stages = getStageFields(f)
  const stageKeys = Object.keys(stages)

  const row = el('tr', { onClick: (e) => {
    const tag = String(e && e.target && e.target.tagName ? e.target.tagName : '').toLowerCase()
    if (tag === 'button' || tag === 'input' || tag === 'select' || tag === 'a') return
    if (onToggle) onToggle(r.id)
  } })

  row.appendChild(el('td', {}, el('div', { class: 'mono', text: String(f.TripID || '') || r.id.slice(0, 8) })))
  row.appendChild(el('td', {}, el('div', { text: String(f.Title || '') })))
  row.appendChild(el('td', {}, StageBadge(f.Pipeline_Status || '')))
  row.appendChild(el('td', {}, StageBadge(f.Publish_Status || 'Not Started')))
  const stageCell = el('td')
  for (const k of stageKeys) {
    const b = StageBadge(stages[k] || 'Waiting')
    b.style.marginRight = '6px'
    stageCell.appendChild(b)
  }
  row.appendChild(stageCell)
  return row
}

export function TripDetails(record) {
  const r = record || { id: '', fields: {} }
  const f = r.fields || {}
  const wrap = el('div', { class: 'card' })
  wrap.appendChild(el('div', { class: 'card-title', text: 'Trip Details' }))

  const pre = el('pre', { class: 'mono', style: 'margin:0; white-space:pre-wrap; word-break:break-word; font-size:12px; color: rgba(255,255,255,0.80);' })
  pre.textContent = JSON.stringify({ id: r.id, fields: f }, null, 2)
  wrap.appendChild(pre)
  return wrap
}

