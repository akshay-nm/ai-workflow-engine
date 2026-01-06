import { ToolNotFoundError } from '@workflow/shared';
import type { ToolMetadata, IToolRegistry, ITool } from '@workflow/shared';
import type { Tool } from './base.js';

/**
 * Registry for managing workflow tools.
 * Supports dependency injection via constructor parameter.
 */
export class ToolRegistry implements IToolRegistry {
  private tools = new Map<string, Tool>();

  /**
   * Create a new ToolRegistry instance.
   * @param initialTools - Optional array of tools to register on construction
   */
  constructor(initialTools?: Tool[]) {
    if (initialTools) {
      for (const tool of initialTools) {
        this.register(tool);
      }
    }
  }

  register(tool: Tool | ITool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered`);
    }
    this.tools.set(tool.name, tool as Tool);
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

/** Default singleton instance for backward compatibility */
export const toolRegistry = new ToolRegistry();
