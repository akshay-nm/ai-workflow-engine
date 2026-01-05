import { Worker, type Job } from 'bullmq';
import {
  getConnection,
  WORKFLOW_QUEUE_NAME,
  type WorkflowExecuteJobData,
  type WorkflowContinueJobData,
} from '@workflow/queue';
import { createLogger } from '@workflow/shared';
import {
  processWorkflowExecute,
  processWorkflowContinue,
} from '../processors/index.js';

const logger = createLogger('workflow-worker');

type WorkflowJobData = WorkflowExecuteJobData | WorkflowContinueJobData;

function isExecuteJob(
  data: WorkflowJobData
): data is WorkflowExecuteJobData {
  return 'workflowId' in data && !('completedStepRunId' in data);
}

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
    logger.info({ jobId: job.id }, 'Workflow job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Workflow job failed');
  });

  return worker;
}
