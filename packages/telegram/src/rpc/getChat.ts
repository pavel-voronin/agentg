import { query } from '@agentg/framework';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { useDatabase } from '../database/subsystem.js';
import { telegramChats } from '../database/schema.js';
import { readTelegramFileRefsForOwners } from '../files/read.js';
import { readChatSelection, toTelegramChatStorageRow } from '../read-model/chat.js';
import {
  nonEmptyStringSchema,
  telegramReadChatSchema,
  type TelegramFileRef
} from '../read-model/api.js';

export const telegramGetChatInputSchema = z.object({
  chatId: nonEmptyStringSchema
});

export const telegramGetChatOutputSchema = z.object({
  chat: telegramReadChatSchema.nullable()
});

export type TelegramGetChatInput = z.infer<typeof telegramGetChatInputSchema>;
export type TelegramGetChatOutput = z.infer<typeof telegramGetChatOutputSchema>;

export const getChat = query((procedure) =>
  procedure
    .input(telegramGetChatInputSchema)
    .output(telegramGetChatOutputSchema)
    .query(({ input }) => runGetChat(input))
);

async function runGetChat(input: TelegramGetChatInput): Promise<TelegramGetChatOutput> {
  const database = useDatabase();
  const [chat] = await database
    .select(readChatSelection())
    .from(telegramChats)
    .where(eq(telegramChats.id, input.chatId))
    .limit(1);
  const filesByOwner: Map<string, TelegramFileRef[]> =
    chat === undefined
      ? new Map<string, TelegramFileRef[]>()
      : await readTelegramFileRefsForOwners(database, [
          {
            ownerId: chat.telegramChatId,
            ownerModel: 'telegram.chat'
          }
        ]);
  const chatRow = chat === undefined ? undefined : toTelegramChatStorageRow(chat);
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
