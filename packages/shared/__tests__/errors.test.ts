import { describe, it, expect } from 'vitest';
import {
  WorkflowError,
  NotFoundError,
  ValidationError,
  StepExecutionError,
  ToolNotFoundError,
  WorkflowExecutionError,
} from '../src/errors/index.js';

describe('WorkflowError', () => {
  it('sets message, code, and statusCode', () => {
    const error = new WorkflowError('test message', 'TEST_CODE', 418);

    expect(error.message).toBe('test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.statusCode).toBe(418);
    expect(error.name).toBe('WorkflowError');
  });

  it('defaults statusCode to 500', () => {
    const error = new WorkflowError('test', 'CODE');

    expect(error.statusCode).toBe(500);
  });

  it('is an instance of Error', () => {
    const error = new WorkflowError('test', 'CODE');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(WorkflowError);
  });
});

describe('NotFoundError', () => {
  it('formats resource and id in message', () => {
    const error = new NotFoundError('Workflow', 'abc123');

    expect(error.message).toBe("Workflow with id 'abc123' not found");
    expect(error.code).toBe('NOT_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('NotFoundError');
  });

  it('is an instance of WorkflowError', () => {
    const error = new NotFoundError('User', 'xyz');

    expect(error).toBeInstanceOf(WorkflowError);
    expect(error).toBeInstanceOf(NotFoundError);
  });
});

describe('ValidationError', () => {
  it('sets message and 400 status', () => {
    const error = new ValidationError('Invalid input');

    expect(error.message).toBe('Invalid input');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('ValidationError');
  });

  it('is an instance of WorkflowError', () => {
    const error = new ValidationError('test');

    expect(error).toBeInstanceOf(WorkflowError);
  });
});

describe('StepExecutionError', () => {
  it('includes stepId in message', () => {
    const error = new StepExecutionError('step-1', 'timeout');

    expect(error.message).toBe("Step 'step-1' failed: timeout");
    expect(error.code).toBe('STEP_EXECUTION_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('StepExecutionError');
  });

  it('defaults retryable to true', () => {
    const error = new StepExecutionError('step-1', 'timeout');

    expect(error.retryable).toBe(true);
  });

  it('allows setting retryable to false', () => {
    const error = new StepExecutionError('step-1', 'permanent failure', false);

    expect(error.retryable).toBe(false);
  });

  it('is an instance of WorkflowError', () => {
    const error = new StepExecutionError('step', 'error');

    expect(error).toBeInstanceOf(WorkflowError);
  });
});

describe('ToolNotFoundError', () => {
  it('includes tool name in message', () => {
    const error = new ToolNotFoundError('unknown-tool');

    expect(error.message).toBe("Tool 'unknown-tool' not found in registry");
    expect(error.code).toBe('TOOL_NOT_FOUND');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('ToolNotFoundError');
  });

  it('is an instance of WorkflowError', () => {
    const error = new ToolNotFoundError('tool');

    expect(error).toBeInstanceOf(WorkflowError);
  });
});

describe('WorkflowExecutionError', () => {
  it('includes workflowRunId in message', () => {
    const error = new WorkflowExecutionError('run-123', 'step failed');

    expect(error.message).toBe("Workflow run 'run-123' failed: step failed");
    expect(error.code).toBe('WORKFLOW_EXECUTION_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('WorkflowExecutionError');
  });

  it('is an instance of WorkflowError', () => {
    const error = new WorkflowExecutionError('run', 'error');

    expect(error).toBeInstanceOf(WorkflowError);
  });
});
