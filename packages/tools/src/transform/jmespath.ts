import { z } from 'zod';
import type { ToolContext, ToolResult } from '@workflow/shared';
import { BaseTool } from '../base.js';

export const transformInputSchema = z.object({
  data: z.unknown(),
  expression: z.string(),
});

export const transformOutputSchema = z.object({
  result: z.unknown(),
});

export type TransformInput = z.infer<typeof transformInputSchema>;
export type TransformOutput = z.infer<typeof transformOutputSchema>;

export class TransformTool extends BaseTool<TransformInput, TransformOutput> {
  readonly name = 'transform';
  readonly version = '1.0.0';
  readonly description = 'Transform data using JSONPath-like expressions';
  readonly inputSchema = transformInputSchema;
  readonly outputSchema = transformOutputSchema;

  async execute(
    input: TransformInput,
    _context: ToolContext
  ): Promise<ToolResult<TransformOutput>> {
    try {
      const result = this.evaluateExpression(input.data, input.expression);
      return this.success({ result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.failure(`Transform failed: ${message}`);
    }
  }

  private evaluateExpression(data: unknown, expression: string): unknown {
    if (!expression || expression.trim() === '') {
      return data;
    }

    const parts = expression.split('.');
    let result: unknown = data;

    for (const part of parts) {
      if (result === null || result === undefined) {
        return undefined;
      }

      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, key, indexStr] = arrayMatch;
        const index = parseInt(indexStr!, 10);
        result = (result as Record<string, unknown>)[key!];
        if (Array.isArray(result)) {
          result = result[index];
        } else {
          return undefined;
        }
      } else {
        result = (result as Record<string, unknown>)[part];
      }
    }

    return result;
  }
}
