import { Redis } from 'ioredis';

let connection: Redis | null = null;

export function getConnection(): Redis {
  if (!connection) {
    const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
    connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return connection;
}

export async function closeConnection(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
