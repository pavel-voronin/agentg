import { query } from '@agentg/rpc/surface';
import { desc, eq, sql } from 'drizzle-orm';

import {
  telegramListRecentMessagesInputSchema,
  telegramListRecentMessagesOutputSchema
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import { telegramMessages } from '../../schema.js';
import { andSql, parseLimit, readMessageSelection, toReadMessages } from './support.js';

export const listRecentMessages = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramListRecentMessagesInputSchema)
    .output(telegramListRecentMessagesOutputSchema)
    .query(async ({ input }) => {
      const limit = parseLimit(input.limit, 50, 200);
      const where = andSql(
        input.chatId === undefined ? undefined : eq(telegramMessages.telegramChatId, input.chatId),
        input.beforeMessageId === undefined
          ? undefined
          : sql`${telegramMessages.telegramMessageId}::bigint < ${input.beforeMessageId}::bigint`
      );
      const messages = await runtime.database
        .select(readMessageSelection())
        .from(telegramMessages)
        .where(where)
        .orderBy(
          desc(telegramMessages.messageDate),
          sql`${telegramMessages.telegramMessageId}::bigint desc`
        )
        .limit(limit);

      return {
        messages: await toReadMessages(runtime.database, messages)
      };
    })
);
