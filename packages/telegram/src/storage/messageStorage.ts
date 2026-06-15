import { and, eq, getTableColumns, inArray, sql, type SQL } from 'drizzle-orm';

import type { JsonObject, JsonValue } from '@agentg/framework';

import type { Database } from '../database/client.js';
import {
  telegramActiveLiveLocationMessages,
  telegramFileSlots,
  telegramMessages
} from '../database/schema.js';
import {
  messageReactionStateWithSummaries,
  type MessageReactionSummary
} from '../domain/models/messageReactionState.js';
import type { MessageState, MessagePatch } from '../domain/models/messageState.js';
import { MESSAGE_MODEL, messageModelId } from '../model/refs.js';

export type SaveMessageConflict = 'ignore' | 'update';
export type MessageStorageRow = typeof telegramMessages.$inferInsert;
type MessageStorageInsertKey = keyof MessageStorageRow;

const MESSAGE_UPSERT_COLUMNS = [
  'authorSignature',
  'autoDeleteIn',
  'canBeSaved',
  'containsUnreadMention',
  'content',
  'date',
  'editDate',
  'effectId',
  'factCheck',
  'forwardInfo',
  'guestBotCallerId',
  'hasTimestampedMedia',
  'importInfo',
  'interactionInfo',
  'isChannelPost',
  'isFromOffline',
  'isOutgoing',
  'isPaidStarSuggestedPost',
  'isPaidTonSuggestedPost',
  'isPinned',
  'mediaAlbumId',
  'paidMessageStarCount',
  'reactions',
  'replyMarkup',
  'replyTo',
  'restrictionInfo',
  'schedulingState',
  'selfDestructIn',
  'selfDestructType',
  'senderBoostCount',
  'senderBusinessBotUserId',
  'senderId',
  'senderTag',
  'sendingState',
  'suggestedPostInfo',
  'summaryLanguageCode',
  'topicId',
  'unreadReactions',
  'viaBotUserId'
] as const satisfies readonly MessageStorageInsertKey[];

export async function saveMessageState(
  database: Database,
  message: MessageState,
  conflict: SaveMessageConflict = 'update'
): Promise<boolean> {
  const insert = database.insert(telegramMessages).values(messageStorageState(message));
  const stored =
    conflict === 'ignore'
      ? await insert
          .onConflictDoNothing({
            target: [telegramMessages.chatId, telegramMessages.id]
          })
          .returning({
            telegramMessageId: telegramMessages.id
          })
      : await insert
          .onConflictDoUpdate({
            set: messageUpsertSet(),
            target: [telegramMessages.chatId, telegramMessages.id]
          })
          .returning({
            telegramMessageId: telegramMessages.id
          });

  return stored.length > 0;
}

export async function saveMessageStates(
  database: Database,
  messages: readonly MessageState[],
  conflict: SaveMessageConflict = 'update'
): Promise<number> {
  const rows = uniqueMessageStorageStates(messages);
  if (rows.length === 0) {
    return 0;
  }

  const insert = database.insert(telegramMessages).values(rows);
  const stored =
    conflict === 'ignore'
      ? await insert
          .onConflictDoNothing({
            target: [telegramMessages.chatId, telegramMessages.id]
          })
          .returning({
            telegramMessageId: telegramMessages.id
          })
      : await insert
          .onConflictDoUpdate({
            set: messageUpsertSet(),
            target: [telegramMessages.chatId, telegramMessages.id]
          })
          .returning({
            telegramMessageId: telegramMessages.id
          });

  return stored.length;
}

export async function upsertMessagePatch(
  database: Database,
  fragment: MessagePatch
): Promise<void> {
  const row = messageStorageStateFragment(fragment);
  await database
    .insert(telegramMessages)
    .values(row)
    .onConflictDoUpdate({
      set: messagePatchUpdateSet(row),
      target: [telegramMessages.chatId, telegramMessages.id]
    });
}

export async function deleteMessageStates(
  database: Database,
  input: {
    chatId: string;
    messageIds: string[];
  }
): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction.delete(telegramFileSlots).where(
      and(
        eq(telegramFileSlots.ownerModel, MESSAGE_MODEL),
        inArray(
          telegramFileSlots.ownerId,
          input.messageIds.map((messageId) => messageModelId(input.chatId, messageId))
        )
      )
    );
    await transaction
      .delete(telegramActiveLiveLocationMessages)
      .where(
        and(
          eq(telegramActiveLiveLocationMessages.chatId, input.chatId),
          inArray(telegramActiveLiveLocationMessages.messageId, input.messageIds)
        )
      );

    await transaction
      .delete(telegramMessages)
      .where(
        and(
          eq(telegramMessages.chatId, input.chatId),
          inArray(telegramMessages.id, input.messageIds)
        )
      );
  });
}

export async function markMessageContentOpened(
  database: Database,
  input: {
    chatId: string;
    messageId: string;
  }
): Promise<boolean> {
  const [row] = await database
    .select({ content: telegramMessages.content })
    .from(telegramMessages)
    .where(and(eq(telegramMessages.chatId, input.chatId), eq(telegramMessages.id, input.messageId)))
    .limit(1);

  const currentContent = row?.content;
  if (currentContent === undefined || currentContent === null) {
    return false;
  }

  const content = openedMessageContent(currentContent);
  if (content === currentContent) {
    return true;
  }

  await upsertMessagePatch(database, {
    chatId: input.chatId,
    content,
    id: input.messageId
  });

  return true;
}

