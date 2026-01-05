import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma, Prisma } from '@workflow/database';
import { getWorkflowQueue } from '@workflow/queue';
import { NotFoundError, ValidationError } from '@workflow/shared';
import {
  createWorkflowSchema,
  updateWorkflowSchema,
  createStepSchema,
  triggerRunSchema,
} from './schemas.js';

export async function createWorkflow(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const parsed = createWorkflowSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message);
  }

  const data: Prisma.WorkflowCreateInput = {
    name: parsed.data.name,
    description: parsed.data.description ?? null,
  };
  if (parsed.data.inputSchema) {
    data.inputSchema = parsed.data.inputSchema as Prisma.InputJsonValue;
  }
  if (parsed.data.config) {
    data.config = parsed.data.config as Prisma.InputJsonValue;
  }

  const workflow = await prisma.workflow.create({ data });

  return reply.status(201).send(workflow);
}

export async function getWorkflow(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const workflow = await prisma.workflow.findUnique({
    where: { id: request.params.id },
    include: {
      steps: { orderBy: { order: 'asc' } },
    },
  });

  if (!workflow) {
    throw new NotFoundError('Workflow', request.params.id);
  }

  return reply.send(workflow);
}

export async function listWorkflows(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  const workflows = await prisma.workflow.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return reply.send(workflows);
}

export async function updateWorkflow(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const parsed = updateWorkflowSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message);
  }

  const data: Prisma.WorkflowUpdateInput = {
    version: { increment: 1 },
  };
  if (parsed.data.name !== undefined) {
    data.name = parsed.data.name;
  }
  if (parsed.data.description !== undefined) {
    data.description = parsed.data.description;
  }
  if (parsed.data.status !== undefined) {
    data.status = parsed.data.status;
  }
  if (parsed.data.inputSchema !== undefined) {
    data.inputSchema = parsed.data.inputSchema as Prisma.InputJsonValue;
  }
  if (parsed.data.config !== undefined) {
    data.config = parsed.data.config as Prisma.InputJsonValue;
  }

  const workflow = await prisma.workflow.update({
    where: { id: request.params.id },
    data,
  });

  return reply.send(workflow);
}

export async function deleteWorkflow(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  await prisma.workflow.delete({
    where: { id: request.params.id },
  });

  return reply.status(204).send();
}

export async function createStep(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const parsed = createStepSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message);
  }

  const workflow = await prisma.workflow.findUnique({
    where: { id: request.params.id },
  });

  if (!workflow) {
    throw new NotFoundError('Workflow', request.params.id);
  }

  const data: Prisma.StepUncheckedCreateInput = {
    workflowId: request.params.id,
    name: parsed.data.name,
    type: parsed.data.type,
    toolName: parsed.data.toolName,
    config: parsed.data.config as Prisma.InputJsonValue,
    order: parsed.data.order,
    description: parsed.data.description ?? null,
  };
  if (parsed.data.inputMapping !== undefined) {
    data.inputMapping = parsed.data.inputMapping as Prisma.InputJsonValue;
  }
  if (parsed.data.retryConfig !== undefined) {
    data.retryConfig = parsed.data.retryConfig as Prisma.InputJsonValue;
  }
  if (parsed.data.timeout !== undefined) {
    data.timeout = parsed.data.timeout;
  }

  const step = await prisma.step.create({ data });

  return reply.status(201).send(step);
}

export async function triggerRun(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const parsed = triggerRunSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    throw new ValidationError(parsed.error.message);
  }

  const workflow = await prisma.workflow.findUnique({
    where: { id: request.params.id },
  });

  if (!workflow) {
    throw new NotFoundError('Workflow', request.params.id);
  }

  if (workflow.status !== 'ACTIVE') {
    throw new ValidationError('Workflow must be ACTIVE to trigger a run');
  }

  const data: Prisma.WorkflowRunUncheckedCreateInput = {
    workflowId: request.params.id,
    status: 'PENDING',
  };
  if (parsed.data.input !== undefined) {
    data.input = parsed.data.input as Prisma.InputJsonValue;
  }

  const workflowRun = await prisma.workflowRun.create({ data });

  const queue = getWorkflowQueue();
  await queue.add(
    'workflow.execute',
    {
      workflowRunId: workflowRun.id,
      workflowId: request.params.id,
    },
    {
      jobId: workflowRun.id,
    }
  );

  return reply.status(202).send(workflowRun);
}
