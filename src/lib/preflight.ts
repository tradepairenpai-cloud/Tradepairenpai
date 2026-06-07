import { checkApiKeys } from './config';
import { checkAllClis } from './cli-tools';
import { logger } from './logger';

async function main() {
  logger.info('=== Preflight Check ===');

  const keys = checkApiKeys();
  logger.info('--- API Keys ---');
  for (const [key, present] of Object.entries(keys)) {
    logger.info(`  ${key}: ${present ? 'OK' : 'MISSING (mock mode)'}`);
  }

  const clis = await checkAllClis();
  logger.info('--- CLI Tools ---');
  for (const [name, result] of Object.entries(clis)) {
    if (result.ok) {
      logger.info(`  ${name}: ${result.stdout || 'OK'}`);
    } else {
      logger.warn(`  ${name}: NOT FOUND (${result.error}) — agent will use mock mode`);
    }
  }

  logger.info('=== Preflight Complete ===');
}

main().catch(e => {
  logger.error(`Preflight failed: ${e.message}`);
  process.exit(1);
});
