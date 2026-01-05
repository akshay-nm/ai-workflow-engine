import { z } from 'zod';
import type { ToolContext, ToolResult } from '@workflow/shared';
import { BaseTool } from '../base.js';

export const httpInputSchema = z.object({
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
  timeout: z.number().positive().optional(),
});

export const httpOutputSchema = z.object({
  status: z.number(),
  statusText: z.string(),
  headers: z.record(z.string()),
  body: z.unknown(),
});

export type HttpInput = z.infer<typeof httpInputSchema>;
export type HttpOutput = z.infer<typeof httpOutputSchema>;

export class HttpFetchTool extends BaseTool<HttpInput, HttpOutput> {
  readonly name = 'http-fetch';
  readonly version = '1.0.0';
  readonly description = 'Make HTTP requests to external APIs';
  readonly inputSchema = httpInputSchema;
  readonly outputSchema = httpOutputSchema;

  async execute(
    input: HttpInput,
    _context: ToolContext
  ): Promise<ToolResult<HttpOutput>> {
    try {
      const method = input.method ?? 'GET';
      const timeout = input.timeout ?? 30000;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const fetchOptions: RequestInit = {
        method,
        signal: controller.signal,
      };
      if (input.headers) {
        fetchOptions.headers = input.headers;
      }
      if (input.body) {
        fetchOptions.body = JSON.stringify(input.body);
      }

      const response = await fetch(input.url, fetchOptions);

      clearTimeout(timeoutId);

      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      let body: unknown;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        body = await response.json();
      } else {
        body = await response.text();
      }

      return this.success({
        status: response.status,
        statusText: response.statusText,
        headers,
        body,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.failure(`HTTP request failed: ${message}`);
    }
  }
}
