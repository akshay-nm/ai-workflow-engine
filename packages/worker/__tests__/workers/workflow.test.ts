import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWorker = vi.fn();
const mockOn = vi.fn();

vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation(() => ({
    on: mockOn,
  })),
}));

vi.mock('@workflow/queue', () => ({
  getConnection: vi.fn(() => ({})),
  WORKFLOW_QUEUE_NAME: 'workflow:execute',
}));

vi.mock('@workflow/shared', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../src/processors/index.js', () => ({
  processWorkflowExecute: vi.fn(),
  processWorkflowContinue: vi.fn(),
}));

describe('createWorkflowWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates worker with correct queue name', async () => {
    const { Worker } = await import('bullmq');
    const { createWorkflowWorker } = await import(
      '../../src/workers/workflow.worker.js'
    );

    createWorkflowWorker();

    expect(Worker).toHaveBeenCalledWith(
      'workflow:execute',
      expect.any(Function),
      expect.objectContaining({
        concurrency: 10,
      })
    );
  });

  it('registers completed event handler', async () => {
    const { createWorkflowWorker } = await import(
      '../../src/workers/workflow.worker.js'
    );

    createWorkflowWorker();

    expect(mockOn).toHaveBeenCalledWith('completed', expect.any(Function));
  });

  it('registers failed event handler', async () => {
    const { createWorkflowWorker } = await import(
      '../../src/workers/workflow.worker.js'
    );

    createWorkflowWorker();

    expect(mockOn).toHaveBeenCalledWith('failed', expect.any(Function));
  });

  it('returns worker instance', async () => {
    const { createWorkflowWorker } = await import(
      '../../src/workers/workflow.worker.js'
    );

    const worker = createWorkflowWorker();

    expect(worker).toBeDefined();
    expect(worker.on).toBeDefined();
  });
});
