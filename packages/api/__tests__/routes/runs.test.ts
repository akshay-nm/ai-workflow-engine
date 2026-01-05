import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  workflowRun: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  stepRun: {
    findMany: vi.fn(),
  },
};

vi.mock('@workflow/database', () => ({
  prisma: mockPrisma,
}));

describe('run handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRun', () => {
    it('returns run with workflow and stepRuns', async () => {
      const mockRun = {
        id: 'run-1',
        workflowId: 'wf-1',
        status: 'RUNNING',
        workflow: { name: 'Test' },
        stepRuns: [{ id: 'sr-1', status: 'COMPLETED' }],
      };
      mockPrisma.workflowRun.findUnique.mockResolvedValue(mockRun);

      const { getRun } = await import('../../src/routes/runs/handlers.js');

      const mockRequest = { params: { id: 'run-1' } };
      const mockReply = { send: vi.fn() };

      await getRun(mockRequest as any, mockReply as any);

      expect(mockPrisma.workflowRun.findUnique).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        include: {
          workflow: true,
          stepRuns: {
            include: { step: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      expect(mockReply.send).toHaveBeenCalledWith(mockRun);
    });

    it('throws NotFoundError for missing run', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue(null);

      const { getRun } = await import('../../src/routes/runs/handlers.js');

      const mockRequest = { params: { id: 'missing' } };
      const mockReply = { send: vi.fn() };

      await expect(
        getRun(mockRequest as any, mockReply as any)
      ).rejects.toThrow("WorkflowRun with id 'missing' not found");
    });
  });

  describe('listRuns', () => {
    it('returns all runs sorted by createdAt', async () => {
      const mockRuns = [{ id: 'run-2' }, { id: 'run-1' }];
      mockPrisma.workflowRun.findMany.mockResolvedValue(mockRuns);

      const { listRuns } = await import('../../src/routes/runs/handlers.js');

      const mockRequest = { query: {} };
      const mockReply = { send: vi.fn() };

      await listRuns(mockRequest as any, mockReply as any);

      expect(mockPrisma.workflowRun.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      expect(mockReply.send).toHaveBeenCalledWith(mockRuns);
    });

    it('filters by workflowId when provided', async () => {
      mockPrisma.workflowRun.findMany.mockResolvedValue([]);

      const { listRuns } = await import('../../src/routes/runs/handlers.js');

      const mockRequest = { query: { workflowId: 'wf-1' } };
      const mockReply = { send: vi.fn() };

      await listRuns(mockRequest as any, mockReply as any);

      expect(mockPrisma.workflowRun.findMany).toHaveBeenCalledWith({
        where: { workflowId: 'wf-1' },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    });
  });

  describe('getRunSteps', () => {
    it('returns step runs for existing run', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue({ id: 'run-1' });
      const mockStepRuns = [
        { id: 'sr-1', status: 'COMPLETED' },
        { id: 'sr-2', status: 'RUNNING' },
      ];
      mockPrisma.stepRun.findMany.mockResolvedValue(mockStepRuns);

      const { getRunSteps } = await import('../../src/routes/runs/handlers.js');

      const mockRequest = { params: { id: 'run-1' } };
      const mockReply = { send: vi.fn() };

      await getRunSteps(mockRequest as any, mockReply as any);

      expect(mockPrisma.stepRun.findMany).toHaveBeenCalledWith({
        where: { workflowRunId: 'run-1' },
        include: { step: true },
        orderBy: { createdAt: 'asc' },
      });
      expect(mockReply.send).toHaveBeenCalledWith(mockStepRuns);
    });

    it('throws NotFoundError for missing run', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue(null);

      const { getRunSteps } = await import('../../src/routes/runs/handlers.js');

      const mockRequest = { params: { id: 'missing' } };
      const mockReply = { send: vi.fn() };

      await expect(
        getRunSteps(mockRequest as any, mockReply as any)
      ).rejects.toThrow("WorkflowRun with id 'missing' not found");
    });
  });

  describe('cancelRun', () => {
    it('cancels PENDING run', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        id: 'run-1',
        status: 'PENDING',
      });
      mockPrisma.workflowRun.update.mockResolvedValue({
        id: 'run-1',
        status: 'CANCELLED',
      });

      const { cancelRun } = await import('../../src/routes/runs/handlers.js');

      const mockRequest = { params: { id: 'run-1' } };
      const mockReply = { send: vi.fn(), status: vi.fn().mockReturnThis() };

      await cancelRun(mockRequest as any, mockReply as any);

      expect(mockPrisma.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: {
          status: 'CANCELLED',
          completedAt: expect.any(Date),
        },
      });
    });

    it('cancels RUNNING run', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        id: 'run-1',
        status: 'RUNNING',
      });
      mockPrisma.workflowRun.update.mockResolvedValue({
        id: 'run-1',
        status: 'CANCELLED',
      });

      const { cancelRun } = await import('../../src/routes/runs/handlers.js');

      const mockRequest = { params: { id: 'run-1' } };
      const mockReply = { send: vi.fn(), status: vi.fn().mockReturnThis() };

      await cancelRun(mockRequest as any, mockReply as any);

      expect(mockPrisma.workflowRun.update).toHaveBeenCalled();
    });

    it('rejects cancellation of COMPLETED run', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        id: 'run-1',
        status: 'COMPLETED',
      });

      const { cancelRun } = await import('../../src/routes/runs/handlers.js');

      const mockRequest = { params: { id: 'run-1' } };
      const mockReply = {
        send: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await cancelRun(mockRequest as any, mockReply as any);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: {
          message: 'Can only cancel PENDING or RUNNING runs',
          code: 'INVALID_STATE',
        },
      });
    });

    it('rejects cancellation of FAILED run', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        id: 'run-1',
        status: 'FAILED',
      });

      const { cancelRun } = await import('../../src/routes/runs/handlers.js');

      const mockRequest = { params: { id: 'run-1' } };
      const mockReply = {
        send: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await cancelRun(mockRequest as any, mockReply as any);

      expect(mockReply.status).toHaveBeenCalledWith(400);
    });

    it('throws NotFoundError for missing run', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue(null);

      const { cancelRun } = await import('../../src/routes/runs/handlers.js');

      const mockRequest = { params: { id: 'missing' } };
      const mockReply = { send: vi.fn(), status: vi.fn() };

      await expect(
        cancelRun(mockRequest as any, mockReply as any)
      ).rejects.toThrow("WorkflowRun with id 'missing' not found");
    });
  });
});
