import { createIntegrationEvent } from '@agentg/events/envelope';
import { mutation } from '@agentg/rpc/surface';

import { deleteManualHistorySyncTargetFromCommand } from '../../target-commands.js';
import {
  historySyncDeleteTargetInputSchema,
  historySyncTargetMutationOutputSchema
} from '../history-sync-contracts.js';
import { runtimeForCall, type CreateHistorySyncRouterOptions } from '../runtime.js';
import { rpc } from '../trpc.js';

export const deleteTarget = mutation((options: CreateHistorySyncRouterOptions) =>
  rpc
    .input(historySyncDeleteTargetInputSchema)
    .output(historySyncTargetMutationOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const runtime = runtimeForCall(options, ctx);
      const target = await deleteManualHistorySyncTargetFromCommand(runtime.database, input);

      runtime.eventBus.publish(
        createIntegrationEvent({
          data: {
            target
          },
          type: 'history-sync.target.deleted'
        })
      );
      runtime.eventBus.publish(
        createIntegrationEvent({
          data: {
            reason: 'target-deleted'
          },
          type: 'history-sync.sync.requested'
        })
      );
      runtime.requestSync?.('target-deleted');

      return {
        deleted: true,
        target,
        upserted: false
      };
    })
);
