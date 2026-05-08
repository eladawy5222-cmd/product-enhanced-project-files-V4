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

export function Sidebar(props) {
  const route = props && props.route ? String(props.route) : '/dashboard'
  const links = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/reviews', label: 'Reviews' },
    { to: '/import', label: 'Import' },
    { to: '/ai-pipeline', label: 'AI Pipeline' },
    { to: '/publisher', label: 'Publisher' },
    { to: '/migration', label: 'Migration' },
    { to: '/scheduler', label: 'Scheduler' },
    { to: '/settings', label: 'Settings' },
    { to: '/logs', label: 'Logs' }
  ]

  const nav = el('div', { class: 'nav' })
  for (const l of links) {
    const a = el('a', { href: `#${l.to}`, class: route === l.to ? 'active' : '' })
    a.appendChild(el('span', { text: l.label }))
    a.appendChild(el('span', { class: 'badge', text: l.to === '/logs' ? 'live' : '' }))
    nav.appendChild(a)
  }

  return el('aside', { class: 'sidebar' },
    el('div', { class: 'brand' },
      el('div', { class: 'brand-title', text: 'FTS Trip Manager' }),
      el('div', { class: 'brand-sub', text: 'WordPress • Airtable • AI' })
    ),
    nav
  )
}
