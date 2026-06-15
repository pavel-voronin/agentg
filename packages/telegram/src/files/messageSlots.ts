import type { JsonObject, JsonValue } from '@agentg/framework';

import {
  markStoredMessageFileSlotsRecorded,
  readPendingMessageSlotRows
} from '../storage/messageSlotStorage.js';
import { positiveInteger, type FileSubsystemOptions } from './runtime.js';
import { recordFileSlotUpdate } from './persistence.js';

export type MessageSlotMaterializationBatchResult = {
  hasMore: boolean;
  processedCount: number;
  queueChanged: boolean;
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

function jsonObjectOrUndefined(value: JsonValue | null): JsonObject | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : undefined;
}
