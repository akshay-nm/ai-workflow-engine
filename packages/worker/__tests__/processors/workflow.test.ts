import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestContainer,
  createMockStep,
  createMockWorkflowRun,
  createMockStepRun,
  type TestContainerResult,
} from '../helpers/index.js';
import type { WorkflowProcessor } from '../../src/processors/workflow.processor.js';

describe('workflow processor', () => {
  let testContainer: TestContainerResult;
  let processor: WorkflowProcessor;

  beforeEach(() => {
    testContainer = createTestContainer();
    processor = testContainer.container.resolve('workflowProcessor');
  });

  describe('processExecute', () => {
    it('updates run status to RUNNING', async () => {
      const { mocks } = testContainer;

      mocks.sequentialOrchestrator.initialize.mockResolvedValue({
        completed: true,
        nextStep: null,
        stepInput: null,
      });

      const jobData = { workflowRunId: 'run-1', workflowId: 'wf-1' };

      await processor.processExecute(jobData);

      expect(mocks.prisma.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: {
          status: 'RUNNING',
          startedAt: expect.any(Date),
        },
      });
    });

    it('enqueues first step when workflow has steps', async () => {
      const { mocks } = testContainer;

      mocks.sequentialOrchestrator.initialize.mockResolvedValue({
        completed: false,
        nextStep: createMockStep({
          id: 'step-1',
          retryConfig: { maxAttempts: 3, backoff: { type: 'exponential', delay: 1000 } },
        }),
        stepInput: { value: 'test' },
      });
      mocks.prisma.stepRun.create.mockResolvedValue({ id: 'sr-1' });

      const jobData = { workflowRunId: 'run-1', workflowId: 'wf-1' };

      await processor.processExecute(jobData);

      expect(mocks.prisma.stepRun.create).toHaveBeenCalledWith({
        data: {
          workflowRunId: 'run-1',
          stepId: 'step-1',
          status: 'PENDING',
          input: { value: 'test' },
          maxAttempts: 3,
        },
      });

      expect(mocks.stepQueue.add).toHaveBeenCalledWith(
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
      const { mocks } = testContainer;

      mocks.sequentialOrchestrator.initialize.mockResolvedValue({
        completed: true,
        nextStep: null,
        stepInput: null,
      });

      const jobData = { workflowRunId: 'run-1', workflowId: 'wf-1' };

      await processor.processExecute(jobData);

      expect(mocks.prisma.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: {
          status: 'COMPLETED',
          completedAt: expect.any(Date),
        },
      });
    });
  });

  describe('processContinue', () => {
    it('enqueues next step when more steps remain', async () => {
      const { mocks } = testContainer;

      mocks.prisma.workflowRun.findUnique.mockResolvedValue(
        createMockWorkflowRun({ id: 'run-1', status: 'RUNNING' })
      );
      mocks.sequentialOrchestrator.getNextStep.mockResolvedValue({
        completed: false,
        nextStep: createMockStep({ id: 'step-2', retryConfig: null }),
        stepInput: { data: 'next' },
      });
      mocks.prisma.stepRun.create.mockResolvedValue({ id: 'sr-2' });

      const jobData = { workflowRunId: 'run-1', completedStepRunId: 'sr-1' };

      await processor.processContinue(jobData);

      expect(mocks.sequentialOrchestrator.getNextStep).toHaveBeenCalledWith('run-1', 'sr-1');
      expect(mocks.prisma.stepRun.create).toHaveBeenCalled();
      expect(mocks.stepQueue.add).toHaveBeenCalled();
    });

    it('marks workflow completed at end', async () => {
      const { mocks } = testContainer;

      mocks.prisma.workflowRun.findUnique.mockResolvedValue(
        createMockWorkflowRun({ id: 'run-1', status: 'RUNNING' })
      );
      mocks.sequentialOrchestrator.getNextStep.mockResolvedValue({
        completed: true,
        nextStep: null,
        stepInput: null,
      });
      mocks.prisma.stepRun.findMany.mockResolvedValue([
        createMockStepRun({ id: 'sr-1', output: { result: 'final' } }),
      ]);

      const jobData = { workflowRunId: 'run-1', completedStepRunId: 'sr-1' };

      await processor.processContinue(jobData);

      expect(mocks.prisma.workflowRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: {
          status: 'COMPLETED',
          output: { result: 'final' },
          completedAt: expect.any(Date),
        },
      });
    });

    it('skips processing for cancelled runs', async () => {
      const { mocks } = testContainer;

      mocks.prisma.workflowRun.findUnique.mockResolvedValue(
        createMockWorkflowRun({ id: 'run-1', status: 'CANCELLED' })
      );

      const jobData = { workflowRunId: 'run-1', completedStepRunId: 'sr-1' };

      await processor.processContinue(jobData);

      expect(mocks.sequentialOrchestrator.getNextStep).not.toHaveBeenCalled();
    });
  });
});
