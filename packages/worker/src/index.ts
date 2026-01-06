import type { Worker } from 'bullmq';
import { createRootContainer, disposeContainer } from './container/index.js';
import { registerDefaultTools } from './tools/registration.js';
import {
  createWorkflowWorkerWithContainer,
  createStepWorkerWithContainer,
} from './workers/index.js';

async function main() {
  // Create the root container
  const container = createRootContainer();

  // Get logger from container
  const logger = container.resolve('createLogger')('worker');

  logger.info('Starting worker service...');

  // Register tools with the container's tool registry
  const toolRegistry = container.resolve('toolRegistry');
  registerDefaultTools(toolRegistry);
  logger.info('Registered default tools');

  const workers: Worker[] = [];

  // Create workers using the container
  const workflowWorker = createWorkflowWorkerWithContainer(container);
  workers.push(workflowWorker);
  logger.info('Workflow worker started');

  const stepWorker = createStepWorkerWithContainer(container);
  workers.push(stepWorker);
  logger.info('Step worker started');

  logger.info('Worker service ready');

  const shutdown = async () => {
    logger.info('Shutting down workers...');

    // Close workers first
    await Promise.all(workers.map((w) => w.close()));

    // Dispose container (closes all connections)
    await disposeContainer(container);

    logger.info('Workers shut down');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start worker service', err);
  process.exit(1);
});
