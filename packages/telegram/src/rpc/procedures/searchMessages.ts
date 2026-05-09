import { query } from '@agentg/rpc/surface';
import { and, desc, eq, ilike, sql } from 'drizzle-orm';

import {
  telegramSearchMessagesInputSchema,
  telegramSearchMessagesOutputSchema
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import { telegramMessages } from '../../schema.js';
import { parseLimit, readMessageSelection, toReadMessages } from './support.js';

export const searchMessages = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramSearchMessagesInputSchema)
    .output(telegramSearchMessagesOutputSchema)
    .query(async ({ input }) => {
      const text = input.query.trim();
      const limit = parseLimit(input.limit, 20, 100);
      const textFilter = ilike(telegramMessages.text, `%${text}%`);
      const where =
        input.chatId === undefined
          ? textFilter
          : and(eq(telegramMessages.telegramChatId, input.chatId), textFilter);
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
