import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { toolRegistry, BaseTool } from '../src/index.js';
import type { ToolContext, ToolResult } from '@workflow/shared';

class MockTool extends BaseTool<{ value: string }, { result: string }> {
  readonly name = 'mock-tool';
  readonly version = '1.0.0';
  readonly description = 'A mock tool for testing';
  readonly inputSchema = z.object({ value: z.string() });
  readonly outputSchema = z.object({ result: z.string() });

  async execute(
    input: { value: string },
    _context: ToolContext
  ): Promise<ToolResult<{ result: string }>> {
    return this.success({ result: input.value.toUpperCase() });
  }
}

describe('toolRegistry', () => {
  beforeEach(() => {
    toolRegistry.clear();
  });

  it('register adds tool to registry', () => {
    const tool = new MockTool();

    toolRegistry.register(tool);

    expect(toolRegistry.has('mock-tool')).toBe(true);
  });

  it('register throws on duplicate name', () => {
    const tool1 = new MockTool();
    const tool2 = new MockTool();

    toolRegistry.register(tool1);

    expect(() => toolRegistry.register(tool2)).toThrow(
      "Tool 'mock-tool' is already registered"
    );
  });

  it('get returns registered tool', () => {
    const tool = new MockTool();
    toolRegistry.register(tool);

    const retrieved = toolRegistry.get('mock-tool');

    expect(retrieved).toBe(tool);
  });

  it('get throws ToolNotFoundError for unknown tool', () => {
    expect(() => toolRegistry.get('unknown')).toThrow(
      "Tool 'unknown' not found in registry"
    );
  });

  it('has returns true for registered tool', () => {
    const tool = new MockTool();
    toolRegistry.register(tool);

    expect(toolRegistry.has('mock-tool')).toBe(true);
  });

  it('has returns false for unregistered tool', () => {
    expect(toolRegistry.has('nonexistent')).toBe(false);
  });

  it('list returns all tool metadata', () => {
    const tool = new MockTool();
    toolRegistry.register(tool);

    const list = toolRegistry.list();

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      name: 'mock-tool',
      version: '1.0.0',
      description: 'A mock tool for testing',
    });
  });

  it('list returns empty array when no tools registered', () => {
    const list = toolRegistry.list();

    expect(list).toHaveLength(0);
  });

  it('clear empties the registry', () => {
    const tool = new MockTool();
    toolRegistry.register(tool);

    toolRegistry.clear();

    expect(toolRegistry.has('mock-tool')).toBe(false);
    expect(toolRegistry.list()).toHaveLength(0);
  });
});

describe('BaseTool', () => {
  it('getMetadata returns tool info', () => {
    const tool = new MockTool();

    const metadata = tool.getMetadata();

    expect(metadata.name).toBe('mock-tool');
    expect(metadata.version).toBe('1.0.0');
    expect(metadata.description).toBe('A mock tool for testing');
  });

  it('success helper creates success result', async () => {
    const tool = new MockTool();
    const context = {} as ToolContext;

    const result = await tool.execute({ value: 'test' }, context);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ result: 'TEST' });
  });
});
