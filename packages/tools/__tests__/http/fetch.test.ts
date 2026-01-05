import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ToolContext } from '@workflow/shared';

describe('HttpFetchTool', () => {
  const mockContext = {} as ToolContext;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('makes GET request to URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ data: 'test' }),
    });
    globalThis.fetch = mockFetch;

    const { HttpFetchTool } = await import('../../src/http/fetch.js');
    const tool = new HttpFetchTool();

    const result = await tool.execute(
      { url: 'https://api.example.com/data' },
      mockContext
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/data',
      expect.objectContaining({ method: 'GET' })
    );
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe(200);
    expect(result.data?.body).toEqual({ data: 'test' });
  });

  it('makes POST request with JSON body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 201,
      statusText: 'Created',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ id: '123' }),
    });
    globalThis.fetch = mockFetch;

    const { HttpFetchTool } = await import('../../src/http/fetch.js');
    const tool = new HttpFetchTool();

    await tool.execute(
      {
        url: 'https://api.example.com/items',
        method: 'POST',
        body: { name: 'test' },
      },
      mockContext
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/items',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
      })
    );
  });

  it('includes custom headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/plain' }),
      text: () => Promise.resolve('OK'),
    });
    globalThis.fetch = mockFetch;

    const { HttpFetchTool } = await import('../../src/http/fetch.js');
    const tool = new HttpFetchTool();

    await tool.execute(
      {
        url: 'https://api.example.com/data',
        headers: { Authorization: 'Bearer token123' },
      },
      mockContext
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/data',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token123' },
      })
    );
  });

  it('returns text for non-JSON responses', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/plain' }),
      text: () => Promise.resolve('Plain text response'),
    });
    globalThis.fetch = mockFetch;

    const { HttpFetchTool } = await import('../../src/http/fetch.js');
    const tool = new HttpFetchTool();

    const result = await tool.execute(
      { url: 'https://api.example.com/text' },
      mockContext
    );

    expect(result.success).toBe(true);
    expect(result.data?.body).toBe('Plain text response');
  });

  it('handles network errors', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    globalThis.fetch = mockFetch;

    const { HttpFetchTool } = await import('../../src/http/fetch.js');
    const tool = new HttpFetchTool();

    const result = await tool.execute(
      { url: 'https://api.example.com/data' },
      mockContext
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('HTTP request failed: Network error');
  });

  it('supports PUT method', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ updated: true }),
    });
    globalThis.fetch = mockFetch;

    const { HttpFetchTool } = await import('../../src/http/fetch.js');
    const tool = new HttpFetchTool();

    await tool.execute(
      {
        url: 'https://api.example.com/items/1',
        method: 'PUT',
        body: { name: 'updated' },
      },
      mockContext
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/items/1',
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('supports DELETE method', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 204,
      statusText: 'No Content',
      headers: new Headers({}),
      text: () => Promise.resolve(''),
    });
    globalThis.fetch = mockFetch;

    const { HttpFetchTool } = await import('../../src/http/fetch.js');
    const tool = new HttpFetchTool();

    const result = await tool.execute(
      {
        url: 'https://api.example.com/items/1',
        method: 'DELETE',
      },
      mockContext
    );

    expect(result.success).toBe(true);
    expect(result.data?.status).toBe(204);
  });

  it('captures response headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: new Headers({
        'content-type': 'application/json',
        'x-custom-header': 'custom-value',
      }),
      json: () => Promise.resolve({}),
    });
    globalThis.fetch = mockFetch;

    const { HttpFetchTool } = await import('../../src/http/fetch.js');
    const tool = new HttpFetchTool();

    const result = await tool.execute(
      { url: 'https://api.example.com/data' },
      mockContext
    );

    expect(result.data?.headers).toMatchObject({
      'content-type': 'application/json',
      'x-custom-header': 'custom-value',
    });
  });

  it('has correct metadata', async () => {
    const { HttpFetchTool } = await import('../../src/http/fetch.js');
    const tool = new HttpFetchTool();

    expect(tool.name).toBe('http-fetch');
    expect(tool.version).toBe('1.0.0');
    expect(tool.description).toBe('Make HTTP requests to external APIs');
  });
});
