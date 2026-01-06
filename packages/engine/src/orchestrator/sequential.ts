import { prisma as defaultPrisma, type PrismaClient } from '@workflow/database';
import type { Step, StepRun, WorkflowRun } from '@workflow/database';
import {
  NotFoundError,
  WorkflowExecutionError,
  type ISequentialOrchestrator,
  type IVariableResolver,
} from '@workflow/shared';
import {
  VariableResolver,
  variableResolver as defaultVariableResolver,
  type ResolverContext,
} from '../variable-resolver/index.js';

export interface OrchestratorResult {
  completed: boolean;
  nextStep: Step | null;
  stepInput: Record<string, unknown> | null;
}

/**
 * Dependencies for SequentialOrchestrator
 */
export interface SequentialOrchestratorDeps {
  prisma?: PrismaClient;
  variableResolver?: IVariableResolver;
}

/**
 * Sequential workflow orchestrator.
 * Executes workflow steps in order based on their `order` field.
 */
export class SequentialOrchestrator implements ISequentialOrchestrator {
  private readonly prisma: PrismaClient;
  private readonly variableResolver: IVariableResolver;

  /**
   * Create a new SequentialOrchestrator instance.
   * @param deps - Optional dependencies. Falls back to defaults if not provided.
   */
  constructor(deps: SequentialOrchestratorDeps = {}) {
    this.prisma = deps.prisma ?? defaultPrisma;
    this.variableResolver = deps.variableResolver ?? defaultVariableResolver;
  }

  async initialize(workflowRunId: string): Promise<OrchestratorResult> {
    const workflowRun = await this.prisma.workflowRun.findUnique({
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
    const stepInput = this.variableResolver.resolve(
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
    const workflowRun = await this.prisma.workflowRun.findUnique({
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
    const stepInput = this.variableResolver.resolve(
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

/** Default singleton instance for backward compatibility */
export const sequentialOrchestrator = new SequentialOrchestrator();
