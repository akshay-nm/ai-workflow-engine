import { z } from 'zod';
import type { ToolContext, ToolMetadata, ToolResult } from '@workflow/shared';

export interface Tool<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly inputSchema: z.ZodType<TInput>;
  readonly outputSchema: z.ZodType<TOutput>;

  execute(input: TInput, context: ToolContext): Promise<ToolResult<TOutput>>;

  getMetadata(): ToolMetadata;
}

export abstract class BaseTool<TInput = unknown, TOutput = unknown>
  implements Tool<TInput, TOutput>
{
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly description: string;
  abstract readonly inputSchema: z.ZodType<TInput>;
  abstract readonly outputSchema: z.ZodType<TOutput>;

  abstract execute(
    input: TInput,
    context: ToolContext
  ): Promise<ToolResult<TOutput>>;

  getMetadata(): ToolMetadata {
    return {
      name: this.name,
      version: this.version,
      description: this.description,
      inputSchema: this.inputSchema._def as unknown as Record<string, unknown>,
      outputSchema: this.outputSchema._def as unknown as Record<string, unknown>,
    };
  }

  protected success(data: TOutput): ToolResult<TOutput> {
    return { success: true, data };
  }

  protected failure(error: string): ToolResult<TOutput> {
    return { success: false, error };
  }
}
