export interface ResolverContext {
  input: Record<string, unknown>;
  steps: Record<string, Record<string, unknown>>;
  env: Record<string, string | undefined>;
}

export class VariableResolver {
  private readonly variablePattern = /\{\{\s*([^}]+)\s*\}\}/g;

  resolve(template: unknown, context: ResolverContext): unknown {
    if (typeof template === 'string') {
      return this.resolveString(template, context);
    }

    if (Array.isArray(template)) {
      return template.map((item) => this.resolve(item, context));
    }

    if (template !== null && typeof template === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(template)) {
        result[key] = this.resolve(value, context);
      }
      return result;
    }

    return template;
  }

  private resolveString(template: string, context: ResolverContext): unknown {
    const fullMatch = template.match(/^\{\{\s*([^}]+)\s*\}\}$/);
    if (fullMatch) {
      return this.evaluateExpression(fullMatch[1]!, context);
    }

    return template.replace(this.variablePattern, (_, expression: string) => {
      const value = this.evaluateExpression(expression, context);
      return value === undefined ? '' : String(value);
    });
  }

  private evaluateExpression(
    expression: string,
    context: ResolverContext
  ): unknown {
    const trimmed = expression.trim();
    const parts = trimmed.split('.');

    const [root, ...path] = parts;
    if (!root) return undefined;

    let value: unknown;

    switch (root) {
      case 'input':
        value = context.input;
        break;
      case 'steps':
        value = context.steps;
        break;
      case 'env':
        value = context.env;
        break;
      default:
        return undefined;
    }

    for (const part of path) {
      if (value === null || value === undefined) {
        return undefined;
      }

      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, key, indexStr] = arrayMatch;
        value = (value as Record<string, unknown>)[key!];
        if (Array.isArray(value)) {
          value = value[parseInt(indexStr!, 10)];
        } else {
          return undefined;
        }
      } else {
        value = (value as Record<string, unknown>)[part];
      }
    }

    return value;
  }
}

export const variableResolver = new VariableResolver();
