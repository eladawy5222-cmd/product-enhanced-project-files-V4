const { Mutex, withTimeout } = require('async-mutex')

function createLock() {
  const mutex = new Mutex()
  let release = null

  return {
    async tryLock(timeoutMs) {
      const t = Math.max(0, Number(timeoutMs || 0))
      try {
        release = await withTimeout(mutex, t).acquire()
        return true
      } catch {
        return false
      }
    },
    releaseLock() {
      try {
        if (typeof release === 'function') release()
      } finally {
        release = null
      }
    }
  }
}

module.exports = { createLock }
