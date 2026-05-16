import { query } from '@agentg/rpc/surface';
import { and, asc, eq, isNotNull, sql } from 'drizzle-orm';

import {
  telegramGetChatHistoryFactsInputSchema,
  telegramGetChatHistoryFactsOutputSchema
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import { telegramChats, telegramMessages } from '../../schema.js';
import {
  isListableDirectoryEntry,
  readChatSelection,
  toNullableIsoString,
  toDirectoryEntries,
  toTelegramChatStorageRow
} from './support.js';

export const getChatHistoryFacts = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramGetChatHistoryFactsInputSchema)
    .output(telegramGetChatHistoryFactsOutputSchema)
    .query(async ({ input }) => {
      const [chat] = await runtime.database
        .select(readChatSelection())
        .from(telegramChats)
        .where(eq(telegramChats.id, input.chatId))
        .limit(1);

      if (chat === undefined) {
        return {
          chat: null,
          earliestMessageDate: null,
          messageCount: 0
        };
      }

      const [entry] = await toDirectoryEntries(runtime.database, [toTelegramChatStorageRow(chat)]);
      if (entry === undefined || !isListableDirectoryEntry(entry)) {
        return {
          chat: null,
          earliestMessageDate: null,
          messageCount: 0
        };
      }

      const [earliestMessages, messageCounts] = await Promise.all([
        runtime.database
          .select({
            messageDate: telegramMessages.date
          })
          .from(telegramMessages)
          .where(and(eq(telegramMessages.chatId, input.chatId), isNotNull(telegramMessages.date)))
          .orderBy(asc(telegramMessages.date))
          .limit(1),
        runtime.database
          .select({
            count: sql<number>`count(*)::int`
          })
          .from(telegramMessages)
          .where(eq(telegramMessages.chatId, input.chatId))
      ]);

      return {
        chat: entry,
        earliestMessageDate: toNullableIsoString(earliestMessages[0]?.messageDate ?? null),
        messageCount: messageCounts[0]?.count ?? 0
      };
    })
);
