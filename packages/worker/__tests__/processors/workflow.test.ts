import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  workflowRun: {
    update: vi.fn(),
    findUnique: vi.fn(),
  },
  stepRun: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
};

const mockOrchestrator = {
  initialize: vi.fn(),
  getNextStep: vi.fn(),
};

const mockStepQueueAdd = vi.fn();

vi.mock('@workflow/database', () => ({
  prisma: mockPrisma,
}));

vi.mock('@workflow/engine', () => ({
  sequentialOrchestrator: mockOrchestrator,
}));

vi.mock('@workflow/queue', () => ({
  getStepQueue: vi.fn(() => ({
    add: mockStepQueueAdd,
  })),
}));

vi.mock('@workflow/shared', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
  })),
}));

describe('workflow processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processWorkflowExecute', () => {
    it('updates run status to RUNNING', async () => {
      mockOrchestrator.initialize.mockResolvedValue({
        completed: true,
        nextStep: null,
        stepInput: null,
      });

      const { processWorkflowExecute } = await import(
        '../../src/processors/workflow.processor.js'
      );

      const mockJob = {
        data: { workflowRunId: 'run-1', workflowId: 'wf-1' },
      };

      await processWorkflowExecute(mockJob as any);

      expect(mockPrisma.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: {
          status: 'RUNNING',
          startedAt: expect.any(Date),
        },
      });
    });

    it('enqueues first step when workflow has steps', async () => {
      mockOrchestrator.initialize.mockResolvedValue({
        completed: false,
        nextStep: {
          id: 'step-1',
          retryConfig: { maxAttempts: 3, backoff: { type: 'exponential', delay: 1000 } },
          timeout: 30000,
        },
        stepInput: { value: 'test' },
      });
      mockPrisma.stepRun.create.mockResolvedValue({
        id: 'sr-1',
      });

      const { processWorkflowExecute } = await import(
        '../../src/processors/workflow.processor.js'
      );

      const mockJob = {
        data: { workflowRunId: 'run-1', workflowId: 'wf-1' },
      };

      await processWorkflowExecute(mockJob as any);

      expect(mockPrisma.stepRun.create).toHaveBeenCalledWith({
        data: {
          workflowRunId: 'run-1',
          stepId: 'step-1',
          status: 'PENDING',
          input: { value: 'test' },
          maxAttempts: 3,
        },
      });

      expect(mockStepQueueAdd).toHaveBeenCalledWith(
        'step.execute',
        expect.objectContaining({
          stepRunId: 'sr-1',
          stepId: 'step-1',
          workflowRunId: 'run-1',
          input: { value: 'test' },
        }),
        expect.objectContaining({
          jobId: 'sr-1',
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        })
      );
    });

    it('marks workflow completed when no steps', async () => {
      mockOrchestrator.initialize.mockResolvedValue({
        completed: true,
        nextStep: null,
        stepInput: null,
      });

      const { processWorkflowExecute } = await import(
        '../../src/processors/workflow.processor.js'
      );

      const mockJob = {
        data: { workflowRunId: 'run-1', workflowId: 'wf-1' },
      };

      await processWorkflowExecute(mockJob as any);

      expect(mockPrisma.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: {
          status: 'COMPLETED',
          completedAt: expect.any(Date),
        },
      });
    });
  });

  describe('processWorkflowContinue', () => {
    it('enqueues next step when more steps remain', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        id: 'run-1',
        status: 'RUNNING',
      });
      mockOrchestrator.getNextStep.mockResolvedValue({
        completed: false,
        nextStep: {
          id: 'step-2',
          retryConfig: null,
          timeout: null,
        },
        stepInput: { data: 'next' },
      });
      mockPrisma.stepRun.create.mockResolvedValue({ id: 'sr-2' });

      const { processWorkflowContinue } = await import(
        '../../src/processors/workflow.processor.js'
      );

      const mockJob = {
        data: { workflowRunId: 'run-1', completedStepRunId: 'sr-1' },
      };

      await processWorkflowContinue(mockJob as any);

      expect(mockOrchestrator.getNextStep).toHaveBeenCalledWith('run-1', 'sr-1');
      expect(mockPrisma.stepRun.create).toHaveBeenCalled();
      expect(mockStepQueueAdd).toHaveBeenCalled();
    });

    it('marks workflow completed at end', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        id: 'run-1',
        status: 'RUNNING',
      });
      mockOrchestrator.getNextStep.mockResolvedValue({
        completed: true,
        nextStep: null,
        stepInput: null,
      });
      mockPrisma.stepRun.findMany.mockResolvedValue([
        { id: 'sr-1', output: { result: 'final' } },
      ]);

      const { processWorkflowContinue } = await import(
        '../../src/processors/workflow.processor.js'
      );

      const mockJob = {
        data: { workflowRunId: 'run-1', completedStepRunId: 'sr-1' },
      };

      await processWorkflowContinue(mockJob as any);

      expect(mockPrisma.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: {
          status: 'COMPLETED',
          output: { result: 'final' },
          completedAt: expect.any(Date),
        },
      });
    });

    it('skips processing for cancelled runs', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        id: 'run-1',
        status: 'CANCELLED',
      });

      const { processWorkflowContinue } = await import(
        '../../src/processors/workflow.processor.js'
      );

      const mockJob = {
        data: { workflowRunId: 'run-1', completedStepRunId: 'sr-1' },
      };

      await processWorkflowContinue(mockJob as any);

      expect(mockOrchestrator.getNextStep).not.toHaveBeenCalled();
    });
  });
});
