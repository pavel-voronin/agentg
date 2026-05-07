import { query } from '@agentg/rpc/surface';
import { eq } from 'drizzle-orm';

import { telegramGetChatInputSchema, telegramGetChatOutputSchema } from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import { telegramChats } from '../../schema.js';

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

      return {
        chat:
          chat === undefined
            ? null
            : {
                _model: 'telegram.chat',
                id: chat.telegramChatId,
                title: chat.title,
                type: chat.type,
                updatedAt: chat.updatedAt.toISOString()
              }
      };
    })
);
