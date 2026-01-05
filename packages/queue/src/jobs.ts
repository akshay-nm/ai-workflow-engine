export interface WorkflowExecuteJobData {
  workflowRunId: string;
  workflowId: string;
}

export interface WorkflowContinueJobData {
  workflowRunId: string;
  completedStepRunId: string;
}

export interface StepExecuteJobData {
  stepRunId: string;
  stepId: string;
  workflowRunId: string;
  input: Record<string, unknown>;
}

export type WorkflowJobData = WorkflowExecuteJobData | WorkflowContinueJobData;

export const WORKFLOW_QUEUE_NAME = 'workflow:execute';
export const STEP_QUEUE_NAME = 'step:execute';
