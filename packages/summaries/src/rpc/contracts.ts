import { z } from 'zod';

const nonEmptyStringSchema = z.string().trim().min(1);

export const summarySourceReferenceSchema = z.object({
  messageDate: z.iso.datetime().nullable(),
  messageId: nonEmptyStringSchema
});

export const summaryResultSchema = z.object({
  chatId: nonEmptyStringSchema,
  createdAt: z.iso.datetime(),
  id: z.number().int().nonnegative(),
  runId: nonEmptyStringSchema,
  sourceReferences: z.array(summarySourceReferenceSchema),
  summary: z.string(),
  updatedAt: z.iso.datetime()
});

export const summaryRunSchema = z.object({
  chatId: nonEmptyStringSchema,
  completedAt: z.iso.datetime().nullable(),
  error: z.record(z.string(), z.unknown()).nullable(),
  failedAt: z.iso.datetime().nullable(),
  id: nonEmptyStringSchema,
  reason: z.string().nullable(),
  requestedAt: z.iso.datetime(),
  startedAt: z.iso.datetime().nullable(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  updatedAt: z.iso.datetime()
});

export const summaryInvalidationSchema = z.object({
  chatId: nonEmptyStringSchema,
  eventId: z.string().nullable(),
  invalidatedAt: z.iso.datetime(),
  reason: nonEmptyStringSchema,
  updatedAt: z.iso.datetime()
});

export const summariesRequestSummaryInputSchema = z.object({
  chatId: nonEmptyStringSchema,
  reason: z.string().trim().min(1).optional(),
  sourceMessages: z.array(summarySourceReferenceSchema).default([])
});

export const summariesRequestSummaryOutputSchema = z.object({
  run: summaryRunSchema,
  summary: summaryResultSchema
});

export const summariesReadChatSummaryInputSchema = z.object({
  chatId: nonEmptyStringSchema
});

export const summariesReadChatSummaryOutputSchema = z.object({
  invalidation: summaryInvalidationSchema.nullable(),
  summary: summaryResultSchema.nullable()
});

export const summariesReadSummaryRunInputSchema = z.object({
  runId: nonEmptyStringSchema
});

export const summariesReadSummaryRunOutputSchema = z.object({
  run: summaryRunSchema.nullable()
});

export const summariesChatSummaryInputSchema = z
  .object({
    _model: z.literal('telegram.chat'),
    id: nonEmptyStringSchema
  })
  .catchall(z.unknown());

export const summariesChatSummaryOutputSchema = z.object({
  invalidation: summaryInvalidationSchema.nullable(),
  stale: z.boolean(),
  summary: summaryResultSchema.nullable()
});

export type SummariesRequestSummaryInput = z.infer<typeof summariesRequestSummaryInputSchema>;
export type SummariesReadChatSummaryInput = z.infer<typeof summariesReadChatSummaryInputSchema>;
export type SummariesReadSummaryRunInput = z.infer<typeof summariesReadSummaryRunInputSchema>;
export type SummariesChatSummaryInput = z.infer<typeof summariesChatSummaryInputSchema>;
