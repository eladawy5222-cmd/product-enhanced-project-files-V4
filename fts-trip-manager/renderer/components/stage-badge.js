function el(tag, attrs, ...children) {
  const node = document.createElement(tag)
  const a = attrs && typeof attrs === 'object' ? attrs : {}
  for (const k of Object.keys(a)) {
    const v = a[k]
    if (k === 'class') node.className = String(v)
    else if (k === 'text') node.textContent = String(v)
    else node.setAttribute(k, String(v))
  }
  for (const c of children) {
    if (!c) continue
    node.appendChild(c)
  }
  return node
}

export function StageBadge(status) {
  const s = String(status || 'Waiting')
  const key = s.toLowerCase()
  const cls = key === 'waiting' ? 'waiting' : key === 'pending' ? 'pending' : key === 'processing' ? 'processing' : key === 'done' ? 'done' : key === 'error' ? 'error' : 'waiting'

  const pill = el('span', { class: `pill ${cls}` })
  if (cls === 'processing') pill.appendChild(el('span', { class: 'spinner' }))
  pill.appendChild(el('span', { text: s }))
  return pill
}

