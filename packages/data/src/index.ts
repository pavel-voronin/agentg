import { defineInternalRpcDomain, type ProceduresOf } from '@agentg/framework';

import type { moduleDefinition } from './module.js';
export {
  actionRequestSchema,
  actionResultSchema,
  datasetSchema,
  expandInputSchema,
  getInputSchema,
  jsonValueSchema,
  renderInputSchema,
  selectInputSchema,
  type ActionResult,
  type Dataset,
  type DatasetRow,
  type ModelRef
} from './schema.js';

export const dataClient = defineInternalRpcDomain<ProceduresOf<typeof moduleDefinition>>('data');
