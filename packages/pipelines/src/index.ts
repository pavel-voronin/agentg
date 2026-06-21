import { defineInternalRpcDomain, type ProceduresOf } from '@agentg/framework';

import { moduleDefinition } from './module.js';

export const pipelinesClient =
  defineInternalRpcDomain<ProceduresOf<typeof moduleDefinition>>('pipelines');
