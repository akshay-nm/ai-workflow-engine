import { describe, it, expect, beforeEach } from 'vitest';
import { StepExecutionError } from '@workflow/shared';
import {
  createTestContainer,
  createMockStep,
  createMockWorkflowRun,
  createMockStepRun,
  type TestContainerResult,
} from '../helpers/index.js';
import type { StepProcessor } from '../../src/processors/step.processor.js';

describe('step processor', () => {
  let testContainer: TestContainerResult;
  let processor: StepProcessor;

  beforeEach(() => {
    testContainer = createTestContainer();
    processor = testContainer.container.resolve('stepProcessor');
  });

  describe('processExecute', () => {
    const jobData = {
      stepRunId: 'sr-1',
      stepId: 'step-1',
      workflowRunId: 'run-1',
      input: { value: 'test' },
    };

    beforeEach(() => {
      const { mocks } = testContainer;

      mocks.prisma.step.findUnique.mockResolvedValue(
        createMockStep({ id: 'step-1', toolName: 'http-fetch' })
      );
      mocks.prisma.workflowRun.findUnique.mockResolvedValue(
        createMockWorkflowRun({ id: 'run-1', workflowId: 'wf-1', status: 'RUNNING' })
      );
      mocks.prisma.stepRun.findUnique.mockResolvedValue(
        createMockStepRun({ id: 'sr-1', workflowRunId: 'run-1', stepId: 'step-1' })
      );
      mocks.prisma.stepRun.findMany.mockResolvedValue([]);
    });

    it('updates stepRun status to RUNNING', async () => {
      const { mocks } = testContainer;

      mocks.tool.execute.mockResolvedValue({
        success: true,
        data: { result: 'done' },
      });

      await processor.processExecute(jobData, 0);

      expect(mocks.prisma.stepRun.update).toHaveBeenCalledWith({
        where: { id: 'sr-1' },
        data: {
          status: 'RUNNING',
          attemptsMade: 1,
          startedAt: expect.any(Date),
        },
      });
    });

    it('calls tool.execute with input and context', async () => {
      const { mocks } = testContainer;

      mocks.tool.execute.mockResolvedValue({
        success: true,
        data: { result: 'done' },
      });

      await processor.processExecute(jobData, 0);

      expect(mocks.toolRegistry.get).toHaveBeenCalledWith('http-fetch');
      expect(mocks.tool.execute).toHaveBeenCalledWith(
        { value: 'test' },
        expect.objectContaining({
          workflowRun: expect.any(Object),
          stepRun: expect.any(Object),
          previousOutputs: expect.any(Object),
        })
      );
    });

    it('stores output on success', async () => {
      const { mocks } = testContainer;

      mocks.tool.execute.mockResolvedValue({
        success: true,
        data: { result: 'done' },
      });

      await processor.processExecute(jobData, 0);

      expect(mocks.prisma.stepRun.update).toHaveBeenCalledWith({
        where: { id: 'sr-1' },
        data: {
          status: 'COMPLETED',
          output: { result: 'done' },
          completedAt: expect.any(Date),
        },
      });
    });

    it('throws StepExecutionError on tool failure', async () => {
      const { mocks } = testContainer;

      mocks.tool.execute.mockResolvedValue({
        success: false,
        error: 'Tool failed',
      });

      await expect(processor.processExecute(jobData, 0)).rejects.toThrow(
        "Step 'step-1' failed: Tool failed"
      );

      expect(mocks.prisma.stepRun.update).toHaveBeenCalledWith({
        where: { id: 'sr-1' },
        data: { error: 'Tool failed' },
      });
    });

    it('throws for missing step', async () => {
      const { mocks } = testContainer;

      mocks.prisma.step.findUnique.mockResolvedValue(null);

      await expect(processor.processExecute(jobData, 0)).rejects.toThrow(
        'Step not found'
      );
    });

    it('builds context with previous step outputs', async () => {
      const { mocks } = testContainer;

      mocks.prisma.stepRun.findMany.mockResolvedValue([
        {
          id: 'sr-0',
          status: 'COMPLETED',
          output: { data: 'previous' },
          step: { name: 'fetch' },
        },
      ]);
      mocks.tool.execute.mockResolvedValue({ success: true, data: {} });

      await processor.processExecute(jobData, 0);

      expect(mocks.tool.execute).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          previousOutputs: { fetch: { data: 'previous' } },
        })
      );
    });

    it('returns output on success', async () => {
      const { mocks } = testContainer;

      mocks.tool.execute.mockResolvedValue({
        success: true,
        data: { result: 'done' },
      });

      const result = await processor.processExecute(jobData, 0);

      expect(result).toEqual({ result: 'done' });
    });
  });
});
