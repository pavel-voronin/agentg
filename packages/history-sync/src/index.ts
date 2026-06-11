import { defineInternalRpcDomain, type ProceduresOf } from '@agentg/framework';

import type { historySyncModule } from './module.js';

export const historySyncClient =
  defineInternalRpcDomain<ProceduresOf<typeof historySyncModule>>('history-sync');
