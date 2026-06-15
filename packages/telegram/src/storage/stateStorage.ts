import { eq } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import {
  telegramChatActiveStories,
  telegramChatBoosts,
  telegramChatRevenueAmounts,
  telegramCloseBirthdayUsers,
  telegramFileGenerationRequests,
  telegramTextCompositionStyles
} from '../database/schema.js';
import type {
  ChatActiveStories,
  ChatBoost,
  ChatRevenueAmount,
  ContactCloseBirthday,
  FileGenerationRequest,
  TextCompositionStyle
} from '../domain/models/state.js';

export async function replaceContactCloseBirthdays(
  database: Database,
  records: readonly ContactCloseBirthday[]
): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction.delete(telegramCloseBirthdayUsers);
    if (records.length > 0) {
      await transaction.insert(telegramCloseBirthdayUsers).values([...records]);
    }
  });
}

export async function replaceTextCompositionStyles(
  database: Database,
  records: readonly TextCompositionStyle[]
): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction.delete(telegramTextCompositionStyles);
    if (records.length > 0) {
      await transaction.insert(telegramTextCompositionStyles).values([...records]);
    }
  });
}

export async function saveChatRevenueAmount(
  database: Database,
  record: ChatRevenueAmount
): Promise<void> {
  await database.insert(telegramChatRevenueAmounts).values(record).onConflictDoUpdate({
    set: record,
    target: telegramChatRevenueAmounts.chatId
  });
}

export async function saveFileGenerationRequest(
  database: Database,
  record: FileGenerationRequest
): Promise<void> {
  await database.insert(telegramFileGenerationRequests).values(record).onConflictDoUpdate({
    set: record,
    target: telegramFileGenerationRequests.generationId
  });
}

export async function deleteFileGenerationRequest(
  database: Database,
  generationId: string
): Promise<void> {
  await database
    .delete(telegramFileGenerationRequests)
    .where(eq(telegramFileGenerationRequests.generationId, generationId));
}

export async function saveChatBoost(database: Database, record: ChatBoost): Promise<void> {
  await database
    .insert(telegramChatBoosts)
    .values(record)
    .onConflictDoUpdate({
      set: record,
      target: [telegramChatBoosts.chatId, telegramChatBoosts.id]
    });
}

export async function saveChatActiveStories(
  database: Database,
  record: ChatActiveStories
): Promise<void> {
  await database.insert(telegramChatActiveStories).values(record).onConflictDoUpdate({
    set: record,
    target: telegramChatActiveStories.chatId
  });
}
