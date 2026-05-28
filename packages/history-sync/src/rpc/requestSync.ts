import { createIntegrationEvent } from '@agentg/events/envelope';
import { mutation, runtimeForInternalRpcCall } from '@agentg/framework/domain';
import { z } from 'zod';

import { nonEmptyStringSchema } from '../rangeSchema.js';
import type { HistorySyncRuntime } from '../domain.js';

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

export const requestSync = mutation((options: HistorySyncRuntime, procedure) =>
  procedure
    .input(historySyncRequestSyncInputSchema)
    .output(historySyncRequestSyncOutputSchema)
    .mutation(({ ctx, input }) => {
      const runtime = runtimeForInternalRpcCall(options, ctx);
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
