import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('logger', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('exports logger instance', async () => {
    const { logger } = await import('../src/logger/index.js');

    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('createLogger returns a child logger with name', async () => {
    const { createLogger } = await import('../src/logger/index.js');

    const childLogger = createLogger('test-service');

    expect(childLogger).toBeDefined();
    expect(typeof childLogger.info).toBe('function');
  });

  it('uses LOG_LEVEL from environment', async () => {
    process.env['LOG_LEVEL'] = 'debug';
    process.env['NODE_ENV'] = 'production';

    const { logger } = await import('../src/logger/index.js');

    expect(logger.level).toBe('debug');
  });

  it('defaults to info level when LOG_LEVEL not set', async () => {
    delete process.env['LOG_LEVEL'];
    process.env['NODE_ENV'] = 'production';

    const { logger } = await import('../src/logger/index.js');

    expect(logger.level).toBe('info');
  });
});
