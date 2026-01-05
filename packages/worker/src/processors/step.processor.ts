import type { Job } from 'bullmq';
import { prisma, Prisma } from '@workflow/database';
import type { StepExecuteJobData } from '@workflow/queue';
import { toolRegistry } from '@workflow/tools';
import { createLogger, StepExecutionError } from '@workflow/shared';
import type { ToolContext } from '@workflow/shared';

const logger = createLogger('step-processor');

export async function processStepExecute(
  job: Job<StepExecuteJobData>
): Promise<Record<string, unknown>> {
  const { stepRunId, stepId, workflowRunId, input } = job.data;

  logger.info(
    { stepRunId, stepId, attempt: job.attemptsMade + 1 },
    'Executing step'
  );

  await prisma.stepRun.update({
    where: { id: stepRunId },
    data: {
      status: 'RUNNING',
      attemptsMade: job.attemptsMade + 1,
      startedAt: new Date(),
    },
  });

  const step = await prisma.step.findUnique({
    where: { id: stepId },
  });

  if (!step) {
    throw new StepExecutionError(stepId, 'Step not found', false);
  }

  const tool = toolRegistry.get(step.toolName);

  const workflowRun = await prisma.workflowRun.findUnique({
    where: { id: workflowRunId },
  });

  const stepRun = await prisma.stepRun.findUnique({
    where: { id: stepRunId },
  });

  if (!workflowRun || !stepRun) {
    throw new StepExecutionError(stepId, 'Run context not found', false);
  }

  const previousStepRuns = await prisma.stepRun.findMany({
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

  const context: ToolContext = {
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

  const result = await tool.execute(input, context);

  if (!result.success) {
    const error = result.error ?? 'Unknown error';
    await prisma.stepRun.update({
      where: { id: stepRunId },
      data: { error },
    });
    throw new StepExecutionError(stepId, error, true);
  }

  const output = (result.data ?? {}) as Record<string, unknown>;

  await prisma.stepRun.update({
    where: { id: stepRunId },
    data: {
      status: 'COMPLETED',
      output: output as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });

  logger.info({ stepRunId, stepId }, 'Step completed successfully');

  return output;
}
