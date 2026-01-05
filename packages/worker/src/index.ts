import type { Worker } from 'bullmq';
import { closeConnection, closeQueues } from '@workflow/queue';
import { registerDefaultTools } from '@workflow/tools';
import { createLogger } from '@workflow/shared';
import { createWorkflowWorker, createStepWorker } from './workers/index.js';

const logger = createLogger('worker');

async function main() {
  logger.info('Starting worker service...');

  registerDefaultTools();
  logger.info('Registered default tools');

  const workers: Worker[] = [];

  const workflowWorker = createWorkflowWorker();
  workers.push(workflowWorker);
  logger.info('Workflow worker started');

  const stepWorker = createStepWorker();
  workers.push(stepWorker);
  logger.info('Step worker started');

  logger.info('Worker service ready');

  const shutdown = async () => {
    logger.info('Shutting down workers...');

    await Promise.all(workers.map((w) => w.close()));
    await closeQueues();
    await closeConnection();

    logger.info('Workers shut down');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start worker service');
  process.exit(1);
});
