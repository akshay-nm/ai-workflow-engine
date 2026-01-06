import { Worker, type Job } from 'bullmq';
import type { AwilixContainer } from 'awilix';
import {
  getConnection,
  WORKFLOW_QUEUE_NAME,
  type WorkflowExecuteJobData,
  type WorkflowContinueJobData,
} from '@workflow/queue';
import { createLogger, type Logger } from '@workflow/shared';
import type { WorkerCradle } from '../container/types.js';
import {
  processWorkflowExecute,
  processWorkflowContinue,
} from '../processors/index.js';

type WorkflowJobData = WorkflowExecuteJobData | WorkflowContinueJobData;

function isExecuteJob(
  data: WorkflowJobData
): data is WorkflowExecuteJobData {
  return 'workflowId' in data && !('completedStepRunId' in data);
}

/**
 * Create a workflow worker using an Awilix container.
 * Dependencies are resolved from the container for each job.
 */
export function createWorkflowWorkerWithContainer(
  container: AwilixContainer<WorkerCradle>
): Worker<WorkflowJobData> {
  const redis = container.resolve('redis');
  const logger = container.resolve('createLogger')('workflow-worker');

  const worker = new Worker<WorkflowJobData>(
    WORKFLOW_QUEUE_NAME,
    async (job: Job<WorkflowJobData>) => {
      // Resolve a fresh processor for each job
      const processor = container.resolve('workflowProcessor');

      if (isExecuteJob(job.data)) {
        await processor.processExecute(job.data);
      } else {
        await processor.processContinue(job.data);
      }
    },
    {
      connection: redis,
      concurrency: 10,
    }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Workflow job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Workflow job failed');
  });

  return worker;
}

// Backward-compatible version without container
const legacyLogger = createLogger('workflow-worker');

/**
 * Create a workflow worker using default dependencies.
 * @deprecated Use createWorkflowWorkerWithContainer for DI support
 */
export function createWorkflowWorker(): Worker<WorkflowJobData> {
  const worker = new Worker<WorkflowJobData>(
    WORKFLOW_QUEUE_NAME,
    async (job: Job<WorkflowJobData>) => {
      if (isExecuteJob(job.data)) {
        await processWorkflowExecute(job as Job<WorkflowExecuteJobData>);
      } else {
        await processWorkflowContinue(job as Job<WorkflowContinueJobData>);
      }
    },
    {
      connection: getConnection(),
      concurrency: 10,
    }
  );

  worker.on('completed', (job) => {
    legacyLogger.info({ jobId: job.id }, 'Workflow job completed');
  });

  worker.on('failed', (job, err) => {
    legacyLogger.error({ jobId: job?.id, err }, 'Workflow job failed');
  });

  return worker;
}
