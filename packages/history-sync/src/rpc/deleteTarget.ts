import { createIntegrationEvent } from '@agentg/events/envelope';
import { mutation, runtimeForInternalRpcCall } from '@agentg/framework/domain';
import { z } from 'zod';

import { historySyncRangeSchema, nonEmptyStringSchema } from '../rangeSchema.js';
import { deleteManualHistorySyncTargetFromCommand } from '../targetCommands.js';
import type { HistorySyncRuntime } from '../main.js';

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

export const deleteTarget = mutation((options: HistorySyncRuntime, procedure) =>
  procedure
    .input(historySyncDeleteTargetInputSchema)
    .output(historySyncTargetMutationOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const runtime = runtimeForInternalRpcCall(options, ctx);
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
