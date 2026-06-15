import { parseLimit } from '@agentg/framework';
import { z } from 'zod';

import { messageSchema } from '../domain/models/message.js';
import { nonEmptyStringSchema, positiveIntegerSchema } from '../domain/models/scalars.js';
import { createRepositories } from '../repositories/repositories.js';
import type { ProcedureResources } from './resources.js';

const inputSchema = z.object({
  chatId: nonEmptyStringSchema.optional(),
  limit: positiveIntegerSchema.optional(),
  query: nonEmptyStringSchema
});

const outputSchema = z.object({
  messages: z.array(messageSchema)
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
  return {
    messages: await createRepositories(resources.database).messages.search({
      chatId: input.chatId,
      limit,
      query: text
    })
  };
}
