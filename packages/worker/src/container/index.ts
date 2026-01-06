import {
  createContainer,
  asClass,
  asFunction,
  asValue,
  Lifetime,
  InjectionMode,
  type AwilixContainer,
} from 'awilix';
import { prisma, type PrismaClient } from '@workflow/database';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import {
  SequentialOrchestrator,
  VariableResolver,
} from '@workflow/engine';
import { ToolRegistry } from '@workflow/tools';
import {
  WORKFLOW_QUEUE_NAME,
  STEP_QUEUE_NAME,
} from '@workflow/queue';
import { createLogger } from '@workflow/shared';
import type { WorkerCradle, JobScopedCradle } from './types.js';
import { WorkflowProcessor } from '../processors/workflow.processor.js';
import { StepProcessor } from '../processors/step.processor.js';

export type { WorkerCradle, JobScopedCradle } from './types.js';

/**
 * Create a Redis connection for the worker.
 */
function createRedisConnection(): Redis {
  const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

/**
 * Get the Prisma client instance.
 * Uses the shared singleton from the database package.
 */
function getPrismaClient(): PrismaClient {
  return prisma;
}

/**
 * Create the workflow queue.
 */
function createWorkflowQueue({ redis }: { redis: Redis }): Queue {
  return new Queue(WORKFLOW_QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: false,
      removeOnFail: false,
    },
  });
}

/**
 * Create the step queue.
 */
function createStepQueue({ redis }: { redis: Redis }): Queue {
  return new Queue(STEP_QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: false,
      removeOnFail: false,
    },
  });
}

/**
 * Create the sequential orchestrator with injected dependencies.
 */
function createSequentialOrchestrator({
  prisma,
  variableResolver,
}: {
  prisma: PrismaClient;
  variableResolver: VariableResolver;
}): SequentialOrchestrator {
  return new SequentialOrchestrator({ prisma, variableResolver });
}

/**
 * Create the root Awilix container for the worker service.
 * All dependencies are registered here with their appropriate lifetimes.
 */
export function createRootContainer(): AwilixContainer<WorkerCradle> {
  const container = createContainer<WorkerCradle>({
    injectionMode: InjectionMode.PROXY,
    strict: true,
  });

  container.register({
    // Infrastructure - Singletons
    prisma: asFunction(getPrismaClient, { lifetime: Lifetime.SINGLETON }),
    redis: asFunction(createRedisConnection, { lifetime: Lifetime.SINGLETON }),

    // Queues - Singletons (depend on redis)
    workflowQueue: asFunction(createWorkflowQueue, {
      lifetime: Lifetime.SINGLETON,
    }),
    stepQueue: asFunction(createStepQueue, { lifetime: Lifetime.SINGLETON }),

    // Core Services - Singletons
    toolRegistry: asClass(ToolRegistry, { lifetime: Lifetime.SINGLETON }),
    variableResolver: asClass(VariableResolver, { lifetime: Lifetime.SINGLETON }),
    sequentialOrchestrator: asFunction(createSequentialOrchestrator, {
      lifetime: Lifetime.SINGLETON,
    }),

    // Processors - Transient (new instance per resolution)
    workflowProcessor: asClass(WorkflowProcessor, {
      lifetime: Lifetime.TRANSIENT,
    }),
    stepProcessor: asClass(StepProcessor, { lifetime: Lifetime.TRANSIENT }),

    // Utilities
    createLogger: asValue(createLogger),
  });

  return container;
}

/**
 * Create a job-scoped container from the root container.
 * This adds job-specific context values that are available during job processing.
 */
export function createJobScope(
  container: AwilixContainer<WorkerCradle>,
  jobContext: { jobId: string; workflowRunId: string }
): AwilixContainer<JobScopedCradle> {
  const scope = container.createScope<JobScopedCradle>();

  scope.register({
    jobId: asValue(jobContext.jobId),
    workflowRunId: asValue(jobContext.workflowRunId),
  });

  return scope;
}

/**
 * Dispose of the container and all its resources.
 * Should be called during graceful shutdown.
 */
export async function disposeContainer(
  container: AwilixContainer<WorkerCradle>
): Promise<void> {
  // Get singleton instances and close them
  const redis = container.resolve('redis');
  const prisma = container.resolve('prisma');
  const workflowQueue = container.resolve('workflowQueue');
  const stepQueue = container.resolve('stepQueue');

  // Close queues first
  await workflowQueue.close();
  await stepQueue.close();

  // Close connections
  await redis.quit();
  await prisma.$disconnect();
}
