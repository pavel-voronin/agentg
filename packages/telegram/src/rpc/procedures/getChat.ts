import { query } from '@agentg/rpc/domain';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import type { TelegramRpcRuntime } from '../setup.js';
import { telegramChats } from '../../database/schema.js';
import { readTelegramFileRefsForOwners } from '../../files/read.js';
import type { TelegramProcedureContext } from '../../procedure-runtime/context.js';
import { readChatSelection, toTelegramChatStorageRow } from '../../read-model/chat.js';
import {
  nonEmptyStringSchema,
  telegramReadChatSchema,
  type TelegramFileRef
} from '../../read-model/api.js';

export const telegramGetChatInputSchema = z.object({
  chatId: nonEmptyStringSchema
});

export const telegramGetChatOutputSchema = z.object({
  chat: telegramReadChatSchema.nullable()
});

export type TelegramGetChatInput = z.infer<typeof telegramGetChatInputSchema>;
export type TelegramGetChatOutput = z.infer<typeof telegramGetChatOutputSchema>;

export const getChat = query((runtime: TelegramRpcRuntime, procedure) =>
  procedure
    .input(telegramGetChatInputSchema)
    .output(telegramGetChatOutputSchema)
    .query(({ input }) => runGetChat(runtime, input))
);

async function runGetChat(
  { database }: TelegramProcedureContext,
  input: TelegramGetChatInput
): Promise<TelegramGetChatOutput> {
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
