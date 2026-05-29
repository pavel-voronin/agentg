import { query } from '@agentg/framework/domain';
import { z } from 'zod';

import { useDatabase } from '../../../database/subsystem.js';
import { and, eq } from 'drizzle-orm';
import { telegramMessages } from '../../../database/schema.js';
import { readMessageSelection, toReadMessages } from '../../../read-model/message.js';
import { nonEmptyStringSchema, telegramReadMessageSchema } from '../../../read-model/api.js';

export const messageLookupInputSchema = z.object({
  chatId: nonEmptyStringSchema,
  messageId: nonEmptyStringSchema
});

export const messageLookupOutputSchema = z.object({
  message: telegramReadMessageSchema.nullable()
});

export type MessageLookupInput = z.infer<typeof messageLookupInputSchema>;
export type MessageLookupOutput = z.infer<typeof messageLookupOutputSchema>;

export const message = query((procedure) =>
  procedure
    .input(messageLookupInputSchema)
    .output(messageLookupOutputSchema)
    .query(({ input }) => runMessage(input))
);

async function runMessage(input: MessageLookupInput): Promise<MessageLookupOutput> {
  const database = useDatabase();
  const [message] = await database
    .select(readMessageSelection())
    .from(telegramMessages)
    .where(and(eq(telegramMessages.chatId, input.chatId), eq(telegramMessages.id, input.messageId)))
    .limit(1);
  const [readMessage] = await toReadMessages(database, message === undefined ? [] : [message]);

  return {
    message: readMessage ?? null
  };
}
