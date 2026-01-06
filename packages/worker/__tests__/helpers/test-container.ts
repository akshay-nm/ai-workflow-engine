import {
  createContainer,
  asValue,
  asClass,
  asFunction,
  Lifetime,
  InjectionMode,
  type AwilixContainer,
} from 'awilix';
import { vi, type Mock } from 'vitest';
import type { Queue } from 'bullmq';
import type { PrismaClient } from '@workflow/database';
import type {
  IToolRegistry,
  ISequentialOrchestrator,
  IVariableResolver,
  LoggerFactory,
  StepExecuteJobData,
  WorkflowExecuteJobData,
  WorkflowContinueJobData,
} from '@workflow/shared';
import type { Redis } from 'ioredis';
import type { WorkerCradle } from '../../src/container/types.js';
import { WorkflowProcessor } from '../../src/processors/workflow.processor.js';
import { StepProcessor } from '../../src/processors/step.processor.js';

/**
 * Mock factories for testing
 */
export interface MockFactories {
  prisma: {
    workflowRun: {
      update: Mock;
      findUnique: Mock;
    };
    stepRun: {
      create: Mock;
      update: Mock;
      findUnique: Mock;
      findMany: Mock;
    };
    step: {
      findUnique: Mock;
    };
  };
  redis: {
    quit: Mock;
  };
  workflowQueue: {
    add: Mock;
    close: Mock;
  };
  stepQueue: {
    add: Mock;
    close: Mock;
  };
  toolRegistry: {
    register: Mock;
    get: Mock;
    has: Mock;
    list: Mock;
    clear: Mock;
  };
  sequentialOrchestrator: {
    initialize: Mock;
    getNextStep: Mock;
  };
  variableResolver: {
    resolve: Mock;
  };
  tool: {
    execute: Mock;
  };
}

/**
 * Result of creating a test container
 */
export interface TestContainerResult {
  container: AwilixContainer<WorkerCradle>;
  mocks: MockFactories;
}

/**
 * Create mock factories with fresh vi.fn() instances
 */
export function createMockFactories(): MockFactories {
  const tool = {
    execute: vi.fn(),
  };

  return {
    prisma: {
      workflowRun: {
        update: vi.fn(),
        findUnique: vi.fn(),
      },
      stepRun: {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      step: {
        findUnique: vi.fn(),
      },
    },
    redis: {
      quit: vi.fn(),
    },
    workflowQueue: {
      add: vi.fn(),
      close: vi.fn(),
    },
    stepQueue: {
      add: vi.fn(),
      close: vi.fn(),
    },
    toolRegistry: {
      register: vi.fn(),
      get: vi.fn().mockReturnValue(tool),
      has: vi.fn().mockReturnValue(true),
      list: vi.fn().mockReturnValue([]),
      clear: vi.fn(),
    },
    sequentialOrchestrator: {
      initialize: vi.fn(),
      getNextStep: vi.fn(),
    },
    variableResolver: {
      resolve: vi.fn(),
    },
    tool,
  };
}

/**
 * Create a mock logger factory
 */
export function createMockLoggerFactory(): LoggerFactory {
  return vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  })) as unknown as LoggerFactory;
}

/**
 * Create a test container with all dependencies mocked.
 * Returns both the container and the mock instances for assertions.
 *
 * @example
 * ```typescript
 * const { container, mocks } = createTestContainer();
 * const processor = container.resolve('stepProcessor');
 *
 * mocks.prisma.step.findUnique.mockResolvedValue({ id: 'step-1', toolName: 'http-fetch' });
 * mocks.tool.execute.mockResolvedValue({ success: true, data: { result: 'done' } });
 *
 * await processor.processExecute(jobData, 0);
 *
 * expect(mocks.tool.execute).toHaveBeenCalled();
 * ```
 */
export function createTestContainer(
  overrides?: Partial<Record<keyof WorkerCradle, unknown>>
): TestContainerResult {
  const mocks = createMockFactories();
  const mockLoggerFactory = createMockLoggerFactory();

  const container = createContainer<WorkerCradle>({
    injectionMode: InjectionMode.PROXY,
    strict: true,
  });

  container.register({
    // Infrastructure - use mocks
    prisma: asValue(mocks.prisma as unknown as PrismaClient),
    redis: asValue(mocks.redis as unknown as Redis),

    // Queues - use mocks
    workflowQueue: asValue(
      mocks.workflowQueue as unknown as Queue<
        WorkflowExecuteJobData | WorkflowContinueJobData
      >
    ),
    stepQueue: asValue(mocks.stepQueue as unknown as Queue<StepExecuteJobData>),

    // Core Services - use mocks
    toolRegistry: asValue(mocks.toolRegistry as unknown as IToolRegistry),
    variableResolver: asValue(
      mocks.variableResolver as unknown as IVariableResolver
    ),
    sequentialOrchestrator: asValue(
      mocks.sequentialOrchestrator as unknown as ISequentialOrchestrator
    ),

    // Logger factory
    createLogger: asValue(mockLoggerFactory),

    // Processors - real implementations that use mocked deps
    workflowProcessor: asClass(WorkflowProcessor, {
      lifetime: Lifetime.TRANSIENT,
    }),
    stepProcessor: asClass(StepProcessor, { lifetime: Lifetime.TRANSIENT }),
  });

  // Apply any overrides
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      container.register({
        [key]: asValue(value),
      });
    }
  }

  return { container, mocks };
}

/**
 * Helper to create a mock step for testing
 */
export function createMockStep(overrides?: Partial<{
  id: string;
  name: string;
  toolName: string;
  config: Record<string, unknown>;
  retryConfig: Record<string, unknown> | null;
  timeout: number | null;
}>) {
  return {
    id: 'step-1',
    name: 'test-step',
    toolName: 'http-fetch',
    config: {},
    retryConfig: null,
    timeout: null,
    ...overrides,
  };
}

/**
 * Helper to create a mock workflow run for testing
 */
export function createMockWorkflowRun(overrides?: Partial<{
  id: string;
  workflowId: string;
  status: string;
  input: Record<string, unknown>;
}>) {
  return {
    id: 'run-1',
    workflowId: 'wf-1',
    status: 'RUNNING',
    input: {},
    ...overrides,
  };
}

/**
 * Helper to create a mock step run for testing
 */
export function createMockStepRun(overrides?: Partial<{
  id: string;
  workflowRunId: string;
  stepId: string;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
}>) {
  return {
    id: 'sr-1',
    workflowRunId: 'run-1',
    stepId: 'step-1',
    status: 'PENDING',
    input: {},
    output: null,
    ...overrides,
  };
}
