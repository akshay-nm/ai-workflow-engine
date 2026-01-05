import type { Job } from 'bullmq';
import { prisma, Prisma } from '@workflow/database';
import { sequentialOrchestrator } from '@workflow/engine';
import {
  getStepQueue,
  type WorkflowExecuteJobData,
  type WorkflowContinueJobData,
} from '@workflow/queue';
import { createLogger } from '@workflow/shared';

const logger = createLogger('workflow-processor');

export async function processWorkflowExecute(
  job: Job<WorkflowExecuteJobData>
): Promise<void> {
  const { workflowRunId, workflowId } = job.data;

  logger.info({ workflowRunId, workflowId }, 'Starting workflow execution');

  await prisma.workflowRun.update({
    where: { id: workflowRunId },
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
    },
  });

  const result = await sequentialOrchestrator.initialize(workflowRunId);

  if (result.completed) {
    await prisma.workflowRun.update({
      where: { id: workflowRunId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    logger.info({ workflowRunId }, 'Workflow completed (no steps)');
    return;
  }

  if (result.nextStep && result.stepInput !== null) {
    const step = result.nextStep;
    const retryConfig = step.retryConfig as {
      maxAttempts?: number;
      backoff?: { type: 'exponential' | 'fixed'; delay: number };
    } | null;

    const stepRun = await prisma.stepRun.create({
      data: {
        workflowRunId,
        stepId: step.id,
        status: 'PENDING',
        input: result.stepInput as Prisma.InputJsonValue,
        maxAttempts: retryConfig?.maxAttempts ?? 3,
      },
    });

    const stepQueue = getStepQueue();
    await stepQueue.add(
      'step.execute',
      {
        stepRunId: stepRun.id,
        stepId: step.id,
        workflowRunId,
        input: result.stepInput,
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

    logger.info({ workflowRunId, stepId: step.id }, 'Enqueued first step');
  }
}

export async function processWorkflowContinue(
  job: Job<WorkflowContinueJobData>
): Promise<void> {
  const { workflowRunId, completedStepRunId } = job.data;

  logger.info({ workflowRunId, completedStepRunId }, 'Continuing workflow');

  const currentRun = await prisma.workflowRun.findUnique({
    where: { id: workflowRunId },
  });

  if (!currentRun || currentRun.status === 'CANCELLED') {
    logger.info({ workflowRunId }, 'Workflow cancelled, skipping continue');
    return;
  }

  const result = await sequentialOrchestrator.getNextStep(
    workflowRunId,
    completedStepRunId
  );

  if (result.completed) {
    const stepRuns = await prisma.stepRun.findMany({
      where: { workflowRunId },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    const lastStepRun = stepRuns[0];

    await prisma.workflowRun.update({
      where: { id: workflowRunId },
      data: {
        status: 'COMPLETED',
        output: (lastStepRun?.output ?? {}) as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });

    logger.info({ workflowRunId }, 'Workflow completed');
    return;
  }

  if (result.nextStep && result.stepInput !== null) {
    const step = result.nextStep;
    const retryConfig = step.retryConfig as {
      maxAttempts?: number;
      backoff?: { type: 'exponential' | 'fixed'; delay: number };
    } | null;

    const stepRun = await prisma.stepRun.create({
      data: {
        workflowRunId,
        stepId: step.id,
        status: 'PENDING',
        input: result.stepInput as Prisma.InputJsonValue,
        maxAttempts: retryConfig?.maxAttempts ?? 3,
      },
    });

    const stepQueue = getStepQueue();
    await stepQueue.add(
      'step.execute',
      {
        stepRunId: stepRun.id,
        stepId: step.id,
        workflowRunId,
        input: result.stepInput,
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

    logger.info({ workflowRunId, stepId: step.id }, 'Enqueued next step');
  }
}
