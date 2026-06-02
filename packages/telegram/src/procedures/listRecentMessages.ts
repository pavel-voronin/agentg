import { parseLimit } from '@agentg/framework';
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { telegramMessages } from '../database/schema.js';
import { readMessageSelection, toReadMessages } from '../views/message.js';
import {
  nonEmptyStringSchema,
  positiveIntegerSchema,
  readMessageSchema
} from '../views/schemas.js';
import { andSql } from '../views/sql.js';
import type { ProcedureResources } from './resources.js';

const inputSchema = z
  .object({
    beforeMessageId: nonEmptyStringSchema.regex(/^[0-9]+$/).optional(),
    chatId: nonEmptyStringSchema.optional(),
    limit: positiveIntegerSchema.optional()
  })
  .default({});

const outputSchema = z.object({
  messages: z.array(readMessageSchema)
});

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

export function listRecentMessagesProcedure(resources: ProcedureResources) {
  return async (input: unknown): Promise<Output> => {
    const output = await runListRecentMessages(inputSchema.parse(input), resources);
    return outputSchema.parse(output);
  };
}

async function runListRecentMessages(input: Input, resources: ProcedureResources): Promise<Output> {
  const limit = parseLimit(input.limit, 50, 200);
  const where = andSql(
    input.chatId === undefined ? undefined : eq(telegramMessages.chatId, input.chatId),
    input.beforeMessageId === undefined
      ? undefined
      : sql`${telegramMessages.id}::bigint < ${input.beforeMessageId}::bigint`
  );
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
