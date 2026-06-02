import { z } from 'zod';

import { fetchHistoryPage } from '../history/fetch.js';
import { priorities } from '../tdlib/priority.js';
import { historyIntervalSchema, isoDateTimeStringSchema } from '../views/schemas.js';
import type { ProcedureResources } from './resources.js';

const inputSchema = z.object({
  chatId: z.string().min(1),
  cursorMessageId: z.number().int().optional(),
  endAt: isoDateTimeStringSchema,
  limit: z.number().int().positive(),
  startAt: isoDateTimeStringSchema
});

const outputSchema = z.discriminatedUnion('kind', [
  z.object({
    coveredInterval: historyIntervalSchema.optional(),
    fetchedMessages: z.literal(0),
    kind: z.literal('no_messages_before_end'),
    storedMessages: z.literal(0)
  }),
  z.object({
    anchorMessageDate: isoDateTimeStringSchema,
    coveredInterval: historyIntervalSchema.optional(),
    fetchedMessages: z.literal(0),
    kind: z.literal('anchor_before_start'),
    storedMessages: z.literal(0)
  }),
  z.object({
    coveredInterval: historyIntervalSchema.optional(),
    crossedStart: z.boolean(),
    fetchedMessages: z.number().int().nonnegative(),
    kind: z.literal('page'),
    nextCursorMessageId: z.number().int().optional(),
    oldestFetchedMessageDate: isoDateTimeStringSchema.optional(),
    reachedBeginning: z.boolean(),
    storedMessages: z.number().int().nonnegative()
  })
]);

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

export function fetchPageProcedure(resources: ProcedureResources) {
  return async (input: unknown): Promise<Output> => {
    const output = await runFetchPage(inputSchema.parse(input), resources);
    return outputSchema.parse(output);
  };
}

function runFetchPage(input: Input, resources: ProcedureResources): Promise<Output> {
  return fetchHistoryPage(input, resources, { priority: priorities.low });
}
