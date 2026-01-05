import { createLogger } from '@workflow/shared';
import { buildApp } from './app.js';

const logger = createLogger('api');

async function main() {
  const app = await buildApp();

  const host = process.env['API_HOST'] ?? '0.0.0.0';
  const port = parseInt(process.env['API_PORT'] ?? '3000', 10);

  try {
    await app.listen({ host, port });
    logger.info(`API server listening on ${host}:${port}`);
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }

  const shutdown = async () => {
    logger.info('Shutting down...');
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
