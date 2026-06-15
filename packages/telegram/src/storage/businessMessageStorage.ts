import { and, eq, inArray } from 'drizzle-orm';

import { telegramBusinessMessages } from '../database/schema.js';
import type { Database } from '../database/client.js';
import type { BusinessMessageState } from '../domain/models/businessMessage.js';

type BusinessMessageStorageRow = typeof telegramBusinessMessages.$inferInsert;

export async function saveBusinessMessageState(
  database: Database,
  record: BusinessMessageState
): Promise<void> {
  const row = businessMessageStorageRow(record);
  await database
    .insert(telegramBusinessMessages)
    .values(row)
    .onConflictDoUpdate({
      set: row,
      target: [
        telegramBusinessMessages.connectionId,
        telegramBusinessMessages.messageChatId,
        telegramBusinessMessages.messageId
      ]
    });
}

export async function saveNewBusinessMessageState(
  database: Database,
  record: BusinessMessageState
): Promise<boolean> {
  const row = businessMessageStorageRow(record);
  const inserted = await database
    .insert(telegramBusinessMessages)
    .values(row)
    .onConflictDoNothing({
      target: [
        telegramBusinessMessages.connectionId,
        telegramBusinessMessages.messageChatId,
        telegramBusinessMessages.messageId
      ]
    })
    .returning({
      messageId: telegramBusinessMessages.messageId
    });

  if (inserted.length > 0) {
    return true;
  }

  await saveBusinessMessageState(database, record);
  return false;
}

export async function deleteBusinessMessageStates(
  database: Database,
  input: {
    chatId: string;
    connectionId: string;
    messageIds: string[];
  }
): Promise<void> {
  await database
    .delete(telegramBusinessMessages)
    .where(
      and(
        eq(telegramBusinessMessages.connectionId, input.connectionId),
        eq(telegramBusinessMessages.messageChatId, input.chatId),
        inArray(telegramBusinessMessages.messageId, input.messageIds)
      )
    );
}

function businessMessageStorageRow(record: BusinessMessageState): BusinessMessageStorageRow {
  return record;
}
