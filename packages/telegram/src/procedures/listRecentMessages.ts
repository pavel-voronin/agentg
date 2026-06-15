import { parseLimit } from '@agentg/framework';
import { z } from 'zod';

import { messageSchema } from '../domain/models/message.js';
import { nonEmptyStringSchema, positiveIntegerSchema } from '../domain/models/scalars.js';
import { createRepositories } from '../repositories/repositories.js';
import type { ProcedureResources } from './resources.js';

const inputSchema = z
  .object({
    beforeMessageId: nonEmptyStringSchema.regex(/^[0-9]+$/).optional(),
    chatId: nonEmptyStringSchema.optional(),
    limit: positiveIntegerSchema.optional()
  })
  .default({});

const outputSchema = z.object({
  messages: z.array(messageSchema)
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
  return {
    messages: await createRepositories(resources.database).messages.listRecent({
      beforeMessageId: input.beforeMessageId,
      chatId: input.chatId,
      limit
    })
  };
}
