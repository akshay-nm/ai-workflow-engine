import type { Logger } from '../logger/index.js';
import type { ToolContext, ToolMetadata, ToolResult } from '../types/tool.js';

/**
 * Tool interface for dependency injection
 */
export interface ITool<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  execute(input: TInput, context: ToolContext): Promise<ToolResult<TOutput>>;
  getMetadata(): ToolMetadata;
}

/**
 * Tool registry interface for dependency injection
 */
export interface IToolRegistry {
  register(tool: ITool): void;
  get<TInput = unknown, TOutput = unknown>(name: string): ITool<TInput, TOutput>;
  has(name: string): boolean;
  list(): ToolMetadata[];
  clear(): void;
}

/**
 * Variable resolver context
 */
export interface ResolverContext {
  input: Record<string, unknown>;
  steps: Record<string, Record<string, unknown>>;
  env: Record<string, string | undefined>;
}

/**
 * Variable resolver interface for dependency injection
 */
export interface IVariableResolver {
  resolve(template: unknown, context: ResolverContext): unknown;
}

/**
 * Orchestrator result returned by orchestrator methods
 */
export interface OrchestratorResult {
  completed: boolean;
  nextStep: {
    id: string;
    name: string;
    toolName: string;
    inputMapping: unknown;
    retryConfig: unknown;
    order: number;
  } | null;
  stepInput: Record<string, unknown> | null;
}

/**
 * Sequential orchestrator interface for dependency injection
 */
export interface ISequentialOrchestrator {
  initialize(workflowRunId: string): Promise<OrchestratorResult>;
  getNextStep(
    workflowRunId: string,
    completedStepRunId: string
  ): Promise<OrchestratorResult>;
}

/**
 * Job data types for queue jobs
 */
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

/**
 * Processor interfaces for dependency injection
 */
export interface IWorkflowProcessor {
  processExecute(jobData: WorkflowExecuteJobData): Promise<void>;
  processContinue(jobData: WorkflowContinueJobData): Promise<void>;
}

export interface IStepProcessor {
  processExecute(jobData: StepExecuteJobData, attemptsMade: number): Promise<Record<string, unknown>>;
}

/**
 * Logger factory type
 */
export type LoggerFactory = (name: string) => Logger;
