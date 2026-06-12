import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import type { JsonObject, JsonValue } from '@agentg/framework';

import type { Database } from '../database/client.js';
import { telegramMessages } from '../database/schema.js';
import { positiveInteger, type FileSubsystemOptions } from './runtime.js';
import { recordFileSlotUpdate } from './persistence.js';

export type MessageSlotMaterializationBatchResult = {
  hasMore: boolean;
  processedCount: number;
  queueChanged: boolean;
};

type PendingMessageSlotRow = {
  chatId: string;
  content: JsonValue | null;
  messageId: string;
};

const DEFAULT_MAX_MESSAGES_PER_TICK = 25;

export async function processMessageSlotMaterializationBatch(
  options: FileSubsystemOptions,
  limit: number
): Promise<MessageSlotMaterializationBatchResult> {
  const maxMessages = positiveInteger(limit, DEFAULT_MAX_MESSAGES_PER_TICK);
  const rows = await readPendingMessageSlotRows(options.database, maxMessages);
  let queueChanged = false;
  let processedCount = 0;

  for (const row of rows) {
    const content = jsonObjectOrUndefined(row.content);
    queueChanged ||= await recordFileSlotUpdate(
      options,
      {
        message: {
          chatId: row.chatId,
          ...(content === undefined ? {} : { content }),
          messageId: row.messageId
        }
      },
      'history_fetch'
    );
    await markStoredMessageFileSlotsRecorded(options.database, {
      chatId: row.chatId,
      content: row.content,
      messageId: row.messageId,
      recordedAt: new Date()
    });
    processedCount += 1;
  }

  return {
    hasMore: rows.length === maxMessages,
    processedCount,
    queueChanged
  };
}

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

async function readPendingMessageSlotRows(
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

function jsonObjectOrUndefined(value: JsonValue | null): JsonObject | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : undefined;
}
