const fs = require('fs')
const path = require('path')

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
}

function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {}
    const raw = fs.readFileSync(filePath, 'utf8')
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function writeJsonFileAtomic(filePath, data) {
  const dir = path.dirname(filePath)
  ensureDir(dir)
  const tmp = filePath + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  fs.renameSync(tmp, filePath)
}

function createConfigStore(options) {
  const filePath = options && options.filePath ? String(options.filePath) : path.resolve(process.cwd(), 'data', 'config-store.json')
  const state = readJsonFile(filePath)

  function persist() {
    writeJsonFileAtomic(filePath, state)
  }

  return {
    filePath,
    getProperty(key) {
      const k = String(key)
      return Object.prototype.hasOwnProperty.call(state, k) ? String(state[k]) : null
    },
    setProperty(key, value) {
      state[String(key)] = value == null ? '' : String(value)
      persist()
    },
    deleteProperty(key) {
      delete state[String(key)]
      persist()
    },
    getProperties() {
      const out = {}
      for (const k of Object.keys(state)) out[k] = String(state[k])
      return out
    },
    setProperties(obj) {
      const v = obj && typeof obj === 'object' ? obj : {}
      for (const k of Object.keys(v)) state[String(k)] = v[k] == null ? '' : String(v[k])
      persist()
    }
  }
}

module.exports = { createConfigStore }

