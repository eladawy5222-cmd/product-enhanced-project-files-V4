const { sleep } = require('../core/runtime')

function extractFirstJsonObject(text) {
  const s = String(text || '')
  const first = s.indexOf('{')
  const last = s.lastIndexOf('}')
  if (first === -1 || last === -1 || last <= first) return null
  const candidate = s.slice(first, last + 1)
  try {
    return JSON.parse(candidate)
  } catch {
    return null
  }
}

function extractFirstJsonArray(text) {
  const s = String(text || '')
  const first = s.indexOf('[')
  const last = s.lastIndexOf(']')
  if (first === -1 || last === -1 || last <= first) return null
  const candidate = s.slice(first, last + 1)
  try {
    return JSON.parse(candidate)
  } catch {
    return null
  }
}

async function callChatJson(options) {
  const http = options.http
  const logger = options.logger
  const endpoint = String(options.endpoint || '')
  const apiKey = String(options.apiKey || '')
  const model = String(options.model || '')
  const prompt = String(options.prompt || '')
  const temperature = options.temperature == null ? 0.2 : Number(options.temperature)
  const maxTokens = options.maxTokens == null ? 0 : Number(options.maxTokens)
  const maxRetries = options.maxRetries == null ? 3 : Number(options.maxRetries)

  if (!endpoint) throw new Error('AI endpoint is missing')
  if (!apiKey) throw new Error('AI apiKey is missing')
  if (!model) throw new Error('AI model is missing')

  function sanitizeAiPromptPlaceholders_(p) {
    let s = String(p || '')
    if (!s) return s
    const before = s
    s = s.replace(/GENERATE ONE IF MISSING/ig, '')
    s = s.replace(/\bPLACEHOLDER\b/ig, '')
    s = s.replace(/\bTBD\b/ig, '')
    s = s.replace(/\bTODO\b/ig, '')
    s = s.replace(/'\s*'/g, "''")
    s = s.replace(/\s+\n/g, '\n')
    if (s !== before) logger.warn('AI: prompt placeholder leakage prevented')
    return s
  }

  const safePrompt = sanitizeAiPromptPlaceholders_(prompt)

  const body = {
    model,
    messages: [{ role: 'user', content: safePrompt }],
    temperature
  }
  if (maxTokens && isFinite(maxTokens) && maxTokens > 0) body.max_tokens = Math.floor(maxTokens)

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const resp = await http.postJson(endpoint, {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }, body)

      const content = resp && resp.choices && resp.choices[0] && resp.choices[0].message ? resp.choices[0].message.content : ''
      const parsedObj = extractFirstJsonObject(content)
      if (parsedObj !== null) return parsedObj
      const parsedArr = extractFirstJsonArray(content)
      if (parsedArr !== null) return parsedArr

      throw new Error('AI response did not contain valid JSON')
    } catch (e) {
      const msg = String(e && e.message ? e.message : e)
      const isRateLimit = !!(e && e.status === 429) || msg.includes('429') || msg.toLowerCase().includes('rate_limit')
      let delayMs = 500 * Math.pow(2, attempt)
      if (isRateLimit) {
        const ra = e && typeof e.retryAfterMs === 'number' ? e.retryAfterMs : 0
        delayMs = ra > 0 ? ra : Math.max(30_000, 15_000 * Math.pow(2, attempt))
        logger.warn(`AI rate limit attempt ${attempt + 1}: waiting ${Math.round(delayMs / 1000)}s (${msg})`)
      } else {
        logger.warn(`AI call failed attempt ${attempt + 1}: ${msg}`)
      }
      if (attempt >= maxRetries - 1) throw e
      await sleep(delayMs)
    }
  }

  throw new Error('AI call exhausted retries')
}

