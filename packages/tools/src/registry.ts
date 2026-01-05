import { ToolNotFoundError } from '@workflow/shared';
import type { ToolMetadata } from '@workflow/shared';
import type { Tool } from './base.js';

class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  get<TInput = unknown, TOutput = unknown>(
    name: string
  ): Tool<TInput, TOutput> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new ToolNotFoundError(name);
    }
    return tool as Tool<TInput, TOutput>;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): ToolMetadata[] {
    return Array.from(this.tools.values()).map((tool) => tool.getMetadata());
  }

  clear(): void {
    this.tools.clear();
  }
}

export const toolRegistry = new ToolRegistry();
