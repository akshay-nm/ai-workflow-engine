import { describe, it, expect } from 'vitest';
import { VariableResolver, type ResolverContext } from '../src/variable-resolver/index.js';

describe('VariableResolver', () => {
  const resolver = new VariableResolver();

  const createContext = (
    input: Record<string, unknown> = {},
    steps: Record<string, Record<string, unknown>> = {},
    env: Record<string, string | undefined> = {}
  ): ResolverContext => ({
    input,
    steps,
    env,
  });

  describe('string resolution', () => {
    it('resolves input variables', () => {
      const context = createContext({ name: 'John' });

      const result = resolver.resolve('{{ input.name }}', context);

      expect(result).toBe('John');
    });

    it('resolves steps variables', () => {
      const context = createContext({}, { step1: { result: 'success' } });

      const result = resolver.resolve('{{ steps.step1.result }}', context);

      expect(result).toBe('success');
    });

    it('resolves env variables', () => {
      const context = createContext({}, {}, { NODE_ENV: 'test' });

      const result = resolver.resolve('{{ env.NODE_ENV }}', context);

      expect(result).toBe('test');
    });

    it('resolves nested properties', () => {
      const context = createContext({ user: { profile: { email: 'john@example.com' } } });

      const result = resolver.resolve('{{ input.user.profile.email }}', context);

      expect(result).toBe('john@example.com');
    });

    it('resolves array indexing', () => {
      const context = createContext({}, { fetch: { data: ['a', 'b', 'c'] } });

      const result = resolver.resolve('{{ steps.fetch.data[1] }}', context);

      expect(result).toBe('b');
    });

    it('handles mixed string interpolation', () => {
      const context = createContext({ name: 'John' });

      const result = resolver.resolve('Hello {{ input.name }}!', context);

      expect(result).toBe('Hello John!');
    });

    it('handles multiple variables in one string', () => {
      const context = createContext({ first: 'John', last: 'Doe' });

      const result = resolver.resolve('{{ input.first }} {{ input.last }}', context);

      expect(result).toBe('John Doe');
    });

    it('returns empty string for undefined in interpolation', () => {
      const context = createContext({});

      const result = resolver.resolve('Value: {{ input.missing }}', context);

      expect(result).toBe('Value: ');
    });

    it('returns actual value for full variable match', () => {
      const context = createContext({ count: 42 });

      const result = resolver.resolve('{{ input.count }}', context);

      expect(result).toBe(42);
    });

    it('returns object for full variable match', () => {
      const context = createContext({ user: { name: 'John', age: 30 } });

      const result = resolver.resolve('{{ input.user }}', context);

      expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('handles whitespace in template', () => {
      const context = createContext({ name: 'John' });

      const result = resolver.resolve('{{  input.name  }}', context);

      expect(result).toBe('John');
    });

    it('returns undefined for unknown root', () => {
      const context = createContext({});

      const result = resolver.resolve('{{ unknown.path }}', context);

      expect(result).toBeUndefined();
    });

    it('returns undefined for null in path', () => {
      const context = createContext({ user: null });

      const result = resolver.resolve('{{ input.user.name }}', context);

      expect(result).toBeUndefined();
    });
  });

  describe('object resolution', () => {
    it('resolves variables in object values', () => {
      const context = createContext({ name: 'John', age: 30 });
      const template = {
        greeting: 'Hello {{ input.name }}',
        years: '{{ input.age }}',
      };

      const result = resolver.resolve(template, context);

      expect(result).toEqual({
        greeting: 'Hello John',
        years: 30,
      });
    });

    it('resolves nested objects', () => {
      const context = createContext({ name: 'John' });
      const template = {
        user: {
          displayName: '{{ input.name }}',
        },
      };

      const result = resolver.resolve(template, context);

      expect(result).toEqual({
        user: {
          displayName: 'John',
        },
      });
    });
  });

  describe('array resolution', () => {
    it('resolves variables in array items', () => {
      const context = createContext({ a: 'first', b: 'second' });
      const template = ['{{ input.a }}', '{{ input.b }}', 'literal'];

      const result = resolver.resolve(template, context);

      expect(result).toEqual(['first', 'second', 'literal']);
    });
  });

  describe('primitive passthrough', () => {
    it('passes through numbers', () => {
      const context = createContext({});

      expect(resolver.resolve(42, context)).toBe(42);
    });

    it('passes through booleans', () => {
      const context = createContext({});

      expect(resolver.resolve(true, context)).toBe(true);
      expect(resolver.resolve(false, context)).toBe(false);
    });

    it('passes through null', () => {
      const context = createContext({});

      expect(resolver.resolve(null, context)).toBeNull();
    });

    it('passes through undefined', () => {
      const context = createContext({});

      expect(resolver.resolve(undefined, context)).toBeUndefined();
    });

    it('passes through strings without templates', () => {
      const context = createContext({});

      expect(resolver.resolve('plain text', context)).toBe('plain text');
    });
  });
});
