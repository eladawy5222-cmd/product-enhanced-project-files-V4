const crypto = require('crypto')

function sleep(ms) {
  const t = Math.max(0, Number(ms || 0))
  return new Promise((r) => setTimeout(r, t))
}

function base64Encode(str) {
  return Buffer.from(String(str || ''), 'utf8').toString('base64')
}

function getUuid() {
  if (crypto.randomUUID) return crypto.randomUUID()
  return crypto.randomBytes(16).toString('hex')
}

function md5Base64(text) {
  return crypto.createHash('md5').update(String(text || ''), 'utf8').digest('base64')
}

module.exports = { sleep, base64Encode, getUuid, md5Base64 }

