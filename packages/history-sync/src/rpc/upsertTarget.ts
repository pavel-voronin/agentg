import { createIntegrationEvent } from '@agentg/events/envelope';
import { mutation, contextForInternalRpcCall } from '@agentg/framework/domain';
import { z } from 'zod';

import { historySyncRangeSchema, nonEmptyStringSchema } from '../rangeSchema.js';
import { upsertManualHistorySyncTargetFromCommand } from '../targetCommands.js';
import type { HistorySyncDomainContext } from '../main.js';
import { historySyncStoredTargetOutputSchema } from './deleteTarget.js';
import { currentHistorySyncProjectionContext, historySyncTargetToResponse } from '../readModel.js';

export const historySyncUpsertTargetInputSchema = z
  .object({
    chatId: nonEmptyStringSchema,
    end: nonEmptyStringSchema.optional(),
    preset: nonEmptyStringSchema.optional(),
    range: historySyncRangeSchema.optional(),
    start: nonEmptyStringSchema.optional(),
    targetId: nonEmptyStringSchema.optional()
  })
  .superRefine((value, context) => {
    if (value.preset !== undefined || value.range !== undefined) {
      return;
    }
    if (value.start !== undefined && value.end !== undefined) {
      return;
    }

    context.addIssue({
      code: 'custom',
      message: 'history-sync.upsertTarget requires preset, range, or start/end'
    });
  });

export const historySyncTargetMutationOutputSchema = z.object({
  deleted: z.boolean(),
  target: historySyncStoredTargetOutputSchema.optional(),
  upserted: z.boolean()
});

export type HistorySyncUpsertTargetInput = z.infer<typeof historySyncUpsertTargetInputSchema>;
export type HistorySyncTargetMutationOutput = z.infer<typeof historySyncTargetMutationOutputSchema>;

export const upsertTarget = mutation((options: HistorySyncDomainContext, procedure) =>
  procedure
    .input(historySyncUpsertTargetInputSchema)
    .output(historySyncTargetMutationOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const context = contextForInternalRpcCall(options, ctx);
      const target = await upsertManualHistorySyncTargetFromCommand(context.database, input);

      context.eventBus.publish(
        createIntegrationEvent({
          data: {
            target: historySyncTargetToResponse(target, currentHistorySyncProjectionContext())
          },
          type: 'history-sync.target.upserted'
        })
      );
      context.eventBus.publish(
        createIntegrationEvent({
          data: {
            reason: 'target-upserted'
          },
          type: 'history-sync.sync.requested'
        })
      );
      context.requestSync?.('target-upserted');

      return {
        deleted: false,
        target,
        upserted: true
      };
    })
);
