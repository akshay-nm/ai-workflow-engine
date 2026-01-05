import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  stepRun: {
    update: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  step: {
    findUnique: vi.fn(),
  },
  workflowRun: {
    findUnique: vi.fn(),
  },
};

const mockTool = {
  execute: vi.fn(),
};

const mockToolRegistry = {
  get: vi.fn(() => mockTool),
};

vi.mock('@workflow/database', () => ({
  prisma: mockPrisma,
}));

vi.mock('@workflow/tools', () => ({
  toolRegistry: mockToolRegistry,
}));

vi.mock('@workflow/shared', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
  })),
  StepExecutionError: class StepExecutionError extends Error {
    constructor(
      public stepId: string,
      message: string,
      public retryable: boolean = true
    ) {
      super(`Step '${stepId}' failed: ${message}`);
    }
  },
}));

describe('step processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processStepExecute', () => {
    const mockJob = {
      data: {
        stepRunId: 'sr-1',
        stepId: 'step-1',
        workflowRunId: 'run-1',
        input: { value: 'test' },
      },
      attemptsMade: 0,
    };

    beforeEach(() => {
      mockPrisma.step.findUnique.mockResolvedValue({
        id: 'step-1',
        toolName: 'http-fetch',
      });
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        id: 'run-1',
        workflowId: 'wf-1',
        status: 'RUNNING',
        input: {},
      });
      mockPrisma.stepRun.findUnique.mockResolvedValue({
        id: 'sr-1',
        workflowRunId: 'run-1',
        stepId: 'step-1',
        status: 'PENDING',
      });
      mockPrisma.stepRun.findMany.mockResolvedValue([]);
    });

    it('updates stepRun status to RUNNING', async () => {
      mockTool.execute.mockResolvedValue({
        success: true,
        data: { result: 'done' },
      });

      const { processStepExecute } = await import(
        '../../src/processors/step.processor.js'
      );

      await processStepExecute(mockJob as any);

      expect(mockPrisma.stepRun.update).toHaveBeenCalledWith({
        where: { id: 'sr-1' },
        data: {
          status: 'RUNNING',
          attemptsMade: 1,
          startedAt: expect.any(Date),
        },
      });
    });

    it('calls tool.execute with input and context', async () => {
      mockTool.execute.mockResolvedValue({
        success: true,
        data: { result: 'done' },
      });

      const { processStepExecute } = await import(
        '../../src/processors/step.processor.js'
      );

      await processStepExecute(mockJob as any);

      expect(mockToolRegistry.get).toHaveBeenCalledWith('http-fetch');
      expect(mockTool.execute).toHaveBeenCalledWith(
        { value: 'test' },
        expect.objectContaining({
          workflowRun: expect.any(Object),
          stepRun: expect.any(Object),
          previousOutputs: expect.any(Object),
        })
      );
    });

    it('stores output on success', async () => {
      mockTool.execute.mockResolvedValue({
        success: true,
        data: { result: 'done' },
      });

      const { processStepExecute } = await import(
        '../../src/processors/step.processor.js'
      );

      await processStepExecute(mockJob as any);

      expect(mockPrisma.stepRun.update).toHaveBeenCalledWith({
        where: { id: 'sr-1' },
        data: {
          status: 'COMPLETED',
          output: { result: 'done' },
          completedAt: expect.any(Date),
        },
      });
    });

    it('throws StepExecutionError on tool failure', async () => {
      mockTool.execute.mockResolvedValue({
        success: false,
        error: 'Tool failed',
      });

      const { processStepExecute } = await import(
        '../../src/processors/step.processor.js'
      );

      await expect(processStepExecute(mockJob as any)).rejects.toThrow(
        "Step 'step-1' failed: Tool failed"
      );

      expect(mockPrisma.stepRun.update).toHaveBeenCalledWith({
        where: { id: 'sr-1' },
        data: { error: 'Tool failed' },
      });
    });

    it('throws for missing step', async () => {
      mockPrisma.step.findUnique.mockResolvedValue(null);

      const { processStepExecute } = await import(
        '../../src/processors/step.processor.js'
      );

      await expect(processStepExecute(mockJob as any)).rejects.toThrow(
        'Step not found'
      );
    });

    it('builds context with previous step outputs', async () => {
      mockPrisma.stepRun.findMany.mockResolvedValue([
        {
          id: 'sr-0',
          status: 'COMPLETED',
          output: { data: 'previous' },
          step: { name: 'fetch' },
        },
      ]);
      mockTool.execute.mockResolvedValue({ success: true, data: {} });

      const { processStepExecute } = await import(
        '../../src/processors/step.processor.js'
      );

      await processStepExecute(mockJob as any);

      expect(mockTool.execute).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          previousOutputs: { fetch: { data: 'previous' } },
        })
      );
    });

    it('returns output on success', async () => {
      mockTool.execute.mockResolvedValue({
        success: true,
        data: { result: 'done' },
      });

      const { processStepExecute } = await import(
        '../../src/processors/step.processor.js'
      );

      const result = await processStepExecute(mockJob as any);

      expect(result).toEqual({ result: 'done' });
    });
  });
});
