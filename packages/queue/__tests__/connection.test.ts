import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockQuit = vi.fn().mockResolvedValue('OK');
const mockIORedis = vi.fn().mockImplementation(() => ({
  quit: mockQuit,
}));

vi.mock('ioredis', () => ({
  Redis: mockIORedis,
}));

describe('connection', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('getConnection creates IORedis with default URL', async () => {
    delete process.env['REDIS_URL'];

    const { getConnection } = await import('../src/connection.js');
    const connection = getConnection();

    expect(mockIORedis).toHaveBeenCalledWith('redis://localhost:6379', {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    expect(connection).toBeDefined();
  });

  it('getConnection uses REDIS_URL from environment', async () => {
    process.env['REDIS_URL'] = 'redis://custom-host:6380';

    const { getConnection } = await import('../src/connection.js');
    getConnection();

    expect(mockIORedis).toHaveBeenCalledWith('redis://custom-host:6380', {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  });

  it('getConnection returns same instance on multiple calls', async () => {
    const { getConnection } = await import('../src/connection.js');

    const first = getConnection();
    const second = getConnection();

    expect(first).toBe(second);
    expect(mockIORedis).toHaveBeenCalledTimes(1);
  });

  it('closeConnection calls quit and clears reference', async () => {
    const { getConnection, closeConnection } = await import('../src/connection.js');

    getConnection();
    await closeConnection();

    expect(mockQuit).toHaveBeenCalled();
  });

  it('closeConnection does nothing if no connection exists', async () => {
    const { closeConnection } = await import('../src/connection.js');

    await closeConnection();

    expect(mockQuit).not.toHaveBeenCalled();
  });

  it('getConnection creates new instance after closeConnection', async () => {
    const { getConnection, closeConnection } = await import('../src/connection.js');

    getConnection();
    await closeConnection();

    mockIORedis.mockClear();
    getConnection();

    expect(mockIORedis).toHaveBeenCalledTimes(1);
  });
});
