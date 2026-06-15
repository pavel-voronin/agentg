import { z } from 'zod';

import { chatSchema } from '../domain/models/chat.js';
import { nonEmptyStringSchema } from '../domain/models/scalars.js';
import { createRepositories } from '../repositories/repositories.js';
import type { ProcedureResources } from './resources.js';

const inputSchema = z.object({
  chatId: nonEmptyStringSchema
});

const outputSchema = z.object({
  chat: chatSchema.nullable()
});

type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

export function getChatProcedure(resources: ProcedureResources) {
  return async (input: unknown): Promise<Output> => {
    const output = await runGetChat(inputSchema.parse(input), resources);
    return outputSchema.parse(output);
  };
}

async function runGetChat(input: Input, resources: ProcedureResources): Promise<Output> {
  return {
    chat: await createRepositories(resources.database).chats.read(input.chatId)
  };
}
