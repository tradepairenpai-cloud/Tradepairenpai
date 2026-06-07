import * as dotenv from 'dotenv';
dotenv.config();

import { ensureDirs } from './lib/config';
import { logger } from './lib/logger';

async function main() {
  ensureDirs();
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'task') {
    const description = args.slice(1).join(' ');
    if (!description) {
      logger.error('Usage: npm run dev task <description>');
      process.exit(1);
    }
    const { SupervisorAgent } = await import('./agents/supervisor');
    const supervisor = new SupervisorAgent();
    const result = await supervisor.run(description);
    if (result.ok) {
      const task = result.output as { finalReport?: string };
      console.log('\n' + (task.finalReport || JSON.stringify(result.output, null, 2)));
    } else {
      logger.error(`Task failed: ${result.error}`);
      process.exit(1);
    }
  } else if (command === 'preflight') {
    await import('./lib/preflight');
  } else {
    logger.info('Usage:');
    logger.info('  npm run dev:dash     — Start dashboard at http://localhost:3000');
    logger.info('  npm run dev task <description> — Run a task via CLI');
    logger.info('  npm run preflight   — Check API keys and CLIs');
  }
}

main().catch(e => {
  logger.error(`Fatal: ${e.message}`);
  process.exit(1);
});
