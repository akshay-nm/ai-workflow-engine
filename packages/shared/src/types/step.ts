export type StepType = 'LLM' | 'HTTP' | 'TRANSFORM' | 'CONDITION' | 'CODE' | 'DELAY';

export interface RetryConfig {
  maxAttempts: number;
  backoff: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
}

export interface Step {
  id: string;
  workflowId: string;
  name: string;
  description: string | null;
  type: StepType;
  toolName: string;
  config: Record<string, unknown>;
  inputMapping: Record<string, unknown>;
  retryConfig: RetryConfig | null;
  timeout: number | null;
  order: number;
  createdAt: Date;
}

export interface CreateStepInput {
  name: string;
  description?: string;
  type: StepType;
  toolName: string;
  config: Record<string, unknown>;
  inputMapping?: Record<string, unknown>;
  retryConfig?: RetryConfig;
  timeout?: number;
  order: number;
}

export interface UpdateStepInput {
  name?: string;
  description?: string;
  type?: StepType;
  toolName?: string;
  config?: Record<string, unknown>;
  inputMapping?: Record<string, unknown>;
  retryConfig?: RetryConfig;
  timeout?: number;
  order?: number;
}

export interface StepEdge {
  id: string;
  workflowId: string;
  fromStepId: string;
  toStepId: string;
  condition: Record<string, unknown> | null;
}
