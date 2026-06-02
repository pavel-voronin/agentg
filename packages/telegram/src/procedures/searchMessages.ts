import { parseLimit } from '@agentg/framework';
import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { z } from 'zod';

import { telegramMessages } from '../database/schema.js';
import { messageTextExpression, readMessageSelection, toReadMessages } from '../views/message.js';
import {
  nonEmptyStringSchema,
  positiveIntegerSchema,
  readMessageSchema
} from '../views/schemas.js';
import type { ProcedureResources } from './resources.js';

const inputSchema = z.object({
  chatId: nonEmptyStringSchema.optional(),
  limit: positiveIntegerSchema.optional(),
  query: nonEmptyStringSchema
});

const outputSchema = z.object({
  messages: z.array(readMessageSchema)
});

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

export function searchMessagesProcedure(resources: ProcedureResources) {
  return async (input: unknown): Promise<Output> => {
    const output = await runSearchMessages(inputSchema.parse(input), resources);
    return outputSchema.parse(output);
  };
}

async function runSearchMessages(input: Input, resources: ProcedureResources): Promise<Output> {
  const text = input.query.trim();
  const limit = parseLimit(input.limit, 20, 100);
  const textFilter = ilike(sql<string>`coalesce(${messageTextExpression()}, '')`, `%${text}%`);
  const where =
    input.chatId === undefined
      ? textFilter
      : and(eq(telegramMessages.chatId, input.chatId), textFilter);
  const messages = await resources.database
    .select(readMessageSelection())
    .from(telegramMessages)
    .where(where)
    .orderBy(desc(telegramMessages.date), sql`${telegramMessages.id}::bigint desc`)
    .limit(limit);

  return {
    messages: await toReadMessages(resources.database, messages)
  };
}
