import { z } from 'zod';

import { countMessagesInIntervals } from '../history/messageCounts.js';
import { requireDate } from '../history/time.js';
import {
  isoDateTimeStringSchema,
  nonEmptyStringSchema,
  nonNegativeIntegerSchema
} from '../views/schemas.js';
import type { ProcedureResources } from './resources.js';

const inputSchema = z.object({
  chatId: nonEmptyStringSchema,
  intervals: z.array(
    z.object({
      endAt: isoDateTimeStringSchema,
      startAt: isoDateTimeStringSchema
    })
  )
});

const outputSchema = z.object({
  counts: z.array(nonNegativeIntegerSchema)
});

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

export function countMessagesInIntervalsProcedure(resources: ProcedureResources) {
  return async (input: unknown): Promise<Output> => {
    const output = await runCountMessagesInIntervals(inputSchema.parse(input), resources);
    return outputSchema.parse(output);
  };
}

async function runCountMessagesInIntervals(
  input: Input,
  resources: ProcedureResources
): Promise<Output> {
  const intervals = input.intervals.map((interval) => ({
    endAt: requireDate(interval.endAt, 'telegram.countMessagesInIntervals requires endAt'),
    startAt: requireDate(interval.startAt, 'telegram.countMessagesInIntervals requires startAt')
  }));

  return {
    counts: await countMessagesInIntervals(
      resources.database,
      intervals.map((interval) => ({
        ...interval,
        chatId: input.chatId
      }))
    )
  };
}
