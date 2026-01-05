import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/shared',
  'packages/queue',
  'packages/tools',
  'packages/engine',
  'packages/api',
  'packages/worker',
]);
