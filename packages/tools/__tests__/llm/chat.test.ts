import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ToolContext } from '@workflow/shared';

const mockCreate = vi.fn();

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}));

describe('LLMChatTool', () => {
  const originalEnv = process.env;
  const mockContext = {} as ToolContext;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env['LLM_BASE_URL'] = 'http://localhost:1234/v1';
    process.env['LLM_API_KEY'] = 'test-key';
    process.env['LLM_MODEL'] = 'test-model';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('calls OpenAI with correct parameters', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Hello!' } }],
      model: 'test-model',
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    });

    const { LLMChatTool } = await import('../../src/llm/chat.js');
    const tool = new LLMChatTool();

    await tool.execute(
      {
        messages: [{ role: 'user', content: 'Hi' }],
        temperature: 0.7,
        maxTokens: 100,
      },
      mockContext
    );

    expect(mockCreate).toHaveBeenCalledWith({
      model: 'test-model',
      messages: [{ role: 'user', content: 'Hi' }],
      temperature: 0.7,
      max_tokens: 100,
    });
  });

  it('uses custom model when provided', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Response' } }],
      model: 'custom-model',
    });

    const { LLMChatTool } = await import('../../src/llm/chat.js');
    const tool = new LLMChatTool();

    await tool.execute(
      {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'custom-model',
      },
      mockContext
    );

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'custom-model' })
    );
  });

  it('returns success with content and usage', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Hello world!' } }],
      model: 'test-model',
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    });

    const { LLMChatTool } = await import('../../src/llm/chat.js');
    const tool = new LLMChatTool();

    const result = await tool.execute(
      { messages: [{ role: 'user', content: 'Hi' }] },
      mockContext
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      content: 'Hello world!',
      model: 'test-model',
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      },
    });
  });

  it('returns failure when no response content', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
      model: 'test-model',
    });

    const { LLMChatTool } = await import('../../src/llm/chat.js');
    const tool = new LLMChatTool();

    const result = await tool.execute(
      { messages: [{ role: 'user', content: 'Hi' }] },
      mockContext
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('No response content from LLM');
  });

  it('returns failure on API error', async () => {
    mockCreate.mockRejectedValue(new Error('API rate limit exceeded'));

    const { LLMChatTool } = await import('../../src/llm/chat.js');
    const tool = new LLMChatTool();

    const result = await tool.execute(
      { messages: [{ role: 'user', content: 'Hi' }] },
      mockContext
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('LLM request failed: API rate limit exceeded');
  });

  it('handles empty choices array', async () => {
    mockCreate.mockResolvedValue({
      choices: [],
      model: 'test-model',
    });

    const { LLMChatTool } = await import('../../src/llm/chat.js');
    const tool = new LLMChatTool();

    const result = await tool.execute(
      { messages: [{ role: 'user', content: 'Hi' }] },
      mockContext
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('No response content from LLM');
  });

  it('handles missing usage data', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Response' } }],
      model: 'test-model',
    });

    const { LLMChatTool } = await import('../../src/llm/chat.js');
    const tool = new LLMChatTool();

    const result = await tool.execute(
      { messages: [{ role: 'user', content: 'Hi' }] },
      mockContext
    );

    expect(result.success).toBe(true);
    expect(result.data?.usage).toBeUndefined();
  });

  it('has correct metadata', async () => {
    const { LLMChatTool } = await import('../../src/llm/chat.js');
    const tool = new LLMChatTool();

    expect(tool.name).toBe('llm-chat');
    expect(tool.version).toBe('1.0.0');
    expect(tool.description).toBe('Send messages to an LLM and receive a response');
  });
});
