import { query } from '@agentg/rpc/surface';
import { and, asc, eq, isNotNull, sql } from 'drizzle-orm';

import {
  telegramGetChatHistoryFactsInputSchema,
  telegramGetChatHistoryFactsOutputSchema
} from '../contracts.js';
import type { TelegramRpcRuntime } from '../runtime.js';
import { rpc } from '../trpc.js';
import { telegramChats, telegramMessages } from '../../schema.js';
import { isListableDirectoryEntry, toDirectoryEntries } from './support.js';

export const getChatHistoryFacts = query((runtime: TelegramRpcRuntime) =>
  rpc
    .input(telegramGetChatHistoryFactsInputSchema)
    .output(telegramGetChatHistoryFactsOutputSchema)
    .query(async ({ input }) => {
      const [chat] = await runtime.database
        .select({
          raw: telegramChats.raw,
          telegramChatId: telegramChats.telegramChatId,
          title: telegramChats.title,
          type: telegramChats.type,
          updatedAt: telegramChats.updatedAt
        })
        .from(telegramChats)
        .where(eq(telegramChats.telegramChatId, input.chatId))
        .limit(1);

      if (chat === undefined) {
        return {
          chat: null,
          earliestMessageDate: null,
          messageCount: 0
        };
      }

      const [entry] = await toDirectoryEntries(runtime.database, [chat]);
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
            messageDate: telegramMessages.messageDate
          })
          .from(telegramMessages)
          .where(
            and(
              eq(telegramMessages.telegramChatId, input.chatId),
              isNotNull(telegramMessages.messageDate)
            )
          )
          .orderBy(asc(telegramMessages.messageDate))
          .limit(1),
        runtime.database
          .select({
            count: sql<number>`count(*)::int`
          })
          .from(telegramMessages)
          .where(eq(telegramMessages.telegramChatId, input.chatId))
      ]);

      return {
        chat: entry,
        earliestMessageDate: earliestMessages[0]?.messageDate?.toISOString() ?? null,
        messageCount: messageCounts[0]?.count ?? 0
      };
    })
);
