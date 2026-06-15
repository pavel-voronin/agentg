import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import type { JsonValue } from '@agentg/framework';

import type { Database } from '../database/client.js';
import { telegramMessages } from '../database/schema.js';

export type PendingMessageSlotRow = {
  chatId: string;
  content: JsonValue | null;
  messageId: string;
};

export async function markStoredMessageFileSlotsRecorded(
  database: Database,
  input: {
    chatId: string;
    content: JsonValue | null;
    messageId: string;
    recordedAt?: Date | undefined;
  }
): Promise<void> {
  await database
    .update(telegramMessages)
    .set({
      fileSlotsRecordedAt: input.recordedAt ?? sql`now()`
    })
    .where(
      and(
        eq(telegramMessages.chatId, input.chatId),
        eq(telegramMessages.id, input.messageId),
        sql`${telegramMessages.content} is not distinct from ${input.content}`
      )
    );
}

export function readPendingMessageSlotRows(
  database: Database,
  limit: number
): Promise<PendingMessageSlotRow[]> {
  return database
    .select({
      chatId: telegramMessages.chatId,
      content: telegramMessages.content,
      messageId: telegramMessages.id
    })
    .from(telegramMessages)
    .where(isNull(telegramMessages.fileSlotsRecordedAt))
    .orderBy(desc(telegramMessages.date), sql`${telegramMessages.id}::bigint desc`)
    .limit(limit);
}
