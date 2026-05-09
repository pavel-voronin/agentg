import { query } from '@agentg/rpc/surface';
import { and, eq } from 'drizzle-orm';

import { telegramGetMessageInputSchema, telegramGetMessageOutputSchema } from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import { telegramMessages } from '../../schema.js';
import { readMessageSelection, toReadMessages } from './support.js';

export const getMessage = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramGetMessageInputSchema)
    .output(telegramGetMessageOutputSchema)
    .query(async ({ input }) => {
      const [message] = await runtime.database
        .select(readMessageSelection())
        .from(telegramMessages)
        .where(
          and(
            eq(telegramMessages.telegramChatId, input.chatId),
            eq(telegramMessages.telegramMessageId, input.messageId)
          )
        )
        .limit(1);
      const [readMessage] = await toReadMessages(
        runtime.database,
        message === undefined ? [] : [message]
      );

      return {
        message: readMessage ?? null
      };
    })
);
