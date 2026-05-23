import { createIntegrationEvent } from '@agentg/events/envelope';
import { mutation } from '@agentg/rpc/surface';

import {
  historySyncRequestSyncInputSchema,
  historySyncRequestSyncOutputSchema
} from '../historySyncContracts.js';
import { runtimeForCall, type CreateHistorySyncRouterOptions } from '../runtime.js';
import { rpc } from '../trpc.js';

export const requestSync = mutation((options: CreateHistorySyncRouterOptions) =>
  rpc
    .input(historySyncRequestSyncInputSchema)
    .output(historySyncRequestSyncOutputSchema)
    .mutation(({ ctx, input }) => {
      const runtime = runtimeForCall(options, ctx);
      runtime.eventBus.publish(
        createIntegrationEvent({
          data: {
            ...(input.chatId === undefined ? {} : { chatId: input.chatId }),
            reason: 'manual'
          },
          type: 'history-sync.sync.requested'
        })
      );
      runtime.requestSync?.('manual', input.chatId);

      return {
        requested: true
      };
    })
);
