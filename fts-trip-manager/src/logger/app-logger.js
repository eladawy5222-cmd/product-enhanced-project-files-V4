const fs = require('fs')
const path = require('path')
const EventEmitter = require('events')
const winston = require('winston')

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
}

function createLogger(options) {
  const rootDir = options && options.rootDir ? String(options.rootDir) : process.cwd()
  const debug = !!(options && options.debug)
  const emitter = new EventEmitter()

  const logsDir = path.resolve(rootDir, 'data', 'logs')
  ensureDir(logsDir)

  const fileTransport = new winston.transports.File({
    filename: path.join(logsDir, 'app.log'),
    maxsize: 10 * 1024 * 1024,
    maxFiles: 5
  })

  const logger = winston.createLogger({
    level: debug ? 'debug' : 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [fileTransport]
  })

  function emit(level, message, meta) {
    emitter.emit('entry', {
      ts: new Date().toISOString(),
      level,
      message: String(message || ''),
      meta: meta && typeof meta === 'object' ? meta : undefined
    })
  }

  function wrap(level) {
    return (message, meta) => {
      logger.log({ level, message: String(message || ''), meta })
      emit(level, message, meta)
    }
  }

  return {
    info: wrap('info'),
    warn: wrap('warn'),
    error: wrap('error'),
    debug: wrap('debug'),
    onEntry(handler) {
      emitter.on('entry', handler)
      return () => emitter.off('entry', handler)
    }
  }
}

module.exports = { createLogger }

