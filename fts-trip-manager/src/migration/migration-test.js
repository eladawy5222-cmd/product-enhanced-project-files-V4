const { MIGRATION_CONFIG } = require('../config/migration-config')
const { createMigrationRunner } = require('./migration-runner')

function createMigrationTest(options) {
  const logger = options.logger
  if (!logger) throw new Error('createMigrationTest: missing options.logger')

  const runner = createMigrationRunner(options)

  async function runTestMigration() {
    logger.info(`Run Test Migration (batch of ${MIGRATION_CONFIG.TEST_BATCH_SIZE})`)
    return runner.runTestMigration()
  }

  return { runTestMigration }
}

module.exports = { createMigrationTest }

