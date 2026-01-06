import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockClose = vi.fn().mockResolvedValue(undefined);
const mockQueue = vi.fn().mockImplementation(() => ({
  close: mockClose,
}));

vi.mock('bullmq', () => ({
  Queue: mockQueue,
}));

vi.mock('../src/connection.js', () => ({
  getConnection: vi.fn().mockReturnValue({}),
}));

describe('queues', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('getWorkflowQueue creates queue with correct name', async () => {
    const { getWorkflowQueue, WORKFLOW_QUEUE_NAME } = await import('../src/index.js');

    getWorkflowQueue();

    expect(mockQueue).toHaveBeenCalledWith(
      WORKFLOW_QUEUE_NAME,
      expect.objectContaining({
        defaultJobOptions: expect.objectContaining({
          attempts: 1,
          removeOnComplete: false,
          removeOnFail: false,
        }),
      })
    );
  });

  it('getWorkflowQueue returns same instance on multiple calls', async () => {
    const { getWorkflowQueue } = await import('../src/index.js');

    const first = getWorkflowQueue();
    const second = getWorkflowQueue();

    expect(first).toBe(second);
    expect(mockQueue).toHaveBeenCalledTimes(1);
  });

  it('getStepQueue creates queue with correct name', async () => {
    const { getStepQueue, STEP_QUEUE_NAME } = await import('../src/index.js');

    getStepQueue();

    expect(mockQueue).toHaveBeenCalledWith(
      STEP_QUEUE_NAME,
      expect.objectContaining({
        defaultJobOptions: expect.objectContaining({
          removeOnComplete: false,
          removeOnFail: false,
        }),
      })
    );
  });

  it('getStepQueue returns same instance on multiple calls', async () => {
    const { getStepQueue } = await import('../src/index.js');

    const first = getStepQueue();
    const second = getStepQueue();

    expect(first).toBe(second);
    expect(mockQueue).toHaveBeenCalledTimes(1);
  });

  it('closeQueues closes both queues', async () => {
    const { getWorkflowQueue, getStepQueue, closeQueues } = await import('../src/index.js');

    getWorkflowQueue();
    getStepQueue();
    await closeQueues();

    expect(mockClose).toHaveBeenCalledTimes(2);
  });

  it('closeQueues handles no queues initialized', async () => {
    const { closeQueues } = await import('../src/index.js');

    await expect(closeQueues()).resolves.toBeUndefined();
  });

  it('exports queue names', async () => {
    const { WORKFLOW_QUEUE_NAME, STEP_QUEUE_NAME } = await import('../src/index.js');

    expect(WORKFLOW_QUEUE_NAME).toBe('workflow-execute');
    expect(STEP_QUEUE_NAME).toBe('step-execute');
  });
});
