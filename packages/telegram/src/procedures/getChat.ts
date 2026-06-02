import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { telegramChats } from '../database/schema.js';
import { readFileRefsForOwners } from '../files/read.js';
import { readChatSelection, toChatStorageRow } from '../views/chat.js';
import { nonEmptyStringSchema, readChatSchema, type FileRef } from '../views/schemas.js';
import type { ProcedureResources } from './resources.js';

const inputSchema = z.object({
  chatId: nonEmptyStringSchema
});

const outputSchema = z.object({
  chat: readChatSchema.nullable()
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
  const [chat] = await resources.database
    .select(readChatSelection())
    .from(telegramChats)
    .where(eq(telegramChats.id, input.chatId))
    .limit(1);
  const filesByOwner: Map<string, FileRef[]> =
    chat === undefined
      ? new Map<string, FileRef[]>()
      : await readFileRefsForOwners(resources.database, [
          {
            ownerId: chat.telegramChatId,
            ownerModel: 'telegram.chat'
          }
        ]);
  const chatRow = chat === undefined ? undefined : toChatStorageRow(chat);
  const files =
    chatRow === undefined
      ? []
      : (filesByOwner.get(`telegram.chat:${chatRow.telegramChatId}`) ?? []);

  return {
    chat:
      chatRow === undefined
        ? null
        : {
            _model: 'telegram.chat',
            avatar: {
              big: files.find((file) => file.slotKey === 'avatar.big') ?? null,
              small: files.find((file) => file.slotKey === 'avatar.small') ?? null
            },
            id: chatRow.telegramChatId,
            title: chatRow.title,
            type: chatRow.type,
            updatedAt: new Date(0).toISOString()
          }
  };
}
