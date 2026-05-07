import { createIntegrationEvent } from '@agentg/events/envelope';
import { mutation } from '@agentg/rpc/surface';

import { deleteManualHistoryTargetFromCommand } from '../../target-commands.js';
import {
  historyDeleteTargetInputSchema,
  historyTargetMutationOutputSchema
} from '../history-contracts.js';
import { runtimeForCall, type CreateHistoryRouterOptions } from '../runtime.js';
import { rpc } from '../trpc.js';

export const deleteTarget = mutation((options: CreateHistoryRouterOptions) =>
  rpc
    .input(historyDeleteTargetInputSchema)
    .output(historyTargetMutationOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const runtime = runtimeForCall(options, ctx);
      const target = await deleteManualHistoryTargetFromCommand(runtime.database, input);

      runtime.eventBus.publish(
        createIntegrationEvent({
          data: {
            target
          },
          source: 'history',
          type: 'history.target.deleted'
        })
      );
      runtime.eventBus.publish(
        createIntegrationEvent({
          data: {
            reason: 'target-deleted'
          },
          source: 'history',
          type: 'history.sync.requested'
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