export async function markMessageSendAcknowledgedState(
  database: Database,
  input: {
    chatId: string;
    messageId: string;
  }
): Promise<boolean> {
  const [storedMessage] = await database
    .select({ id: telegramMessages.id })
    .from(telegramMessages)
    .where(and(eq(telegramMessages.chatId, input.chatId), eq(telegramMessages.id, input.messageId)))
    .limit(1);

  if (storedMessage === undefined) {
    return false;
  }

  const [updatedMessage] = await database
    .update(telegramMessages)
    .set({ sendAcknowledged: true })
    .where(and(eq(telegramMessages.chatId, input.chatId), eq(telegramMessages.id, input.messageId)))
    .returning({ id: telegramMessages.id });

  return updatedMessage !== undefined;
}

export async function clearMessageSendAcknowledgementState(
  database: Database,
  input: {
    chatId: string;
    messageId: string;
  }
): Promise<void> {
  await database
    .update(telegramMessages)
    .set({ sendAcknowledged: null })
    .where(
      and(eq(telegramMessages.chatId, input.chatId), eq(telegramMessages.id, input.messageId))
    );
}

export async function clearMessageSchedulingState(
  database: Database,
  input: {
    chatId: string;
    messageId: string;
  }
): Promise<boolean> {
  const [storedMessage] = await database
    .select({ id: telegramMessages.id })
    .from(telegramMessages)
    .where(and(eq(telegramMessages.chatId, input.chatId), eq(telegramMessages.id, input.messageId)))
    .limit(1);

  if (storedMessage === undefined) {
    return false;
  }

  const [updatedMessage] = await database
    .update(telegramMessages)
    .set({ schedulingState: null })
    .where(and(eq(telegramMessages.chatId, input.chatId), eq(telegramMessages.id, input.messageId)))
    .returning({ id: telegramMessages.id });

  return updatedMessage !== undefined;
}

export async function replaceMessageReactionSummariesState(
  database: Database,
  input: {
    chatId: string;
    messageId: string;
    reactions: readonly MessageReactionSummary[];
  }
): Promise<void> {
  await database.transaction(async (transaction) => {
    const current = await readMessageReactionStateForUpdate(transaction, input);
    await upsertMessagePatch(transaction, {
      chatId: input.chatId,
      id: input.messageId,
      reactions: messageReactionStateWithSummaries(current, input.reactions)
    });
  });
}

export async function replaceActiveLiveLocationMessageStates(
  database: Database,
  messages: readonly {
    chatId: string;
    messageId: string;
  }[]
): Promise<void> {
  await database.delete(telegramActiveLiveLocationMessages);

  if (messages.length === 0) {
    return;
  }

  await database.insert(telegramActiveLiveLocationMessages).values([...messages]);
}

export async function readMessageReactionStateForUpdate(
  database: Database,
  input: {
    chatId: string;
    messageId: string;
  }
): Promise<JsonValue | null> {
  const [row] = await database
    .select({ reactions: telegramMessages.reactions })
    .from(telegramMessages)
    .where(and(eq(telegramMessages.chatId, input.chatId), eq(telegramMessages.id, input.messageId)))
    .for('update');

  return row?.reactions ?? null;
}

export function contentAwareFileSlotMarker(): SQL {
  const columns = getTableColumns(telegramMessages);
  return sql`case when ${telegramMessages.content} is distinct from ${sql.raw(`excluded."${columns.content.name}"`)} then null else ${telegramMessages.fileSlotsRecordedAt} end`;
}

function messageStorageState(message: MessageState): MessageStorageRow {
  return {
    ...message,
    fileSlotsRecordedAt: null
  };
}

function messageStorageStateFragment(fragment: MessagePatch): MessageStorageRow {
  return fragment;
}

function uniqueMessageStorageStates(messages: readonly MessageState[]): MessageStorageRow[] {
  const rowsByKey = new Map<string, MessageStorageRow>();
  for (const message of messages) {
    const row = messageStorageState(message);
    rowsByKey.set(`${row.chatId}:${row.id}`, row);
  }
  return [...rowsByKey.values()];
}

function messageUpsertSet(): Record<
  (typeof MESSAGE_UPSERT_COLUMNS)[number] | 'fileSlotsRecordedAt',
  SQL
> {
  const columns = getTableColumns(telegramMessages);
  const set = Object.fromEntries(
    MESSAGE_UPSERT_COLUMNS.map((key) => [key, sql.raw(`excluded."${columns[key].name}"`)])
  ) as Record<(typeof MESSAGE_UPSERT_COLUMNS)[number], SQL>;
  return {
    ...set,
    fileSlotsRecordedAt: contentAwareFileSlotMarker()
  };
}

function messagePatchUpdateSet(row: MessageStorageRow) {
  if (row.content === undefined) {
    return row;
  }
  return {
    ...row,
    fileSlotsRecordedAt: contentAwareFileSlotMarker()
  };
}

function openedMessageContent(content: JsonValue): JsonValue {
  if (!isJsonObject(content) || typeof content._ !== 'string') {
    return content;
  }

  if (content._ === 'messageVoiceNote') {
    return {
      ...content,
      is_listened: true
    };
  }

  if (content._ === 'messageVideoNote') {
    return {
      ...content,
      is_viewed: true
    };
  }

  return content;
}

function isJsonObject(value: JsonValue | null | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
