import { createIntegrationEvent } from '@agentg/events/envelope';
import { mutation } from '@agentg/framework/domain';
import { z } from 'zod';

import { useEvents } from '../events/subsystem.js';
import { nonEmptyStringSchema } from '../rangeSchema.js';
import { useService } from '../service/subsystem.js';

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

export const requestSync = mutation((procedure) =>
  procedure
    .input(historySyncRequestSyncInputSchema)
    .output(historySyncRequestSyncOutputSchema)
    .mutation(({ input }) => {
      const events = useEvents();
      const { requestSync: queueSync } = useService();

      events.publish(
        createIntegrationEvent({
          data: {
            ...(input.chatId === undefined ? {} : { chatId: input.chatId }),
            reason: 'manual'
          },
          type: 'history-sync.sync.requested'
        })
      );
      queueSync('manual', input.chatId);

      return {
        requested: true
      };
    })
);
