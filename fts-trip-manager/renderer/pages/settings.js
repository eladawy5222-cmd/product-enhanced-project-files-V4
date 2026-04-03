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

function field(label, key, type) {
  const input = el('input', { type: type || 'text', style: 'width: 100%;', 'data-key': key })
  const row = el('div', { class: 'stack' },
    el('div', { class: 'muted', text: label }),
    input
  )
  return { row, input }
}

export const SettingsPage = {
  render(container, ctx) {
    const { api, toast } = ctx

    const wordpress = [
      field('WP_API_BASE', 'WP_API_BASE'),
      field('WP_API_URL_SINGLE', 'WP_API_URL_SINGLE'),
      field('WP_API_USER', 'WP_API_USER'),
      field('WP_API_PASS', 'WP_API_PASS', 'password')
    ]

    const airtable = [
      field('AIRTABLE_API_KEY', 'AIRTABLE_API_KEY', 'password'),
      field('AIRTABLE_BASE_ID', 'AIRTABLE_BASE_ID')
    ]

    const ai = [
      field('DEEPSEEK_API_KEY', 'DEEPSEEK_API_KEY', 'password'),
      field('DEEPSEEK_ENDPOINT', 'DEEPSEEK_ENDPOINT'),
      field('DEEPSEEK_MODEL', 'DEEPSEEK_MODEL'),
      field('OPENAI_API_KEY', 'OPENAI_API_KEY', 'password')
    ]

    const app = [
      field('DEBUG', 'DEBUG'),
      field('PUBLISHER_WORKFLOW_ENABLED', 'PUBLISHER_WORKFLOW_ENABLED'),
      field('WP_PER_PAGE', 'WP_PER_PAGE'),
      field('MAX_TRIPS_PER_RUN', 'MAX_TRIPS_PER_RUN'),
      field('MAX_TRIPS_PER_DAY', 'MAX_TRIPS_PER_DAY'),
      field('WORKER_ID', 'WORKER_ID')
    ]

    function section(title, fields, testName) {
      const rows = fields.map((f) => f.row)
      const testBtn = testName ? el('button', { class: 'btn secondary', onClick: async () => {
        const r = await api.settingsTest(testName)
        if (!r.ok) toast.push('Test Failed', r.error)
        else toast.push('Test OK', testName)
      } }, el('span', { text: `Test ${title}` })) : null
      return el('div', { class: 'card' },
        el('div', { class: 'toolbar', style: 'justify-content: space-between;' },
          el('div', { class: 'card-title', text: title }),
          testBtn
        ),
        el('div', { class: 'stack' }, ...rows)
      )
    }

    const saveBtn = el('button', { class: 'btn', onClick: async () => {
      const payload = {}
      for (const g of [wordpress, airtable, ai, app]) {
        for (const f of g) payload[f.input.getAttribute('data-key')] = String(f.input.value || '')
      }
      const r = await api.settingsSave(payload)
      if (!r.ok) toast.push('Save Failed', r.error)
      else toast.push('Saved', '.env updated')
    } }, el('span', { text: 'Save Settings' }))

    const hint = el('div', { class: 'card' },
      el('div', { class: 'card-title', text: 'Notes' }),
      el('div', { class: 'muted', text: 'Saving updates the .env file and reloads backend services inside the running app.' })
    )

    container.replaceChildren(
      el('div', { class: 'toolbar' }, saveBtn),
      hint,
      el('div', { class: 'split' },
        el('div', { class: 'stack' }, section('WordPress', wordpress, 'wordpress'), section('Airtable', airtable, 'airtable')),
        el('div', { class: 'stack' }, section('AI', ai, 'deepseek'), section('OpenAI', [ai[3]], 'openai'), section('App', app, null))
      )
    )

    api.settingsGet().then((vals) => {
      const v = vals && typeof vals === 'object' ? vals : {}
      for (const g of [wordpress, airtable, ai, app]) {
        for (const f of g) {
          const k = f.input.getAttribute('data-key')
          f.input.value = v[k] != null ? String(v[k]) : ''
        }
      }
    })
  }
}
