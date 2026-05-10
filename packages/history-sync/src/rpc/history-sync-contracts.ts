import { z } from 'zod';

const nonEmptyStringSchema = z.string().trim().min(1);

export const historySyncBoundarySchema = z.discriminatedUnion('kind', [
  z.object({
    at: nonEmptyStringSchema,
    kind: z.literal('absolute')
  }),
  z.object({
    expression: nonEmptyStringSchema,
    kind: z.literal('expression')
  })
]);

export const historySyncRangeSchema = z.object({
  end: historySyncBoundarySchema,
  start: historySyncBoundarySchema
});

export const historySyncGetChatHistorySyncStateInputSchema = z.object({
  chatId: nonEmptyStringSchema
});

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

export const historySyncDeleteTargetInputSchema = z.object({
  targetId: nonEmptyStringSchema
});

export const historySyncRequestSyncInputSchema = z
  .object({
    chatId: nonEmptyStringSchema.optional()
  })
  .default({});

export const historySyncSelectedChatOutputSchema = z.object({
  _model: z.literal('telegram.chat'),
  historySyncBeginningReached: z.boolean(),
  historySyncStartAt: z.string().nullable(),
  id: z.string(),
  isBot: z.boolean(),
  messageCount: z.number().int().nonnegative(),
  title: z.string(),
  type: z.string(),
  updatedAt: z.string()
});

export const historySyncIntervalOutputSchema = z.object({
  coveredAt: z.string().optional(),
  endAt: z.string(),
  messageCount: z.number().int().nonnegative().optional(),
  startAt: z.string()
});

export const historySyncTargetOutputSchema = z.object({
  chatId: z.string(),
  id: z.string(),
  projected: historySyncIntervalOutputSchema.optional(),
  range: historySyncRangeSchema,
  templateId: z.string().nullable().optional()
});

export const historySyncStoredTargetOutputSchema = z.object({
  chatId: z.string(),
  id: z.string(),
  range: historySyncRangeSchema,
  templateId: z.string().optional()
});

export const historySyncChatHistorySyncStateOutputSchema = z.object({
  chat: historySyncSelectedChatOutputSchema.nullable(),
  coverage: z.array(historySyncIntervalOutputSchema),
  desired: z.array(historySyncIntervalOutputSchema),
  missing: z.array(historySyncIntervalOutputSchema),
  targets: z.array(historySyncTargetOutputSchema)
});

export const historySyncTargetMutationOutputSchema = z.object({
  deleted: z.boolean(),
  target: historySyncStoredTargetOutputSchema.optional(),
  upserted: z.boolean()
});

export const historySyncRequestSyncOutputSchema = z.object({
  requested: z.boolean()
});

export type HistorySyncGetChatHistorySyncStateInput = z.infer<
  typeof historySyncGetChatHistorySyncStateInputSchema
>;
export type HistorySyncUpsertTargetInput = z.infer<typeof historySyncUpsertTargetInputSchema>;
export type HistorySyncDeleteTargetInput = z.infer<typeof historySyncDeleteTargetInputSchema>;
export type HistorySyncRequestSyncInput = z.infer<typeof historySyncRequestSyncInputSchema>;

export type HistorySyncChatHistorySyncStateOutput = z.infer<
  typeof historySyncChatHistorySyncStateOutputSchema
>;
export type HistorySyncIntervalOutput = z.infer<typeof historySyncIntervalOutputSchema>;
export type HistorySyncTargetOutput = z.infer<typeof historySyncTargetOutputSchema>;
export type HistorySyncStoredTargetOutput = z.infer<typeof historySyncStoredTargetOutputSchema>;
export type HistorySyncTargetMutationOutput = z.infer<typeof historySyncTargetMutationOutputSchema>;
export type HistorySyncRequestSyncOutput = z.infer<typeof historySyncRequestSyncOutputSchema>;
