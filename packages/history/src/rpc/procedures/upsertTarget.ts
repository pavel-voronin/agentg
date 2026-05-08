import { createIntegrationEvent } from '@agentg/events/envelope';
import { mutation } from '@agentg/rpc/surface';

import { upsertManualHistoryTargetFromCommand } from '../../target-commands.js';
import {
  historyTargetMutationOutputSchema,
  historyUpsertTargetInputSchema
} from '../history-contracts.js';
import { runtimeForCall, type CreateHistoryRouterOptions } from '../runtime.js';
import { rpc } from '../trpc.js';
import { currentHistoryProjectionContext, historyTargetToResponse } from './support.js';

export const upsertTarget = mutation((options: CreateHistoryRouterOptions) =>
  rpc
    .input(historyUpsertTargetInputSchema)
    .output(historyTargetMutationOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const runtime = runtimeForCall(options, ctx);
      const target = await upsertManualHistoryTargetFromCommand(runtime.database, input);

      runtime.eventBus.publish(
        createIntegrationEvent({
          data: {
            target: historyTargetToResponse(target, currentHistoryProjectionContext())
          },
          type: 'history.target.upserted'
        })
      );
      runtime.eventBus.publish(
        createIntegrationEvent({
          data: {
            reason: 'target-upserted'
          },
          type: 'history.sync.requested'
        })
      );
      runtime.requestSync?.('target-upserted');

      return {
        deleted: false,
        target,
        upserted: true
      };
    })
);
