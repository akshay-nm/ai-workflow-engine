import type { StepRun, WorkflowRun } from './run.js';

export interface ToolMetadata {
  name: string;
  version: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

export interface ToolContext {
  workflowRun: WorkflowRun;
  stepRun: StepRun;
  previousOutputs: Record<string, Record<string, unknown>>;
  variables: Record<string, unknown>;
}

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
