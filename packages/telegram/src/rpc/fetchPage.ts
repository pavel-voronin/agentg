import { mutation } from '@agentg/framework/domain';
import { z } from 'zod';

import type { TelegramRpcRuntime } from '../domain.js';
import { fetchTelegramHistoryPage } from '../history/fetch.js';
import { telegramTdlibPriorities } from '../tdlib/priority.js';
import { isoDateTimeStringSchema, telegramHistoryIntervalSchema } from '../read-model/api.js';

export const telegramHistoryFetchPageInputSchema = z.object({
  chatId: z.string().min(1),
  cursorMessageId: z.number().int().optional(),
  endAt: isoDateTimeStringSchema,
  limit: z.number().int().positive(),
  startAt: isoDateTimeStringSchema
});

export const telegramHistoryFetchPageResultSchema = z.discriminatedUnion('kind', [
  z.object({
    coveredInterval: telegramHistoryIntervalSchema.optional(),
    fetchedMessages: z.literal(0),
    kind: z.literal('no_messages_before_end'),
    storedMessages: z.literal(0)
  }),
  z.object({
    anchorMessageDate: isoDateTimeStringSchema,
    coveredInterval: telegramHistoryIntervalSchema.optional(),
    fetchedMessages: z.literal(0),
    kind: z.literal('anchor_before_start'),
    storedMessages: z.literal(0)
  }),
  z.object({
    coveredInterval: telegramHistoryIntervalSchema.optional(),
    crossedStart: z.boolean(),
    fetchedMessages: z.number().int().nonnegative(),
    kind: z.literal('page'),
    nextCursorMessageId: z.number().int().optional(),
    oldestFetchedMessageDate: isoDateTimeStringSchema.optional(),
    reachedBeginning: z.boolean(),
    storedMessages: z.number().int().nonnegative()
  })
]);

export type TelegramHistoryFetchPageRequest = z.infer<typeof telegramHistoryFetchPageInputSchema>;
export type TelegramHistoryFetchPageResult = z.infer<typeof telegramHistoryFetchPageResultSchema>;

export const fetchPage = mutation((runtime: TelegramRpcRuntime, procedure) =>
  procedure
    .input(telegramHistoryFetchPageInputSchema)
    .output(telegramHistoryFetchPageResultSchema)
    .mutation(({ input }) => runFetchPage(runtime, input))
);

function runFetchPage(
  context: TelegramRpcRuntime,
  input: TelegramHistoryFetchPageRequest
): Promise<TelegramHistoryFetchPageResult> {
  return fetchTelegramHistoryPage(context, input, { priority: telegramTdlibPriorities.low });
}
