import { defineInternalRpcDomain, type ProceduresOf } from '@agentg/framework';

import type { telegramModule } from './module.js';

export const telegramClient =
  defineInternalRpcDomain<ProceduresOf<typeof telegramModule>>('telegram');
