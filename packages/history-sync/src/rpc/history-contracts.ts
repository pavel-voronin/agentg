import { z } from 'zod';

const nonEmptyStringSchema = z.string().trim().min(1);
const nonNegativeIntegerSchema = z.number().int().nonnegative();
const positiveIntegerSchema = z.number().int().positive();

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

export const historyGetOverviewInputSchema = z.void();

export const historyListChatsInputSchema = z
  .object({
    folderId: nonNegativeIntegerSchema.optional(),
    limit: positiveIntegerSchema.optional(),
    list: z.enum(['archive', 'folder', 'main']).optional(),
    query: nonEmptyStringSchema.optional(),
    type: nonEmptyStringSchema.optional()
  })
  .default({})
  .superRefine((value, context) => {
    if (value.list === 'folder' && value.folderId === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'history.listChats folder list requires folderId',
        path: ['folderId']
      });
    }
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

export const historyListJobsInputSchema = z
  .object({
    limit: positiveIntegerSchema.optional(),
    status: nonEmptyStringSchema.optional()
  })
  .default({});

export const historyActiveJobOutputSchema = z.object({
  chatId: z.string(),
  endAt: z.string(),
  startAt: z.string(),
  status: z.string()
});

export const historyOverviewOutputSchema = z.object({
  activeJob: historyActiveJobOutputSchema.nullable(),
  chats: nonNegativeIntegerSchema,
  coverageIntervals: nonNegativeIntegerSchema,
  pendingJobs: nonNegativeIntegerSchema,
  runningJobs: nonNegativeIntegerSchema,
  targets: nonNegativeIntegerSchema,
  templates: nonNegativeIntegerSchema
});

export const historyChatOutputSchema = z.object({
  coverageIntervals: nonNegativeIntegerSchema,
  coverageNewestAt: z.string().nullable(),
  coverageOldestAt: z.string().nullable(),
  id: z.string(),
  isBot: z.boolean(),
  pendingJobs: nonNegativeIntegerSchema,
  runningJobs: nonNegativeIntegerSchema,
  targets: nonNegativeIntegerSchema,
  title: z.string(),
  type: z.string(),
  updatedAt: z.string()
});

export const historyChatFolderOutputSchema = z.object({
  count: nonNegativeIntegerSchema,
  iconName: z.string().nullable(),
  id: nonNegativeIntegerSchema,
  position: nonNegativeIntegerSchema,
  title: z.string()
});

export const historyChatNavigationOutputSchema = z.object({
  archiveCount: nonNegativeIntegerSchema,
  folders: z.array(historyChatFolderOutputSchema),
  mainCount: nonNegativeIntegerSchema
});

export const historyChatTypeCountOutputSchema = z.object({
  count: nonNegativeIntegerSchema,
  type: z.string()
});

export const historyListChatsOutputSchema = z.object({
  chats: z.array(historyChatOutputSchema),
  navigation: historyChatNavigationOutputSchema,
  types: z.array(historyChatTypeCountOutputSchema)
});

export const historySelectedChatOutputSchema = z.object({
  historyBeginningReached: z.boolean(),
  historyStartAt: z.string().nullable(),
  id: z.string(),
  isBot: z.boolean(),
  messageCount: nonNegativeIntegerSchema,
  title: z.string(),
  type: z.string(),
  updatedAt: z.string()
});

export const historyIntervalOutputSchema = z.object({
  endAt: z.string(),
  messageCount: nonNegativeIntegerSchema.optional(),
  startAt: z.string()
});

export const historyJobOutputSchema = z.object({
  cursor: z.unknown().optional(),
  endAt: z.string(),
  id: z.string(),
  startAt: z.string(),
  status: z.string(),
  telegramChatId: z.string().optional(),
  updatedAt: z.string()
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
  jobs: z.array(historyJobOutputSchema),
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

export const historyListJobsOutputSchema = z.object({
  jobs: z.array(historyJobOutputSchema)
});

export type HistoryGetOverviewInput = z.infer<typeof historyGetOverviewInputSchema>;
export type HistoryListChatsInput = z.infer<typeof historyListChatsInputSchema>;
export type HistoryGetChatHistoryStateInput = z.infer<typeof historyGetChatHistoryStateInputSchema>;
export type HistoryUpsertTargetInput = z.infer<typeof historyUpsertTargetInputSchema>;
export type HistoryDeleteTargetInput = z.infer<typeof historyDeleteTargetInputSchema>;
export type HistoryRequestSyncInput = z.infer<typeof historyRequestSyncInputSchema>;
export type HistoryListJobsInput = z.infer<typeof historyListJobsInputSchema>;

export type HistoryOverviewOutput = z.infer<typeof historyOverviewOutputSchema>;
export type HistoryListChatsOutput = z.infer<typeof historyListChatsOutputSchema>;
export type HistoryChatHistoryStateOutput = z.infer<typeof historyChatHistoryStateOutputSchema>;
export type HistoryIntervalOutput = z.infer<typeof historyIntervalOutputSchema>;
export type HistoryJobOutput = z.infer<typeof historyJobOutputSchema>;
export type HistoryTargetOutput = z.infer<typeof historyTargetOutputSchema>;
export type HistoryStoredTargetOutput = z.infer<typeof historyStoredTargetOutputSchema>;
export type HistoryTargetMutationOutput = z.infer<typeof historyTargetMutationOutputSchema>;
export type HistoryRequestSyncOutput = z.infer<typeof historyRequestSyncOutputSchema>;
export type HistoryListJobsOutput = z.infer<typeof historyListJobsOutputSchema>;
