import { z } from 'zod';

const nonEmptyStringSchema = z.string().trim().min(1);

export const historyBoundarySchema = z.discriminatedUnion('kind', [
  z.object({
    at: nonEmptyStringSchema,
    kind: z.literal('absolute')
  }),
  z.object({
    expression: nonEmptyStringSchema,
    kind: z.literal('expression')
  })
]);

export const historyRangeSchema = z.object({
  end: historyBoundarySchema,
  start: historyBoundarySchema
});

export const historyGetChatHistoryStateInputSchema = z.object({
  chatId: nonEmptyStringSchema
});

export const historyUpsertTargetInputSchema = z
  .object({
    chatId: nonEmptyStringSchema,
    end: nonEmptyStringSchema.optional(),
    preset: nonEmptyStringSchema.optional(),
    range: historyRangeSchema.optional(),
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
      message: 'history.upsertTarget requires preset, range, or start/end'
    });
  });

export const historyDeleteTargetInputSchema = z.object({
  targetId: nonEmptyStringSchema
});

export const historyRequestSyncInputSchema = z
  .object({
    chatId: nonEmptyStringSchema.optional()
  })
  .default({});

export const historySelectedChatOutputSchema = z.object({
  _model: z.literal('telegram.chat'),
  historyBeginningReached: z.boolean(),
  historyStartAt: z.string().nullable(),
  id: z.string(),
  isBot: z.boolean(),
  messageCount: z.number().int().nonnegative(),
  title: z.string(),
  type: z.string(),
  updatedAt: z.string()
});

export const historyIntervalOutputSchema = z.object({
  coveredAt: z.string().optional(),
  endAt: z.string(),
  messageCount: z.number().int().nonnegative().optional(),
  startAt: z.string()
});

export const historyTargetOutputSchema = z.object({
  chatId: z.string(),
  id: z.string(),
  projected: historyIntervalOutputSchema.optional(),
  range: historyRangeSchema,
  templateId: z.string().nullable().optional()
});

export const historyStoredTargetOutputSchema = z.object({
  chatId: z.string(),
  id: z.string(),
  range: historyRangeSchema,
  templateId: z.string().optional()
});

export const historyChatHistoryStateOutputSchema = z.object({
  chat: historySelectedChatOutputSchema.nullable(),
  coverage: z.array(historyIntervalOutputSchema),
  desired: z.array(historyIntervalOutputSchema),
  missing: z.array(historyIntervalOutputSchema),
  targets: z.array(historyTargetOutputSchema)
});

export const historyTargetMutationOutputSchema = z.object({
  deleted: z.boolean(),
  target: historyStoredTargetOutputSchema.optional(),
  upserted: z.boolean()
});

export const historyRequestSyncOutputSchema = z.object({
  requested: z.boolean()
});

export type HistoryGetChatHistoryStateInput = z.infer<typeof historyGetChatHistoryStateInputSchema>;
export type HistoryUpsertTargetInput = z.infer<typeof historyUpsertTargetInputSchema>;
export type HistoryDeleteTargetInput = z.infer<typeof historyDeleteTargetInputSchema>;
export type HistoryRequestSyncInput = z.infer<typeof historyRequestSyncInputSchema>;

export type HistoryChatHistoryStateOutput = z.infer<typeof historyChatHistoryStateOutputSchema>;
export type HistoryIntervalOutput = z.infer<typeof historyIntervalOutputSchema>;
export type HistoryTargetOutput = z.infer<typeof historyTargetOutputSchema>;
export type HistoryStoredTargetOutput = z.infer<typeof historyStoredTargetOutputSchema>;
export type HistoryTargetMutationOutput = z.infer<typeof historyTargetMutationOutputSchema>;
export type HistoryRequestSyncOutput = z.infer<typeof historyRequestSyncOutputSchema>;
