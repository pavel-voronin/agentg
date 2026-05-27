import { eq } from 'drizzle-orm';

import type {
  TelegramFileRef,
  TelegramGetChatInput,
  TelegramGetChatOutput
} from '../rpc/contracts.js';
import { telegramChats } from '../schema.js';
import { readTelegramFileRefsForOwners } from '../telegramFileRead.js';
import type { TelegramProcedureHandlerContext } from '../telegram-procedure-runtime/context.js';
import { readChatSelection, toTelegramChatStorageRow } from '../telegram-read-model/chat.js';

export async function handleGetChat(
  { database }: TelegramProcedureHandlerContext,
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
