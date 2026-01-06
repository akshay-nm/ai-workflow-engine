import type { IToolRegistry, ITool } from '@workflow/shared';
import { LLMChatTool, HttpFetchTool, TransformTool } from '@workflow/tools';

/**
 * Configuration options for tool registration.
 */
export interface ToolRegistrationConfig {
  /** Enable the LLM chat tool (default: true) */
  enableLLM?: boolean;
  /** Enable the HTTP fetch tool (default: true) */
  enableHttp?: boolean;
  /** Enable the transform tool (default: true) */
  enableTransform?: boolean;
  /** Custom tools to register */
  customTools?: ITool[];
}

/**
 * Register default tools with a tool registry.
 * This is the main function for setting up tools in the worker.
 *
 * @param registry - The tool registry to register tools with
 * @param config - Optional configuration to control which tools are registered
 */
export function registerDefaultTools(
  registry: IToolRegistry,
  config: ToolRegistrationConfig = {}
): void {
  const {
    enableLLM = true,
    enableHttp = true,
    enableTransform = true,
    customTools = [],
  } = config;

  if (enableLLM) {
    registry.register(new LLMChatTool());
  }

  if (enableHttp) {
    registry.register(new HttpFetchTool());
  }

  if (enableTransform) {
    registry.register(new TransformTool());
  }

  for (const tool of customTools) {
    registry.register(tool);
  }
}
