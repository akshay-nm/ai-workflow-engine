import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockOn = vi.fn();
const mockWorkflowQueueAdd = vi.fn();

const mockPrisma = {
  stepRun: {
    update: vi.fn(),
  },
  workflowRun: {
    update: vi.fn(),
  },
};

vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation(() => ({
    on: mockOn,
  })),
}));

vi.mock('@workflow/database', () => ({
  prisma: mockPrisma,
}));

vi.mock('@workflow/queue', () => ({
  getConnection: vi.fn(() => ({})),
  getWorkflowQueue: vi.fn(() => ({
    add: mockWorkflowQueueAdd,
  })),
  STEP_QUEUE_NAME: 'step:execute',
}));

vi.mock('@workflow/shared', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../src/processors/index.js', () => ({
  processStepExecute: vi.fn(),
}));

describe('createStepWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates worker with correct queue name', async () => {
    const { Worker } = await import('bullmq');
    const { createStepWorker } = await import(
      '../../src/workers/step.worker.js'
    );

    createStepWorker();

    expect(Worker).toHaveBeenCalledWith(
      'step:execute',
      expect.any(Function),
      expect.objectContaining({
        concurrency: 5,
      })
    );
  });

  it('registers completed event handler', async () => {
    const { createStepWorker } = await import(
      '../../src/workers/step.worker.js'
    );

    createStepWorker();

    expect(mockOn).toHaveBeenCalledWith('completed', expect.any(Function));
  });

  it('registers failed event handler', async () => {
    const { createStepWorker } = await import(
      '../../src/workers/step.worker.js'
    );

    createStepWorker();

    expect(mockOn).toHaveBeenCalledWith('failed', expect.any(Function));
  });

  describe('completed handler', () => {
    it('enqueues workflow continue job', async () => {
      const { createStepWorker } = await import(
        '../../src/workers/step.worker.js'
      );

      createStepWorker();

      const completedHandler = mockOn.mock.calls.find(
        (call) => call[0] === 'completed'
      )?.[1];

      const mockJob = {
        id: 'job-1',
        data: {
          workflowRunId: 'run-1',
          stepRunId: 'sr-1',
        },
      };

      await completedHandler(mockJob);

      expect(mockWorkflowQueueAdd).toHaveBeenCalledWith(
        'workflow.continue',
        {
          workflowRunId: 'run-1',
          completedStepRunId: 'sr-1',
        },
        {
          jobId: 'continue-sr-1',
        }
      );
    });
  });

  describe('failed handler', () => {
    it('marks workflow failed when retries exhausted', async () => {
      const { createStepWorker } = await import(
        '../../src/workers/step.worker.js'
      );

      createStepWorker();

      const failedHandler = mockOn.mock.calls.find(
        (call) => call[0] === 'failed'
      )?.[1];

      const mockJob = {
        id: 'job-1',
        data: {
          workflowRunId: 'run-1',
          stepRunId: 'sr-1',
          stepId: 'step-1',
        },
        attemptsMade: 3,
        opts: { attempts: 3 },
      };
      const mockError = new Error('Step failed');

      await failedHandler(mockJob, mockError);

      expect(mockPrisma.stepRun.update).toHaveBeenCalledWith({
        where: { id: 'sr-1' },
        data: {
          status: 'FAILED',
          error: 'Step failed',
          completedAt: expect.any(Date),
        },
      });

      expect(mockPrisma.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: {
          status: 'FAILED',
          error: expect.stringContaining('Step'),
          completedAt: expect.any(Date),
        },
      });
    });

    it('does not mark workflow failed when retries remain', async () => {
      const { createStepWorker } = await import(
        '../../src/workers/step.worker.js'
      );

      createStepWorker();

      const failedHandler = mockOn.mock.calls.find(
        (call) => call[0] === 'failed'
      )?.[1];

      const mockJob = {
        id: 'job-1',
        data: {
          workflowRunId: 'run-1',
          stepRunId: 'sr-1',
          stepId: 'step-1',
        },
        attemptsMade: 1,
        opts: { attempts: 3 },
      };
      const mockError = new Error('Step failed');

      await failedHandler(mockJob, mockError);

      expect(mockPrisma.workflowRun.update).not.toHaveBeenCalled();
    });

    it('handles null job gracefully', async () => {
      const { createStepWorker } = await import(
        '../../src/workers/step.worker.js'
      );

      createStepWorker();

      const failedHandler = mockOn.mock.calls.find(
        (call) => call[0] === 'failed'
      )?.[1];

      await failedHandler(null, new Error('Unknown'));

      expect(mockPrisma.stepRun.update).not.toHaveBeenCalled();
    });
  });

  it('returns worker instance', async () => {
    const { createStepWorker } = await import(
      '../../src/workers/step.worker.js'
    );

    const worker = createStepWorker();

    expect(worker).toBeDefined();
  });
});
