export type RunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PAUSED';

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: RunStatus;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface StepRun {
  id: string;
  workflowRunId: string;
  stepId: string;
  status: RunStatus;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: string | null;
  attemptsMade: number;
  maxAttempts: number;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface TriggerRunInput {
  input?: Record<string, unknown>;
}

export interface WorkflowRunWithSteps extends WorkflowRun {
  stepRuns: StepRun[];
}
