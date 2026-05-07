import { createIntegrationEvent } from '@agentg/events/envelope';
import { mutation } from '@agentg/rpc/surface';

import {
  historyRequestSyncInputSchema,
  historyRequestSyncOutputSchema
} from '../history-contracts.js';
import { runtimeForCall, type CreateHistoryRouterOptions } from '../runtime.js';
import { rpc } from '../trpc.js';

export const requestSync = mutation((options: CreateHistoryRouterOptions) =>
  rpc
    .input(historyRequestSyncInputSchema)
    .output(historyRequestSyncOutputSchema)
    .mutation(({ ctx, input }) => {
      const runtime = runtimeForCall(options, ctx);
      runtime.eventBus.publish(
        createIntegrationEvent({
          data: {
            ...(input.chatId === undefined ? {} : { chatId: input.chatId }),
            reason: 'manual'
          },
          source: 'history',
          type: 'history.sync.requested'
        })
      );
      runtime.requestSync?.('manual', input.chatId);

      return {
        requested: true
      };
    })
);
