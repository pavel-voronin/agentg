import { createIntegrationEvent } from '@agentg/events/envelope';
import { mutation } from '@agentg/framework';
import { z } from 'zod';

import { useDatabase } from '../database/subsystem.js';
import { useEvents } from '../events/subsystem.js';
import { historySyncRangeSchema, nonEmptyStringSchema } from '../rangeSchema.js';
import { useService } from '../service/subsystem.js';
import { deleteManualHistorySyncTargetFromCommand } from '../targetCommands.js';

export const historySyncDeleteTargetInputSchema = z.object({
  targetId: nonEmptyStringSchema
});

export const historySyncStoredTargetOutputSchema = z.object({
  chatId: z.string(),
  id: z.string(),
  range: historySyncRangeSchema,
  templateId: z.string().optional()
});

export const historySyncTargetMutationOutputSchema = z.object({
  deleted: z.boolean(),
  target: historySyncStoredTargetOutputSchema.optional(),
  upserted: z.boolean()
});

export type HistorySyncDeleteTargetInput = z.infer<typeof historySyncDeleteTargetInputSchema>;
export type HistorySyncStoredTargetOutput = z.infer<typeof historySyncStoredTargetOutputSchema>;
export type HistorySyncTargetMutationOutput = z.infer<typeof historySyncTargetMutationOutputSchema>;

export const deleteTarget = mutation((procedure) =>
  procedure
    .input(historySyncDeleteTargetInputSchema)
    .output(historySyncTargetMutationOutputSchema)
    .mutation(async ({ input }) => {
      const database = useDatabase();
      const events = useEvents();
      const { requestSync } = useService();
      const target = await deleteManualHistorySyncTargetFromCommand(database, input);

      events.publish(
        createIntegrationEvent({
          data: {
            target
          },
          type: 'history-sync.target.deleted'
        })
      );
      events.publish(
        createIntegrationEvent({
          data: {
            reason: 'target-deleted'
          },
          type: 'history-sync.sync.requested'
        })
      );
      requestSync('target-deleted');

      return {
        deleted: true,
        target,
        upserted: false
      };
    })
);
