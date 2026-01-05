import type { FastifyPluginAsync } from 'fastify';
import { getRun, listRuns, getRunSteps, cancelRun } from './handlers.js';

export const runRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', listRuns);
  app.get('/:id', getRun);
  app.get('/:id/steps', getRunSteps);
  app.post('/:id/cancel', cancelRun);
};
