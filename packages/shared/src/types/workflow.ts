export type WorkflowStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  version: number;
  inputSchema: Record<string, unknown> | null;
  config: Record<string, unknown> | null;
  status: WorkflowStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  config?: Record<string, unknown>;
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  config?: Record<string, unknown>;
  status?: WorkflowStatus;
}
