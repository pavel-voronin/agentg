import { query } from '@agentg/rpc/surface';
import { eq } from 'drizzle-orm';

import {
  telegramGetChatInputSchema,
  telegramGetChatOutputSchema,
  type TelegramFileRef
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import { telegramChats } from '../../schema.js';
import { readTelegramFileRefsForOwners } from '../../telegram-file-read.js';
import { readChatSelection, toTelegramChatStorageRow } from './support.js';

export const getChat = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramGetChatInputSchema)
    .output(telegramGetChatOutputSchema)
    .query(async ({ input }) => {
      const [chat] = await runtime.database
        .select(readChatSelection())
        .from(telegramChats)
        .where(eq(telegramChats.id, input.chatId))
        .limit(1);
      const filesByOwner: Map<string, TelegramFileRef[]> =
        chat === undefined
          ? new Map<string, TelegramFileRef[]>()
          : await readTelegramFileRefsForOwners(runtime.database, [
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
    })
);
