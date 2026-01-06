export { BaseTool, type Tool } from './base.js';
export { ToolRegistry, toolRegistry } from './registry.js';

export { LLMChatTool } from './llm/index.js';
export { HttpFetchTool } from './http/index.js';
export { TransformTool } from './transform/index.js';

import { toolRegistry } from './registry.js';
import { LLMChatTool } from './llm/index.js';
import { HttpFetchTool } from './http/index.js';
import { TransformTool } from './transform/index.js';

export function registerDefaultTools(): void {
  toolRegistry.register(new LLMChatTool());
  toolRegistry.register(new HttpFetchTool());
  toolRegistry.register(new TransformTool());
}
