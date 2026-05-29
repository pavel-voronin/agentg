import { createIntegrationEvent } from '@agentg/events/envelope';
import { mutation, contextForInternalRpcCall } from '@agentg/framework/domain';
import { z } from 'zod';

import { nonEmptyStringSchema } from '../rangeSchema.js';
import type { HistorySyncDomainContext } from '../main.js';

export const historySyncRequestSyncInputSchema = z
  .object({
    chatId: nonEmptyStringSchema.optional()
  })
  .default({});

export const historySyncRequestSyncOutputSchema = z.object({
  requested: z.boolean()
});

export type HistorySyncRequestSyncInput = z.infer<typeof historySyncRequestSyncInputSchema>;
export type HistorySyncRequestSyncOutput = z.infer<typeof historySyncRequestSyncOutputSchema>;

export const requestSync = mutation((options: HistorySyncDomainContext, procedure) =>
  procedure
    .input(historySyncRequestSyncInputSchema)
    .output(historySyncRequestSyncOutputSchema)
    .mutation(({ ctx, input }) => {
      const context = contextForInternalRpcCall(options, ctx);
      context.eventBus.publish(
        createIntegrationEvent({
          data: {
            ...(input.chatId === undefined ? {} : { chatId: input.chatId }),
            reason: 'manual'
          },
          type: 'history-sync.sync.requested'
        })
      );
      context.requestSync?.('manual', input.chatId);

      return {
        requested: true
      };
    })
);
