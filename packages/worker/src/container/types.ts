import type { PrismaClient } from '@workflow/database';
import type { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import type {
  IToolRegistry,
  ISequentialOrchestrator,
  IVariableResolver,
  IWorkflowProcessor,
  IStepProcessor,
  LoggerFactory,
  WorkflowExecuteJobData,
  WorkflowContinueJobData,
  StepExecuteJobData,
} from '@workflow/shared';

/**
 * Main cradle interface - all injectable dependencies for the worker.
 * This defines the shape of the Awilix container.
 */
export interface WorkerCradle {
  // Infrastructure - Singletons
  prisma: PrismaClient;
  redis: Redis;

  // Queues - Singletons
  workflowQueue: Queue<WorkflowExecuteJobData | WorkflowContinueJobData>;
  stepQueue: Queue<StepExecuteJobData>;

  // Core Services - Singletons
  toolRegistry: IToolRegistry;
  variableResolver: IVariableResolver;
  sequentialOrchestrator: ISequentialOrchestrator;

  // Processors - Transient (new instance per resolution)
  workflowProcessor: IWorkflowProcessor;
  stepProcessor: IStepProcessor;

  // Logger factory
  createLogger: LoggerFactory;
}

/**
 * Job-scoped cradle extends base with job-specific context.
 * Used for per-job container scopes.
 */
export interface JobScopedCradle extends WorkerCradle {
  jobId: string;
  workflowRunId: string;
}
