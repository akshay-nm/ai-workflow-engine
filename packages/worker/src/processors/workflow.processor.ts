import type { Queue } from 'bullmq';
import {
  prisma as defaultPrisma,
  Prisma,
  type PrismaClient,
} from '@workflow/database';
import { sequentialOrchestrator as defaultOrchestrator } from '@workflow/engine';
import { getStepQueue } from '@workflow/queue';
import {
  createLogger,
  type Logger,
  type ISequentialOrchestrator,
  type IWorkflowProcessor,
  type WorkflowExecuteJobData,
  type WorkflowContinueJobData,
  type LoggerFactory,
  type StepExecuteJobData,
  type OrchestratorResult,
} from '@workflow/shared';

/**
 * Dependencies for WorkflowProcessor
 */
export interface WorkflowProcessorDeps {
  prisma: PrismaClient;
  sequentialOrchestrator: ISequentialOrchestrator;
  stepQueue: Queue<StepExecuteJobData>;
  createLogger: LoggerFactory;
}

/**
 * Processor for workflow jobs.
 * Handles workflow initialization and continuation.
 */
export class WorkflowProcessor implements IWorkflowProcessor {
  private readonly prisma: PrismaClient;
  private readonly orchestrator: ISequentialOrchestrator;
  private readonly stepQueue: Queue<StepExecuteJobData>;
  private readonly logger: Logger;

  constructor({
    prisma,
    sequentialOrchestrator,
    stepQueue,
    createLogger: loggerFactory,
  }: WorkflowProcessorDeps) {
    this.prisma = prisma;
    this.orchestrator = sequentialOrchestrator;
    this.stepQueue = stepQueue;
    this.logger = loggerFactory('workflow-processor');
  }

  /**
   * Process a workflow execute job.
   * Initializes the workflow and enqueues the first step.
   */
  async processExecute(data: WorkflowExecuteJobData): Promise<void> {
    const { workflowRunId, workflowId } = data;

    this.logger.info({ workflowRunId, workflowId }, 'Starting workflow execution');

    await this.prisma.workflowRun.update({
      where: { id: workflowRunId },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    const result = await this.orchestrator.initialize(workflowRunId);

    if (result.completed) {
      await this.prisma.workflowRun.update({
        where: { id: workflowRunId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
      this.logger.info({ workflowRunId }, 'Workflow completed (no steps)');
      return;
    }

    if (result.nextStep && result.stepInput !== null) {
      await this.enqueueStep(workflowRunId, result);
    }
  }

  /**
   * Process a workflow continue job.
   * Determines the next step and enqueues it, or completes the workflow.
   */
  async processContinue(data: WorkflowContinueJobData): Promise<void> {
    const { workflowRunId, completedStepRunId } = data;

    this.logger.info({ workflowRunId, completedStepRunId }, 'Continuing workflow');

    const currentRun = await this.prisma.workflowRun.findUnique({
      where: { id: workflowRunId },
    });

    if (!currentRun || currentRun.status === 'CANCELLED') {
      this.logger.info({ workflowRunId }, 'Workflow cancelled, skipping continue');
      return;
    }

    const result = await this.orchestrator.getNextStep(
      workflowRunId,
      completedStepRunId
    );

    if (result.completed) {
      const stepRuns = await this.prisma.stepRun.findMany({
        where: { workflowRunId },
        orderBy: { createdAt: 'desc' },
        take: 1,
      });

      const lastStepRun = stepRuns[0];

      await this.prisma.workflowRun.update({
        where: { id: workflowRunId },
        data: {
          status: 'COMPLETED',
          output: (lastStepRun?.output ?? {}) as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });

      this.logger.info({ workflowRunId }, 'Workflow completed');
      return;
    }

    if (result.nextStep && result.stepInput !== null) {
      await this.enqueueStep(workflowRunId, result);
    }
  }

  /**
   * Enqueue a step for execution.
   */
  private async enqueueStep(
    workflowRunId: string,
    result: OrchestratorResult
  ): Promise<void> {
    const step = result.nextStep!;
    const retryConfig = step.retryConfig as {
      maxAttempts?: number;
      backoff?: { type: 'exponential' | 'fixed'; delay: number };
    } | null;

    const stepRun = await this.prisma.stepRun.create({
      data: {
        workflowRunId,
        stepId: step.id,
        status: 'PENDING',
        input: result.stepInput as Prisma.InputJsonValue,
        maxAttempts: retryConfig?.maxAttempts ?? 3,
      },
    });

    await this.stepQueue.add(
      'step.execute',
      {
        stepRunId: stepRun.id,
        stepId: step.id,
        workflowRunId,
        input: result.stepInput!,
      },
      {
        jobId: stepRun.id,
        attempts: retryConfig?.maxAttempts ?? 3,
        backoff: retryConfig?.backoff ?? {
          type: 'exponential',
          delay: 1000,
        },
      }
    );

    this.logger.info({ workflowRunId, stepId: step.id }, 'Enqueued step');
  }
}

// Backward-compatible function exports (delegate to default class instance)
let defaultProcessor: WorkflowProcessor | null = null;

function getDefaultProcessor(): WorkflowProcessor {
  if (!defaultProcessor) {
    defaultProcessor = new WorkflowProcessor({
      prisma: defaultPrisma,
      sequentialOrchestrator: defaultOrchestrator,
      stepQueue: getStepQueue(),
      createLogger,
    });
  }
  return defaultProcessor;
}

/**
 * @deprecated Use WorkflowProcessor class directly
 */
export async function processWorkflowExecute(
  job: { data: WorkflowExecuteJobData }
): Promise<void> {
  return getDefaultProcessor().processExecute(job.data);
}

/**
 * @deprecated Use WorkflowProcessor class directly
 */
export async function processWorkflowContinue(
  job: { data: WorkflowContinueJobData }
): Promise<void> {
  return getDefaultProcessor().processContinue(job.data);
}
