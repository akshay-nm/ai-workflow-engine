import { Worker, type Job, type Queue } from 'bullmq';
import type { AwilixContainer } from 'awilix';
import { prisma as defaultPrisma, type PrismaClient } from '@workflow/database';
import {
  getConnection,
  getWorkflowQueue,
  STEP_QUEUE_NAME,
  type StepExecuteJobData,
  type WorkflowContinueJobData,
  type WorkflowExecuteJobData,
} from '@workflow/queue';
import { createLogger, type Logger } from '@workflow/shared';
import type { WorkerCradle } from '../container/types.js';
import { processStepExecute } from '../processors/index.js';

/**
 * Create a step worker using an Awilix container.
 * Dependencies are resolved from the container.
 */
export function createStepWorkerWithContainer(
  container: AwilixContainer<WorkerCradle>
): Worker<StepExecuteJobData> {
  const redis = container.resolve('redis');
  const prisma = container.resolve('prisma');
  const workflowQueue = container.resolve('workflowQueue');
  const logger = container.resolve('createLogger')('step-worker');

  const worker = new Worker<StepExecuteJobData>(
    STEP_QUEUE_NAME,
    async (job: Job<StepExecuteJobData>) => {
      // Resolve a fresh processor for each job
      const processor = container.resolve('stepProcessor');
      return processor.processExecute(job.data, job.attemptsMade);
    },
    {
      connection: redis,
      concurrency: 5,
    }
  );

  worker.on('completed', async (job) => {
    const { workflowRunId, stepRunId } = job.data;
    logger.info({ jobId: job.id, stepRunId }, 'Step job completed');

    await workflowQueue.add(
      'workflow.continue',
      {
        workflowRunId,
        completedStepRunId: stepRunId,
      },
      {
        jobId: `continue-${stepRunId}`,
      }
    );
  });

  worker.on('failed', async (job, err) => {
    if (!job) return;

    const { workflowRunId, stepRunId, stepId } = job.data;
    logger.error({ jobId: job.id, stepRunId, err }, 'Step job failed');

    const maxAttempts = job.opts.attempts ?? 3;
    if (job.attemptsMade >= maxAttempts) {
      logger.error(
        { stepRunId, attempts: job.attemptsMade },
        'Step exhausted all retries'
      );

      await prisma.stepRun.update({
        where: { id: stepRunId },
        data: {
          status: 'FAILED',
          error: err.message,
          completedAt: new Date(),
        },
      });

      await prisma.workflowRun.update({
        where: { id: workflowRunId },
        data: {
          status: 'FAILED',
          error: `Step '${stepId}' failed after ${job.attemptsMade} attempts: ${err.message}`,
          completedAt: new Date(),
        },
      });
    }
  });

  return worker;
}

// Backward-compatible version without container
const legacyLogger = createLogger('step-worker');

/**
 * Create a step worker using default dependencies.
 * @deprecated Use createStepWorkerWithContainer for DI support
 */
export function createStepWorker(): Worker<StepExecuteJobData> {
  const worker = new Worker<StepExecuteJobData>(
    STEP_QUEUE_NAME,
    async (job: Job<StepExecuteJobData>) => {
      return processStepExecute(job);
    },
    {
      connection: getConnection(),
      concurrency: 5,
    }
  );

  worker.on('completed', async (job) => {
    const { workflowRunId, stepRunId } = job.data;
    legacyLogger.info({ jobId: job.id, stepRunId }, 'Step job completed');

    const workflowQueue = getWorkflowQueue();
    await workflowQueue.add(
      'workflow.continue',
      {
        workflowRunId,
        completedStepRunId: stepRunId,
      },
      {
        jobId: `continue-${stepRunId}`,
      }
    );
  });

  worker.on('failed', async (job, err) => {
    if (!job) return;

    const { workflowRunId, stepRunId, stepId } = job.data;
    legacyLogger.error({ jobId: job.id, stepRunId, err }, 'Step job failed');

    const maxAttempts = job.opts.attempts ?? 3;
    if (job.attemptsMade >= maxAttempts) {
      legacyLogger.error(
        { stepRunId, attempts: job.attemptsMade },
        'Step exhausted all retries'
      );

      await defaultPrisma.stepRun.update({
        where: { id: stepRunId },
        data: {
          status: 'FAILED',
          error: err.message,
          completedAt: new Date(),
        },
      });

      await defaultPrisma.workflowRun.update({
        where: { id: workflowRunId },
        data: {
          status: 'FAILED',
          error: `Step '${stepId}' failed after ${job.attemptsMade} attempts: ${err.message}`,
          completedAt: new Date(),
        },
      });
    }
  });

  return worker;
}
