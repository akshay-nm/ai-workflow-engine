import { describe, it, expect } from 'vitest';
import { TransformTool } from '../../src/transform/jmespath.js';
import type { ToolContext } from '@workflow/shared';

describe('TransformTool', () => {
  const tool = new TransformTool();
  const mockContext = {} as ToolContext;

  it('evaluates simple property access', async () => {
    const result = await tool.execute(
      { data: { name: 'John' }, expression: 'name' },
      mockContext
    );

    expect(result.success).toBe(true);
    expect(result.data?.result).toBe('John');
  });

  it('evaluates nested property access', async () => {
    const result = await tool.execute(
      {
        data: { user: { profile: { email: 'john@example.com' } } },
        expression: 'user.profile.email',
      },
      mockContext
    );

    expect(result.success).toBe(true);
    expect(result.data?.result).toBe('john@example.com');
  });

  it('evaluates array indexing', async () => {
    const result = await tool.execute(
      {
        data: { items: ['a', 'b', 'c'] },
        expression: 'items[1]',
      },
      mockContext
    );

    expect(result.success).toBe(true);
    expect(result.data?.result).toBe('b');
  });

  it('evaluates combined nested and array access', async () => {
    const result = await tool.execute(
      {
        data: {
          users: [
            { name: 'Alice' },
            { name: 'Bob' },
          ],
        },
        expression: 'users[0].name',
      },
      mockContext
    );

    expect(result.success).toBe(true);
    expect(result.data?.result).toBe('Alice');
  });

  it('returns undefined for missing paths', async () => {
    const result = await tool.execute(
      { data: { name: 'John' }, expression: 'age' },
      mockContext
    );

    expect(result.success).toBe(true);
    expect(result.data?.result).toBeUndefined();
  });

  it('returns undefined for deeply missing paths', async () => {
    const result = await tool.execute(
      { data: { user: { name: 'John' } }, expression: 'user.profile.email' },
      mockContext
    );

    expect(result.success).toBe(true);
    expect(result.data?.result).toBeUndefined();
  });

  it('handles null in path', async () => {
    const result = await tool.execute(
      { data: { user: null }, expression: 'user.name' },
      mockContext
    );

    expect(result.success).toBe(true);
    expect(result.data?.result).toBeUndefined();
  });

  it('handles array index out of bounds', async () => {
    const result = await tool.execute(
      { data: { items: ['a', 'b'] }, expression: 'items[5]' },
      mockContext
    );

    expect(result.success).toBe(true);
    expect(result.data?.result).toBeUndefined();
  });

  it('returns entire object for empty expression', async () => {
    const data = { name: 'John', age: 30 };
    const result = await tool.execute(
      { data, expression: '' },
      mockContext
    );

    expect(result.success).toBe(true);
    expect(result.data?.result).toEqual(data);
  });

  it('handles numeric values', async () => {
    const result = await tool.execute(
      { data: { count: 42 }, expression: 'count' },
      mockContext
    );

    expect(result.success).toBe(true);
    expect(result.data?.result).toBe(42);
  });

  it('handles boolean values', async () => {
    const result = await tool.execute(
      { data: { active: true }, expression: 'active' },
      mockContext
    );

    expect(result.success).toBe(true);
    expect(result.data?.result).toBe(true);
  });

  it('handles array as root data', async () => {
    const result = await tool.execute(
      { data: ['a', 'b', 'c'], expression: '1' },
      mockContext
    );

    expect(result.success).toBe(true);
    expect(result.data?.result).toBe('b');
  });

  it('has correct metadata', () => {
    expect(tool.name).toBe('transform');
    expect(tool.version).toBe('1.0.0');
    expect(tool.description).toBe('Transform data using JSONPath-like expressions');
  });
});
