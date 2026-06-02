import type { EventBus } from '@agentg/framework';

import type { Database } from '../database/client.js';
import type { FileSubsystem } from '../files/index.js';
import type { Operations } from '../tdlib/operations.js';

export type ProcedureResources = {
  database: Database;
  events: EventBus;
  files: FileSubsystem;
  tdlib: Operations;
};
