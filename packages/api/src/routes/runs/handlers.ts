import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@workflow/database';
import { NotFoundError } from '@workflow/shared';

export async function getRun(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const run = await prisma.workflowRun.findUnique({
    where: { id: request.params.id },
    include: {
      workflow: true,
      stepRuns: {
        include: { step: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!run) {
    throw new NotFoundError('WorkflowRun', request.params.id);
  }

  return reply.send(run);
}

export async function listRuns(
  request: FastifyRequest<{ Querystring: { workflowId?: string } }>,
  reply: FastifyReply
) {
  const where = request.query.workflowId
    ? { workflowId: request.query.workflowId }
    : {};

  const runs = await prisma.workflowRun.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return reply.send(runs);
}

export async function getRunSteps(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const run = await prisma.workflowRun.findUnique({
    where: { id: request.params.id },
  });

  if (!run) {
    throw new NotFoundError('WorkflowRun', request.params.id);
  }

  const stepRuns = await prisma.stepRun.findMany({
    where: { workflowRunId: request.params.id },
    include: { step: true },
    orderBy: { createdAt: 'asc' },
  });

  return reply.send(stepRuns);
}

export async function cancelRun(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const run = await prisma.workflowRun.findUnique({
    where: { id: request.params.id },
  });

  if (!run) {
    throw new NotFoundError('WorkflowRun', request.params.id);
  }

  if (run.status !== 'PENDING' && run.status !== 'RUNNING') {
    return reply.status(400).send({
      error: {
        message: 'Can only cancel PENDING or RUNNING runs',
        code: 'INVALID_STATE',
      },
    });
  }

  const updatedRun = await prisma.workflowRun.update({
    where: { id: request.params.id },
    data: {
      status: 'CANCELLED',
      completedAt: new Date(),
    },
  });

  return reply.send(updatedRun);
}
