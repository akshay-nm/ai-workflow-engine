import {
  prisma as defaultPrisma,
  Prisma,
  type PrismaClient,
} from '@workflow/database';
import { toolRegistry as defaultToolRegistry } from '@workflow/tools';
import {
  createLogger,
  StepExecutionError,
  type Logger,
  type ToolContext,
  type IToolRegistry,
  type IStepProcessor,
  type StepExecuteJobData,
  type LoggerFactory,
} from '@workflow/shared';

/**
 * Dependencies for StepProcessor
 */
export interface StepProcessorDeps {
  prisma: PrismaClient;
  toolRegistry: IToolRegistry;
  createLogger: LoggerFactory;
}

/**
 * Processor for step execution jobs.
 * Handles individual step execution within a workflow.
 */
export class StepProcessor implements IStepProcessor {
  private readonly prisma: PrismaClient;
  private readonly toolRegistry: IToolRegistry;
  private readonly logger: Logger;

  constructor({
    prisma,
    toolRegistry,
    createLogger: loggerFactory,
  }: StepProcessorDeps) {
    this.prisma = prisma;
    this.toolRegistry = toolRegistry;
    this.logger = loggerFactory('step-processor');
  }

  /**
   * Process a step execution job.
   * Executes the tool associated with the step and stores the result.
   */
  async processExecute(
    data: StepExecuteJobData,
    attemptsMade: number
  ): Promise<Record<string, unknown>> {
    const { stepRunId, stepId, workflowRunId, input } = data;

    this.logger.info(
      { stepRunId, stepId, attempt: attemptsMade + 1 },
      'Executing step'
    );

    await this.prisma.stepRun.update({
      where: { id: stepRunId },
      data: {
        status: 'RUNNING',
        attemptsMade: attemptsMade + 1,
        startedAt: new Date(),
      },
    });

    const step = await this.prisma.step.findUnique({
      where: { id: stepId },
    });

    if (!step) {
      throw new StepExecutionError(stepId, 'Step not found', false);
    }

    const tool = this.toolRegistry.get(step.toolName);

    const context = await this.buildContext(workflowRunId, stepRunId);
    const result = await tool.execute(input, context);

    if (!result.success) {
      const error = result.error ?? 'Unknown error';
      await this.prisma.stepRun.update({
        where: { id: stepRunId },
        data: { error },
      });
      throw new StepExecutionError(stepId, error, true);
    }

    const output = (result.data ?? {}) as Record<string, unknown>;

    await this.prisma.stepRun.update({
      where: { id: stepRunId },
      data: {
        status: 'COMPLETED',
        output: output as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });

    this.logger.info({ stepRunId, stepId }, 'Step completed successfully');

    return output;
  }

  /**
   * Build the tool execution context.
   */
  private async buildContext(
    workflowRunId: string,
    stepRunId: string
  ): Promise<ToolContext> {
    const workflowRun = await this.prisma.workflowRun.findUnique({
      where: { id: workflowRunId },
    });

    const stepRun = await this.prisma.stepRun.findUnique({
      where: { id: stepRunId },
    });

    if (!workflowRun || !stepRun) {
      throw new StepExecutionError(stepRunId, 'Run context not found', false);
    }

    const previousStepRuns = await this.prisma.stepRun.findMany({
      where: {
        workflowRunId,
        status: 'COMPLETED',
      },
      include: { step: true },
    });

    const previousOutputs: Record<string, Record<string, unknown>> = {};
    for (const sr of previousStepRuns) {
      if (sr.output) {
        previousOutputs[sr.step.name] = sr.output as Record<string, unknown>;
      }
    }

    return {
      workflowRun: {
        id: workflowRun.id,
        workflowId: workflowRun.workflowId,
        status: workflowRun.status,
        input: workflowRun.input as Record<string, unknown> | null,
        output: workflowRun.output as Record<string, unknown> | null,
        error: workflowRun.error,
        startedAt: workflowRun.startedAt,
        completedAt: workflowRun.completedAt,
        createdAt: workflowRun.createdAt,
      },
      stepRun: {
        id: stepRun.id,
        workflowRunId: stepRun.workflowRunId,
        stepId: stepRun.stepId,
        status: stepRun.status,
        input: stepRun.input as Record<string, unknown> | null,
        output: stepRun.output as Record<string, unknown> | null,
        error: stepRun.error,
        attemptsMade: stepRun.attemptsMade,
        maxAttempts: stepRun.maxAttempts,
        startedAt: stepRun.startedAt,
        completedAt: stepRun.completedAt,
        createdAt: stepRun.createdAt,
      },
      previousOutputs,
      variables: (workflowRun.input as Record<string, unknown>) ?? {},
    };
  }
}

// Backward-compatible function export (delegates to default class instance)
let defaultProcessor: StepProcessor | null = null;

function getDefaultProcessor(): StepProcessor {
  if (!defaultProcessor) {
    defaultProcessor = new StepProcessor({
      prisma: defaultPrisma,
      toolRegistry: defaultToolRegistry,
      createLogger,
    });
  }
  return defaultProcessor;
}

/**
 * @deprecated Use StepProcessor class directly
 */
export async function processStepExecute(
  job: { data: StepExecuteJobData; attemptsMade: number }
): Promise<Record<string, unknown>> {
  return getDefaultProcessor().processExecute(job.data, job.attemptsMade);
}
