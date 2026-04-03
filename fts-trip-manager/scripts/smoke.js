const path = require('path')

async function main() {
  const root = path.resolve(__dirname, '..')
  process.chdir(root)

  require('dotenv').config({ path: path.join(root, '.env') })

  const { getAppConfig } = require('../src/config/app-config')
  const { createLogger } = require('../src/logger/app-logger')
  const { createHttpClient } = require('../src/core/http-client')
  const { createAirtableClient } = require('../src/core/airtable-client')
  const { createServices } = require('../main')

  const config = getAppConfig({ rootDir: root })
  const logger = createLogger({ rootDir: root, debug: config.DEBUG })
  const http = createHttpClient({ logger, debug: config.DEBUG })
  if (config.AIRTABLE_API_KEY && config.AIRTABLE_BASE_ID) {
    createAirtableClient({ http, logger, baseId: config.AIRTABLE_BASE_ID, apiKey: config.AIRTABLE_API_KEY })
  }

  await createServices(root, { logger })

  logger.info('Smoke test ok')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
