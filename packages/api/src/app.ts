import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createLogger } from '@workflow/shared';
import { workflowRoutes } from './routes/workflows/index.js';
import { runRoutes } from './routes/runs/index.js';

const logger = createLogger('api');

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
    },
  });

  await app.register(cors, {
    origin: true,
  });

  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  await app.register(workflowRoutes, { prefix: '/workflows' });
  await app.register(runRoutes, { prefix: '/runs' });

  app.setErrorHandler((error: Error & { statusCode?: number; code?: string }, _request, reply) => {
    logger.error({ err: error }, 'Request error');

    const statusCode = error.statusCode ?? 500;
    const message = error.message ?? 'Internal Server Error';

    reply.status(statusCode).send({
      error: {
        message,
        code: error.code ?? 'INTERNAL_ERROR',
      },
    });
  });

  return app;
}
