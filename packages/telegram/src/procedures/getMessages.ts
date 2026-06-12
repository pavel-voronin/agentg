import type { ProcedureResources } from './resources.js';
import { createGetMessagesProcedure } from './get-messages/procedure.js';

export function getMessagesProcedure(resources: ProcedureResources) {
  return createGetMessagesProcedure(resources);
}
