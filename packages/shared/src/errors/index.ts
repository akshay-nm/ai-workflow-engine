export class WorkflowError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = 'WorkflowError';
  }
}

export class NotFoundError extends WorkflowError {
  constructor(resource: string, id: string) {
    super(`${resource} with id '${id}' not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends WorkflowError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class StepExecutionError extends WorkflowError {
  constructor(
    stepId: string,
    message: string,
    public readonly retryable: boolean = true
  ) {
    super(`Step '${stepId}' failed: ${message}`, 'STEP_EXECUTION_ERROR', 500);
    this.name = 'StepExecutionError';
  }
}

export class ToolNotFoundError extends WorkflowError {
  constructor(toolName: string) {
    super(`Tool '${toolName}' not found in registry`, 'TOOL_NOT_FOUND', 400);
    this.name = 'ToolNotFoundError';
  }
}

export class WorkflowExecutionError extends WorkflowError {
  constructor(workflowRunId: string, message: string) {
    super(
      `Workflow run '${workflowRunId}' failed: ${message}`,
      'WORKFLOW_EXECUTION_ERROR',
      500
    );
    this.name = 'WorkflowExecutionError';
  }
}
