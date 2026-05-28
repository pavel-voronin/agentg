import { createIntegrationEvent } from '@agentg/events/envelope';
import { mutation, runtimeForInternalRpcCall } from '@agentg/framework/domain';
import { z } from 'zod';

import { historySyncRangeSchema, nonEmptyStringSchema } from '../rangeSchema.js';
import { upsertManualHistorySyncTargetFromCommand } from '../targetCommands.js';
import type { HistorySyncRuntime } from '../domain.js';
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

export const upsertTarget = mutation((options: HistorySyncRuntime, procedure) =>
  procedure
    .input(historySyncUpsertTargetInputSchema)
    .output(historySyncTargetMutationOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const runtime = runtimeForInternalRpcCall(options, ctx);
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
