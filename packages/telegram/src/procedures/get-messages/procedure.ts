import { timeTelemetrySpan } from '@agentg/framework';

import type { ProcedureResources } from '../resources.js';
import {
  getMessagesInputSchema,
  getMessagesOutputSchema,
  type GetMessagesInput,
  type GetMessagesOutput
} from './contract.js';
import { enqueueGetMessagesRequest } from './enqueue.js';
import { checkMessagesReadiness } from './readiness.js';
import { toOutputMessages } from './read.js';
import { normalizeMessageOwner } from '../../reconciler/owner.js';
import { recordGetMessagesRequest } from '../../reconciler/telemetry.js';

export function createGetMessagesProcedure(resources: ProcedureResources) {
  return async (input: unknown): Promise<GetMessagesOutput> => {
    const parsed = getMessagesInputSchema.parse(input);
    const output = await runGetMessages(parsed, resources);
    return getMessagesOutputSchema.parse(output);
  };
}

export async function runGetMessages(
  input: GetMessagesInput,
  resources: ProcedureResources
): Promise<GetMessagesOutput> {
  return timeTelemetrySpan(
    {
      attributes: {
        'owner.kind': normalizeMessageOwner(input.owner).kind,
        'selector.kind': input.selector.kind
      },
      name: 'telegram.get_messages'
    },
    async () => {
      const readiness = await checkMessagesReadiness(resources.database, input);
      const ownerKind = normalizeMessageOwner(input.owner).kind;
      if (readiness.ready) {
        recordGetMessagesRequest({
          ownerKind,
          result: 'ready',
          selectorKind: input.selector.kind
        });
        const messages = await toOutputMessages(resources.database, readiness.rows.messages);
        return readiness.rows.selectorKind === 'page'
          ? {
              messages,
              reachedStart: readiness.rows.reachedStart,
              status: 'ready'
            }
          : {
              messages,
              status: 'ready'
            };
      }

      const pending = await enqueueGetMessagesRequest(resources.reconciler, input);
      recordGetMessagesRequest({
        ownerKind,
        result: pending.result,
        selectorKind: input.selector.kind
      });
      return {
        requestId: pending.requestId,
        status: 'pending'
      };
    }
  );
}
