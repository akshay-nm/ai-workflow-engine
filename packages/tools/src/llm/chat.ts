import { z } from 'zod';
import OpenAI from 'openai';
import type { ToolContext, ToolResult } from '@workflow/shared';
import { BaseTool } from '../base.js';

export const chatInputSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string(),
    })
  ),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
});

export const chatOutputSchema = z.object({
  content: z.string(),
  model: z.string(),
  usage: z
    .object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    })
    .optional(),
});

export type ChatInput = z.infer<typeof chatInputSchema>;
export type ChatOutput = z.infer<typeof chatOutputSchema>;

/**
 * Configuration options for LLMChatTool
 */
export interface LLMChatToolConfig {
  baseURL?: string;
  apiKey?: string;
  defaultModel?: string;
}

/**
 * Dependencies for LLMChatTool
 */
export interface LLMChatToolDeps {
  openaiClient?: OpenAI;
  config?: LLMChatToolConfig;
}

export class LLMChatTool extends BaseTool<ChatInput, ChatOutput> {
  readonly name = 'llm-chat';
  readonly version = '1.0.0';
  readonly description = 'Send messages to an LLM and receive a response';
  readonly inputSchema = chatInputSchema;
  readonly outputSchema = chatOutputSchema;

  private client: OpenAI;
  private defaultModel: string;

  /**
   * Create a new LLMChatTool instance.
   * @param deps - Optional dependencies. Falls back to env vars if not provided.
   */
  constructor(deps: LLMChatToolDeps = {}) {
    super();

    if (deps.openaiClient) {
      this.client = deps.openaiClient;
    } else {
      this.client = new OpenAI({
        baseURL:
          deps.config?.baseURL ??
          process.env['LLM_BASE_URL'] ??
          'http://localhost:1234/v1',
        apiKey:
          deps.config?.apiKey ?? process.env['LLM_API_KEY'] ?? 'lm-studio',
      });
    }

    this.defaultModel =
      deps.config?.defaultModel ?? process.env['LLM_MODEL'] ?? 'local-model';
  }

  async execute(
    input: ChatInput,
    _context: ToolContext
  ): Promise<ToolResult<ChatOutput>> {
    try {
      const params: OpenAI.ChatCompletionCreateParamsNonStreaming = {
        model: input.model ?? this.defaultModel,
        messages: input.messages,
      };
      if (input.temperature !== undefined) {
        params.temperature = input.temperature;
      }
      if (input.maxTokens !== undefined) {
        params.max_tokens = input.maxTokens;
      }

      const response = await this.client.chat.completions.create(params);

      const choice = response.choices[0];
      if (!choice?.message?.content) {
        return this.failure('No response content from LLM');
      }

      return this.success({
        content: choice.message.content,
        model: response.model,
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.failure(`LLM request failed: ${message}`);
    }
  }
}