async function callOpenAiChatJsonWithMessages(options) {
  const http = options.http
  const logger = options.logger
  const apiKey = String(options.apiKey || '')
  const model = String(options.model || '')
  const messages = Array.isArray(options.messages) ? options.messages : []
  const temperature = options.temperature == null ? 0.2 : Number(options.temperature)
  const maxTokens = options.maxTokens == null ? 0 : Number(options.maxTokens)
  const maxRetries = options.maxRetries == null ? 3 : Number(options.maxRetries)

  if (!apiKey) throw new Error('AI apiKey is missing')
  if (!model) throw new Error('AI model is missing')
  if (!messages.length) throw new Error('AI messages are missing')

  function sanitizeAiPromptPlaceholders_(p) {
    let s = String(p || '')
    if (!s) return s
    const before = s
    s = s.replace(/GENERATE ONE IF MISSING/ig, '')
    s = s.replace(/\bPLACEHOLDER\b/ig, '')
    s = s.replace(/\bTBD\b/ig, '')
    s = s.replace(/\bTODO\b/ig, '')
    s = s.replace(/'\s*'/g, "''")
    s = s.replace(/\s+\n/g, '\n')
    if (s !== before) logger.warn('AI: prompt placeholder leakage prevented')
    return s
  }

  const safeMessages = messages.map(m => {
    if (!m || typeof m !== 'object') return m
    if (typeof m.content === 'string') return { ...m, content: sanitizeAiPromptPlaceholders_(m.content) }
    if (Array.isArray(m.content)) {
      const content = m.content.map(part => {
        if (part && typeof part === 'object' && part.type === 'text') return { ...part, text: sanitizeAiPromptPlaceholders_(part.text) }
        return part
      })
      return { ...m, content }
    }
    return m
  })

  const endpoint = 'https://api.openai.com/v1/chat/completions'
  const body = { model, messages: safeMessages, temperature }
  if (maxTokens && isFinite(maxTokens) && maxTokens > 0) body.max_tokens = Math.floor(maxTokens)

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const resp = await http.postJson(endpoint, {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }, body)

      const content = resp && resp.choices && resp.choices[0] && resp.choices[0].message ? resp.choices[0].message.content : ''
      const parsedObj = extractFirstJsonObject(content)
      if (parsedObj !== null) return parsedObj
      const parsedArr = extractFirstJsonArray(content)
      if (parsedArr !== null) return parsedArr

      throw new Error('AI response did not contain valid JSON')
    } catch (e) {
      const msg = String(e && e.message ? e.message : e)
      const isRateLimit = !!(e && e.status === 429) || msg.includes('429') || msg.toLowerCase().includes('rate_limit')
      let delayMs = 500 * Math.pow(2, attempt)
      if (isRateLimit) {
        const ra = e && typeof e.retryAfterMs === 'number' ? e.retryAfterMs : 0
        delayMs = ra > 0 ? ra : Math.max(30_000, 15_000 * Math.pow(2, attempt))
        logger.warn(`AI rate limit attempt ${attempt + 1}: waiting ${Math.round(delayMs / 1000)}s (${msg})`)
      } else {
        logger.warn(`AI call failed attempt ${attempt + 1}: ${msg}`)
      }
      if (attempt >= maxRetries - 1) throw e
      await sleep(delayMs)
    }
  }

  throw new Error('AI call exhausted retries')
}

function createAiProvider(options) {
  const http = options.http
  const logger = options.logger
  const config = options.config

  async function callDeepSeekJson(prompt, overrides) {
    const ov = overrides && typeof overrides === 'object' ? overrides : {}
    const model = String(ov.model || config.DEEPSEEK_MODEL || '').trim()
    const maxTokens = ov.maxTokens == null ? Number(config.DEEPSEEK_MAX_TOKENS || 0) : Number(ov.maxTokens)
    return callChatJson({
      http,
      logger,
      endpoint: config.DEEPSEEK_ENDPOINT,
      apiKey: config.DEEPSEEK_API_KEY,
      model,
      prompt,
      temperature: 0.2,
      maxTokens,
      maxRetries: 3
    })
  }

  async function callDeepseek(prompt, overrides) {
    return callDeepSeekJson(prompt, overrides)
  }

  async function callOpenAiJson(prompt) {
    return callOpenAiChatJsonWithMessages({
      http,
      logger,
      apiKey: config.OPENAI_API_KEY,
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: String(prompt || '') }],
      temperature: 0.2,
      maxRetries: 3
    })
  }

  async function callOpenai(prompt) {
    return callOpenAiJson(prompt)
  }

  async function callOpenaiVisionJson(prompt, imageUrl) {
    const url = String(imageUrl || '').trim()
    if (!url) throw new Error('Missing imageUrl')
    return callOpenAiChatJsonWithMessages({
      http,
      logger,
      apiKey: config.OPENAI_API_KEY,
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: String(prompt || '') },
          { type: 'image_url', image_url: { url } }
        ]
      }],
      temperature: 0.2,
      maxRetries: 3
    })
  }

  return { callDeepSeekJson, callDeepseek, callOpenAiJson, callOpenai, callOpenaiVisionJson }
}

module.exports = { createAiProvider }
