import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  workflow: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  step: {
    create: vi.fn(),
  },
  workflowRun: {
    create: vi.fn(),
  },
};

const mockQueueAdd = vi.fn();

vi.mock('@workflow/database', () => ({
  prisma: mockPrisma,
}));

vi.mock('@workflow/queue', () => ({
  getWorkflowQueue: vi.fn(() => ({
    add: mockQueueAdd,
  })),
}));

describe('workflow handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createWorkflow', () => {
    it('creates workflow and returns 201', async () => {
      const mockWorkflow = {
        id: 'wf-1',
        name: 'Test Workflow',
        description: null,
        version: 1,
        status: 'DRAFT',
      };
      mockPrisma.workflow.create.mockResolvedValue(mockWorkflow);

      const { createWorkflow } = await import(
        '../../src/routes/workflows/handlers.js'
      );

      const mockRequest = {
        body: { name: 'Test Workflow' },
      };
      const mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await createWorkflow(mockRequest as any, mockReply as any);

      expect(mockPrisma.workflow.create).toHaveBeenCalledWith({
        data: { name: 'Test Workflow', description: null },
      });
      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith(mockWorkflow);
    });

    it('throws ValidationError on invalid input', async () => {
      const { createWorkflow } = await import(
        '../../src/routes/workflows/handlers.js'
      );

      const mockRequest = {
        body: { name: '' },
      };
      const mockReply = { status: vi.fn(), send: vi.fn() };

      await expect(
        createWorkflow(mockRequest as any, mockReply as any)
      ).rejects.toThrow();
    });
  });

  describe('getWorkflow', () => {
    it('returns workflow with steps', async () => {
      const mockWorkflow = {
        id: 'wf-1',
        name: 'Test',
        steps: [{ id: 'step-1', name: 'First' }],
      };
      mockPrisma.workflow.findUnique.mockResolvedValue(mockWorkflow);

      const { getWorkflow } = await import(
        '../../src/routes/workflows/handlers.js'
      );

      const mockRequest = { params: { id: 'wf-1' } };
      const mockReply = { send: vi.fn() };

      await getWorkflow(mockRequest as any, mockReply as any);

      expect(mockPrisma.workflow.findUnique).toHaveBeenCalledWith({
        where: { id: 'wf-1' },
        include: { steps: { orderBy: { order: 'asc' } } },
      });
      expect(mockReply.send).toHaveBeenCalledWith(mockWorkflow);
    });

    it('throws NotFoundError for missing workflow', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(null);

      const { getWorkflow } = await import(
        '../../src/routes/workflows/handlers.js'
      );

      const mockRequest = { params: { id: 'missing' } };
      const mockReply = { send: vi.fn() };

      await expect(
        getWorkflow(mockRequest as any, mockReply as any)
      ).rejects.toThrow("Workflow with id 'missing' not found");
    });
  });

  describe('listWorkflows', () => {
    it('returns workflows sorted by createdAt', async () => {
      const mockWorkflows = [{ id: 'wf-2' }, { id: 'wf-1' }];
      mockPrisma.workflow.findMany.mockResolvedValue(mockWorkflows);

      const { listWorkflows } = await import(
        '../../src/routes/workflows/handlers.js'
      );

      const mockReply = { send: vi.fn() };

      await listWorkflows({} as any, mockReply as any);

      expect(mockPrisma.workflow.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
      expect(mockReply.send).toHaveBeenCalledWith(mockWorkflows);
    });
  });

  describe('updateWorkflow', () => {
    it('increments version on update', async () => {
      const mockWorkflow = { id: 'wf-1', name: 'Updated', version: 2 };
      mockPrisma.workflow.update.mockResolvedValue(mockWorkflow);

      const { updateWorkflow } = await import(
        '../../src/routes/workflows/handlers.js'
      );

      const mockRequest = {
        params: { id: 'wf-1' },
        body: { name: 'Updated' },
      };
      const mockReply = { send: vi.fn() };

      await updateWorkflow(mockRequest as any, mockReply as any);

      expect(mockPrisma.workflow.update).toHaveBeenCalledWith({
        where: { id: 'wf-1' },
        data: {
          name: 'Updated',
          version: { increment: 1 },
        },
      });
    });
  });

  describe('deleteWorkflow', () => {
    it('deletes workflow and returns 204', async () => {
      mockPrisma.workflow.delete.mockResolvedValue({});

      const { deleteWorkflow } = await import(
        '../../src/routes/workflows/handlers.js'
      );

      const mockRequest = { params: { id: 'wf-1' } };
      const mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await deleteWorkflow(mockRequest as any, mockReply as any);

      expect(mockPrisma.workflow.delete).toHaveBeenCalledWith({
        where: { id: 'wf-1' },
      });
      expect(mockReply.status).toHaveBeenCalledWith(204);
    });
  });

  describe('createStep', () => {
    it('creates step for existing workflow', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue({ id: 'wf-1' });
      mockPrisma.step.create.mockResolvedValue({
        id: 'step-1',
        name: 'New Step',
      });

      const { createStep } = await import(
        '../../src/routes/workflows/handlers.js'
      );

      const mockRequest = {
        params: { id: 'wf-1' },
        body: {
          name: 'New Step',
          type: 'HTTP',
          toolName: 'http-fetch',
          config: {},
          order: 0,
        },
      };
      const mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await createStep(mockRequest as any, mockReply as any);

      expect(mockReply.status).toHaveBeenCalledWith(201);
    });

    it('throws NotFoundError for missing workflow', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(null);

      const { createStep } = await import(
        '../../src/routes/workflows/handlers.js'
      );

      const mockRequest = {
        params: { id: 'missing' },
        body: {
          name: 'Step',
          type: 'HTTP',
          toolName: 'http-fetch',
          config: {},
          order: 0,
        },
      };
      const mockReply = { status: vi.fn(), send: vi.fn() };

      await expect(
        createStep(mockRequest as any, mockReply as any)
      ).rejects.toThrow("Workflow with id 'missing' not found");
    });
  });

  describe('triggerRun', () => {
    it('creates run and enqueues job for ACTIVE workflow', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue({
        id: 'wf-1',
        status: 'ACTIVE',
      });
      mockPrisma.workflowRun.create.mockResolvedValue({
        id: 'run-1',
        workflowId: 'wf-1',
        status: 'PENDING',
      });

      const { triggerRun } = await import(
        '../../src/routes/workflows/handlers.js'
      );

      const mockRequest = {
        params: { id: 'wf-1' },
        body: { input: { key: 'value' } },
      };
      const mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      await triggerRun(mockRequest as any, mockReply as any);

      expect(mockPrisma.workflowRun.create).toHaveBeenCalled();
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'workflow.execute',
        { workflowRunId: 'run-1', workflowId: 'wf-1' },
        { jobId: 'run-1' }
      );
      expect(mockReply.status).toHaveBeenCalledWith(202);
    });

    it('throws ValidationError for non-ACTIVE workflow', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue({
        id: 'wf-1',
        status: 'DRAFT',
      });

      const { triggerRun } = await import(
        '../../src/routes/workflows/handlers.js'
      );

      const mockRequest = {
        params: { id: 'wf-1' },
        body: {},
      };
      const mockReply = { status: vi.fn(), send: vi.fn() };

      await expect(
        triggerRun(mockRequest as any, mockReply as any)
      ).rejects.toThrow('Workflow must be ACTIVE to trigger a run');
    });

    it('throws NotFoundError for missing workflow', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(null);

      const { triggerRun } = await import(
        '../../src/routes/workflows/handlers.js'
      );

      const mockRequest = {
        params: { id: 'missing' },
        body: {},
      };
      const mockReply = { status: vi.fn(), send: vi.fn() };

      await expect(
        triggerRun(mockRequest as any, mockReply as any)
      ).rejects.toThrow("Workflow with id 'missing' not found");
    });
  });
});
