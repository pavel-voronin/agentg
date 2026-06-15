import { timeTelemetrySpan } from '@agentg/framework';

import type { ProcedureResources } from '../resources.js';
import {
  getMessagesInputSchema,
  getMessagesOutputSchema,
  type GetMessagesInput,
  type GetMessagesOutput
} from './contract.js';
import { enqueueGetMessagesRequest } from './enqueue.js';
import { normalizeMessageOwner } from '../../domain/models/messageSelection.js';
import { checkMessagesReadiness } from '../../repositories/messageReadinessRepository.js';
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
        return readiness.rows.selectorKind === 'page'
          ? {
              messages: readiness.rows.messages,
              reachedStart: readiness.rows.reachedStart,
              status: 'ready'
            }
          : {
              messages: readiness.rows.messages,
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
