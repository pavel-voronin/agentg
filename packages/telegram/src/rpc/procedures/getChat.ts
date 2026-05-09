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
import { readTelegramFileRefsForOwners } from '../../telegram-file-store.js';

export const getChat = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramGetChatInputSchema)
    .output(telegramGetChatOutputSchema)
    .query(async ({ input }) => {
      const [chat] = await runtime.database
        .select({
          telegramChatId: telegramChats.telegramChatId,
          title: telegramChats.title,
          type: telegramChats.type,
          updatedAt: telegramChats.updatedAt
        })
        .from(telegramChats)
        .where(eq(telegramChats.telegramChatId, input.chatId))
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
      const files =
        chat === undefined ? [] : (filesByOwner.get(`telegram.chat:${chat.telegramChatId}`) ?? []);

      return {
        chat:
          chat === undefined
            ? null
            : {
                _model: 'telegram.chat',
                avatar: {
                  big: files.find((file) => file.slotKey === 'avatar.big') ?? null,
                  small: files.find((file) => file.slotKey === 'avatar.small') ?? null
                },
                id: chat.telegramChatId,
                title: chat.title,
                type: chat.type,
                updatedAt: chat.updatedAt.toISOString()
              }
      };
    })
);
