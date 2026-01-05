import type { FastifyPluginAsync } from 'fastify';
import {
  createWorkflow,
  getWorkflow,
  listWorkflows,
  updateWorkflow,
  deleteWorkflow,
  createStep,
  triggerRun,
} from './handlers.js';

export const workflowRoutes: FastifyPluginAsync = async (app) => {
  app.post('/', createWorkflow);
  app.get('/', listWorkflows);
  app.get('/:id', getWorkflow);
  app.put('/:id', updateWorkflow);
  app.delete('/:id', deleteWorkflow);
  app.post('/:id/steps', createStep);
  app.post('/:id/runs', triggerRun);
};
