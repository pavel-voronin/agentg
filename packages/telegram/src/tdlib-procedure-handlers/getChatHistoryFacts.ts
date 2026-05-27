import { and, asc, eq, isNotNull, sql } from 'drizzle-orm';

import type {
  TelegramGetChatHistoryFactsInput,
  TelegramGetChatHistoryFactsOutput
} from '../rpc/contracts.js';
import { telegramChats, telegramMessages } from '../schema.js';
import type { TelegramProcedureHandlerContext } from '../telegram-procedure-runtime/context.js';
import { readChatSelection, toTelegramChatStorageRow } from '../telegram-read-model/chat.js';
import { isListableDirectoryEntry, toDirectoryEntries } from '../telegram-read-model/directory.js';
import { toNullableIsoString } from '../telegram-read-model/dates.js';

export async function handleGetChatHistoryFacts(
  { database }: TelegramProcedureHandlerContext,
  input: TelegramGetChatHistoryFactsInput
): Promise<TelegramGetChatHistoryFactsOutput> {
  const [chat] = await database
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

  const [entry] = await toDirectoryEntries(database, [toTelegramChatStorageRow(chat)]);
  if (entry === undefined || !isListableDirectoryEntry(entry)) {
    return {
      chat: null,
      earliestMessageDate: null,
      messageCount: 0
    };
  }

  const [earliestMessages, messageCounts] = await Promise.all([
    database
      .select({
        messageDate: telegramMessages.date
      })
      .from(telegramMessages)
      .where(and(eq(telegramMessages.chatId, input.chatId), isNotNull(telegramMessages.date)))
      .orderBy(asc(telegramMessages.date))
      .limit(1),
    database
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
}
