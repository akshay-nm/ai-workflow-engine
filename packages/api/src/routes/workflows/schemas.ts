import { z } from 'zod';

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  inputSchema: z.record(z.unknown()).optional(),
  config: z.record(z.unknown()).optional(),
});

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  inputSchema: z.record(z.unknown()).optional(),
  config: z.record(z.unknown()).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
});

export const createStepSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.enum(['LLM', 'HTTP', 'TRANSFORM', 'CONDITION', 'CODE', 'DELAY']),
  toolName: z.string().min(1),
  config: z.record(z.unknown()),
  inputMapping: z.record(z.unknown()).optional(),
  retryConfig: z
    .object({
      maxAttempts: z.number().int().min(1).max(10),
      backoff: z.object({
        type: z.enum(['exponential', 'fixed']),
        delay: z.number().int().min(100).max(60000),
      }),
    })
    .optional(),
  timeout: z.number().int().min(1000).max(600000).optional(),
  order: z.number().int().min(0),
});

export const triggerRunSchema = z.object({
  input: z.record(z.unknown()).optional(),
});

export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;
export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>;
export type CreateStepInput = z.infer<typeof createStepSchema>;
export type TriggerRunInput = z.infer<typeof triggerRunSchema>;
