import { Worker, type Job } from 'bullmq';
import { prisma } from '@workflow/database';
import {
  getConnection,
  getWorkflowQueue,
  STEP_QUEUE_NAME,
  type StepExecuteJobData,
} from '@workflow/queue';
import { createLogger } from '@workflow/shared';
import { processStepExecute } from '../processors/index.js';

const logger = createLogger('step-worker');

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
    logger.info({ jobId: job.id, stepRunId }, 'Step job completed');

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
