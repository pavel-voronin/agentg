import { createIntegrationEvent } from '@agentg/events/envelope';
import { mutation } from '@agentg/rpc/surface';

import { upsertManualHistorySyncTargetFromCommand } from '../../targetCommands.js';
import {
  historySyncTargetMutationOutputSchema,
  historySyncUpsertTargetInputSchema
} from '../historySyncContracts.js';
import { runtimeForCall, type CreateHistorySyncRouterOptions } from '../runtime.js';
import { rpc } from '../trpc.js';
import { currentHistorySyncProjectionContext, historySyncTargetToResponse } from './support.js';

export const upsertTarget = mutation((options: CreateHistorySyncRouterOptions) =>
  rpc
    .input(historySyncUpsertTargetInputSchema)
    .output(historySyncTargetMutationOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const runtime = runtimeForCall(options, ctx);
      const target = await upsertManualHistorySyncTargetFromCommand(runtime.database, input);

      runtime.eventBus.publish(
        createIntegrationEvent({
          data: {
            target: historySyncTargetToResponse(target, currentHistorySyncProjectionContext())
          },
          type: 'history-sync.target.upserted'
        })
      );
      runtime.eventBus.publish(
        createIntegrationEvent({
          data: {
            reason: 'target-upserted'
          },
          type: 'history-sync.sync.requested'
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
