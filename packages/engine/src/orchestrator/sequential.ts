import { prisma } from '@workflow/database';
import type { Step, StepRun, WorkflowRun } from '@workflow/database';
import { NotFoundError, WorkflowExecutionError } from '@workflow/shared';
import { variableResolver, type ResolverContext } from '../variable-resolver/index.js';

export interface OrchestratorResult {
  completed: boolean;
  nextStep: Step | null;
  stepInput: Record<string, unknown> | null;
}

export class SequentialOrchestrator {
  async initialize(workflowRunId: string): Promise<OrchestratorResult> {
    const workflowRun = await prisma.workflowRun.findUnique({
      where: { id: workflowRunId },
      include: {
        workflow: {
          include: {
            steps: { orderBy: { order: 'asc' } },
          },
        },
      },
    });

    if (!workflowRun) {
      throw new NotFoundError('WorkflowRun', workflowRunId);
    }

    const firstStep = workflowRun.workflow.steps[0];
    if (!firstStep) {
      return { completed: true, nextStep: null, stepInput: null };
    }

    const context = this.buildContext(workflowRun, []);
    const stepInput = variableResolver.resolve(
      firstStep.inputMapping,
      context
    ) as Record<string, unknown>;

    return {
      completed: false,
      nextStep: firstStep,
      stepInput,
    };
  }

  async getNextStep(
    workflowRunId: string,
    completedStepRunId: string
  ): Promise<OrchestratorResult> {
    const workflowRun = await prisma.workflowRun.findUnique({
      where: { id: workflowRunId },
      include: {
        workflow: {
          include: {
            steps: { orderBy: { order: 'asc' } },
          },
        },
        stepRuns: {
          include: { step: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!workflowRun) {
      throw new NotFoundError('WorkflowRun', workflowRunId);
    }

    const completedStepRun = workflowRun.stepRuns.find(
      (sr) => sr.id === completedStepRunId
    );

    if (!completedStepRun) {
      throw new NotFoundError('StepRun', completedStepRunId);
    }

    if (completedStepRun.status === 'FAILED') {
      throw new WorkflowExecutionError(
        workflowRunId,
        `Step '${completedStepRun.step.name}' failed: ${completedStepRun.error}`
      );
    }

    const currentStepOrder = completedStepRun.step.order;
    const nextStep = workflowRun.workflow.steps.find(
      (s) => s.order > currentStepOrder
    );

    if (!nextStep) {
      return { completed: true, nextStep: null, stepInput: null };
    }

    const context = this.buildContext(workflowRun, workflowRun.stepRuns);
    const stepInput = variableResolver.resolve(
      nextStep.inputMapping,
      context
    ) as Record<string, unknown>;

    return {
      completed: false,
      nextStep,
      stepInput,
    };
  }

  private buildContext(
    workflowRun: WorkflowRun & { stepRuns?: (StepRun & { step: Step })[] },
    stepRuns: (StepRun & { step: Step })[]
  ): ResolverContext {
    const steps: Record<string, Record<string, unknown>> = {};

    for (const stepRun of stepRuns) {
      if (stepRun.status === 'COMPLETED' && stepRun.output) {
        steps[stepRun.step.name] = stepRun.output as Record<string, unknown>;
      }
    }

    return {
      input: (workflowRun.input as Record<string, unknown>) ?? {},
      steps,
      env: process.env as Record<string, string | undefined>,
    };
  }
}

export const sequentialOrchestrator = new SequentialOrchestrator();
