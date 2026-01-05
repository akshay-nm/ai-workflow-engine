import { Queue } from 'bullmq';
import { getConnection } from './connection.js';
import {
  WORKFLOW_QUEUE_NAME,
  STEP_QUEUE_NAME,
  type WorkflowExecuteJobData,
  type WorkflowContinueJobData,
  type StepExecuteJobData,
} from './jobs.js';

let workflowQueue: Queue<WorkflowExecuteJobData | WorkflowContinueJobData> | null = null;
let stepQueue: Queue<StepExecuteJobData> | null = null;

export function getWorkflowQueue(): Queue<WorkflowExecuteJobData | WorkflowContinueJobData> {
  if (!workflowQueue) {
    workflowQueue = new Queue(WORKFLOW_QUEUE_NAME, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false,
      },
    });
  }
  return workflowQueue;
}

export function getStepQueue(): Queue<StepExecuteJobData> {
  if (!stepQueue) {
    stepQueue = new Queue(STEP_QUEUE_NAME, {
      connection: getConnection(),
      defaultJobOptions: {
        removeOnComplete: false,
        removeOnFail: false,
      },
    });
  }
  return stepQueue;
}

export async function closeQueues(): Promise<void> {
  if (workflowQueue) {
    await workflowQueue.close();
    workflowQueue = null;
  }
  if (stepQueue) {
    await stepQueue.close();
    stepQueue = null;
  }
}
