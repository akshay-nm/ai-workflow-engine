import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  workflowRun: {
    findUnique: vi.fn(),
  },
  stepRun: {
    findMany: vi.fn(),
  },
};

vi.mock('@workflow/database', () => ({
  prisma: mockPrisma,
}));

describe('SequentialOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialize', () => {
    it('returns first step with resolved input', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        id: 'run-1',
        workflowId: 'wf-1',
        input: { name: 'test' },
        workflow: {
          steps: [
            {
              id: 'step-1',
              name: 'first',
              order: 0,
              inputMapping: { value: '{{ input.name }}' },
              retryConfig: null,
              timeout: null,
            },
          ],
        },
      });

      const { SequentialOrchestrator } = await import(
        '../../src/orchestrator/sequential.js'
      );
      const orchestrator = new SequentialOrchestrator();

      const result = await orchestrator.initialize('run-1');

      expect(result.completed).toBe(false);
      expect(result.nextStep?.id).toBe('step-1');
      expect(result.stepInput).toEqual({ value: 'test' });
    });

    it('returns completed true for empty workflow', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        id: 'run-1',
        workflowId: 'wf-1',
        input: {},
        workflow: {
          steps: [],
        },
      });

      const { SequentialOrchestrator } = await import(
        '../../src/orchestrator/sequential.js'
      );
      const orchestrator = new SequentialOrchestrator();

      const result = await orchestrator.initialize('run-1');

      expect(result.completed).toBe(true);
      expect(result.nextStep).toBeNull();
      expect(result.stepInput).toBeNull();
    });

    it('throws NotFoundError for missing run', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue(null);

      const { SequentialOrchestrator } = await import(
        '../../src/orchestrator/sequential.js'
      );
      const orchestrator = new SequentialOrchestrator();

      await expect(orchestrator.initialize('missing-run')).rejects.toThrow(
        "WorkflowRun with id 'missing-run' not found"
      );
    });
  });

  describe('getNextStep', () => {
    it('returns next step by order', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        id: 'run-1',
        workflowId: 'wf-1',
        input: {},
        workflow: {
          steps: [
            { id: 'step-1', name: 'first', order: 0, inputMapping: {} },
            { id: 'step-2', name: 'second', order: 1, inputMapping: {}, retryConfig: null, timeout: null },
          ],
        },
        stepRuns: [
          {
            id: 'sr-1',
            stepId: 'step-1',
            status: 'COMPLETED',
            output: { result: 'done' },
            step: { name: 'first', order: 0 },
          },
        ],
      });

      const { SequentialOrchestrator } = await import(
        '../../src/orchestrator/sequential.js'
      );
      const orchestrator = new SequentialOrchestrator();

      const result = await orchestrator.getNextStep('run-1', 'sr-1');

      expect(result.completed).toBe(false);
      expect(result.nextStep?.id).toBe('step-2');
    });

    it('returns completed true at end of workflow', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        id: 'run-1',
        workflowId: 'wf-1',
        input: {},
        workflow: {
          steps: [
            { id: 'step-1', name: 'first', order: 0, inputMapping: {} },
          ],
        },
        stepRuns: [
          {
            id: 'sr-1',
            stepId: 'step-1',
            status: 'COMPLETED',
            output: { result: 'done' },
            step: { name: 'first', order: 0 },
          },
        ],
      });

      const { SequentialOrchestrator } = await import(
        '../../src/orchestrator/sequential.js'
      );
      const orchestrator = new SequentialOrchestrator();

      const result = await orchestrator.getNextStep('run-1', 'sr-1');

      expect(result.completed).toBe(true);
      expect(result.nextStep).toBeNull();
    });

    it('throws WorkflowExecutionError on failed step', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        id: 'run-1',
        workflowId: 'wf-1',
        input: {},
        workflow: {
          steps: [{ id: 'step-1', name: 'first', order: 0 }],
        },
        stepRuns: [
          {
            id: 'sr-1',
            stepId: 'step-1',
            status: 'FAILED',
            error: 'Something went wrong',
            step: { name: 'first', order: 0 },
          },
        ],
      });

      const { SequentialOrchestrator } = await import(
        '../../src/orchestrator/sequential.js'
      );
      const orchestrator = new SequentialOrchestrator();

      await expect(orchestrator.getNextStep('run-1', 'sr-1')).rejects.toThrow(
        "Step 'first' failed: Something went wrong"
      );
    });

    it('throws NotFoundError for missing run', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue(null);

      const { SequentialOrchestrator } = await import(
        '../../src/orchestrator/sequential.js'
      );
      const orchestrator = new SequentialOrchestrator();

      await expect(
        orchestrator.getNextStep('missing-run', 'sr-1')
      ).rejects.toThrow("WorkflowRun with id 'missing-run' not found");
    });

    it('throws NotFoundError for missing step run', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        id: 'run-1',
        workflowId: 'wf-1',
        input: {},
        workflow: { steps: [] },
        stepRuns: [],
      });

      const { SequentialOrchestrator } = await import(
        '../../src/orchestrator/sequential.js'
      );
      const orchestrator = new SequentialOrchestrator();

      await expect(
        orchestrator.getNextStep('run-1', 'missing-sr')
      ).rejects.toThrow("StepRun with id 'missing-sr' not found");
    });

    it('builds context with completed step outputs', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        id: 'run-1',
        workflowId: 'wf-1',
        input: { initial: 'value' },
        workflow: {
          steps: [
            { id: 'step-1', name: 'fetch', order: 0, inputMapping: {} },
            {
              id: 'step-2',
              name: 'transform',
              order: 1,
              inputMapping: { data: '{{ steps.fetch.result }}' },
              retryConfig: null,
              timeout: null,
            },
          ],
        },
        stepRuns: [
          {
            id: 'sr-1',
            stepId: 'step-1',
            status: 'COMPLETED',
            output: { result: 'fetched data' },
            step: { name: 'fetch', order: 0 },
          },
        ],
      });

      const { SequentialOrchestrator } = await import(
        '../../src/orchestrator/sequential.js'
      );
      const orchestrator = new SequentialOrchestrator();

      const result = await orchestrator.getNextStep('run-1', 'sr-1');

      expect(result.stepInput).toEqual({ data: 'fetched data' });
    });
  });
});
