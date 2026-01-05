import { describe, it, expect } from 'vitest';
import {
  createWorkflowSchema,
  updateWorkflowSchema,
  createStepSchema,
  triggerRunSchema,
} from '../src/routes/workflows/schemas.js';

describe('createWorkflowSchema', () => {
  it('accepts valid workflow input', () => {
    const input = {
      name: 'My Workflow',
      description: 'A test workflow',
      inputSchema: { type: 'object' },
      config: { timeout: 30000 },
    };

    const result = createWorkflowSchema.safeParse(input);

    expect(result.success).toBe(true);
  });

  it('requires name', () => {
    const input = { description: 'Missing name' };

    const result = createWorkflowSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const input = { name: '' };

    const result = createWorkflowSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it('rejects name over 255 characters', () => {
    const input = { name: 'a'.repeat(256) };

    const result = createWorkflowSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it('allows optional fields to be omitted', () => {
    const input = { name: 'Minimal Workflow' };

    const result = createWorkflowSchema.safeParse(input);

    expect(result.success).toBe(true);
  });
});

describe('updateWorkflowSchema', () => {
  it('accepts partial updates', () => {
    const input = { name: 'Updated Name' };

    const result = updateWorkflowSchema.safeParse(input);

    expect(result.success).toBe(true);
  });

  it('accepts status update', () => {
    const input = { status: 'ACTIVE' };

    const result = updateWorkflowSchema.safeParse(input);

    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const input = { status: 'INVALID' };

    const result = updateWorkflowSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it('accepts empty object', () => {
    const result = updateWorkflowSchema.safeParse({});

    expect(result.success).toBe(true);
  });
});

describe('createStepSchema', () => {
  it('accepts valid step input', () => {
    const input = {
      name: 'LLM Step',
      type: 'LLM',
      toolName: 'llm-chat',
      config: { model: 'gpt-4' },
      order: 0,
    };

    const result = createStepSchema.safeParse(input);

    expect(result.success).toBe(true);
  });

  it('requires name, type, toolName, config, order', () => {
    const input = { name: 'Incomplete' };

    const result = createStepSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it('validates step type enum', () => {
    const validTypes = ['LLM', 'HTTP', 'TRANSFORM', 'CONDITION', 'CODE', 'DELAY'];

    for (const type of validTypes) {
      const input = {
        name: 'Step',
        type,
        toolName: 'tool',
        config: {},
        order: 0,
      };

      const result = createStepSchema.safeParse(input);
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid step type', () => {
    const input = {
      name: 'Step',
      type: 'INVALID',
      toolName: 'tool',
      config: {},
      order: 0,
    };

    const result = createStepSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it('validates retryConfig structure', () => {
    const input = {
      name: 'Step',
      type: 'HTTP',
      toolName: 'http-fetch',
      config: {},
      order: 0,
      retryConfig: {
        maxAttempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    };

    const result = createStepSchema.safeParse(input);

    expect(result.success).toBe(true);
  });

  it('rejects invalid retryConfig maxAttempts', () => {
    const input = {
      name: 'Step',
      type: 'HTTP',
      toolName: 'http-fetch',
      config: {},
      order: 0,
      retryConfig: {
        maxAttempts: 0,
        backoff: { type: 'exponential', delay: 1000 },
      },
    };

    const result = createStepSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it('validates timeout range', () => {
    const validInput = {
      name: 'Step',
      type: 'HTTP',
      toolName: 'http-fetch',
      config: {},
      order: 0,
      timeout: 30000,
    };

    expect(createStepSchema.safeParse(validInput).success).toBe(true);

    const tooLow = { ...validInput, timeout: 500 };
    expect(createStepSchema.safeParse(tooLow).success).toBe(false);

    const tooHigh = { ...validInput, timeout: 700000 };
    expect(createStepSchema.safeParse(tooHigh).success).toBe(false);
  });
});

describe('triggerRunSchema', () => {
  it('accepts empty object', () => {
    const result = triggerRunSchema.safeParse({});

    expect(result.success).toBe(true);
  });

  it('accepts input object', () => {
    const input = { input: { key: 'value' } };

    const result = triggerRunSchema.safeParse(input);

    expect(result.success).toBe(true);
  });

  it('rejects non-object input', () => {
    const input = { input: 'string' };

    const result = triggerRunSchema.safeParse(input);

    expect(result.success).toBe(false);
  });
});
