import { and, eq, getTableColumns, inArray, sql, type SQL } from 'drizzle-orm';

import type { JsonObject, JsonValue } from '@agentg/framework';

import { MESSAGE_MODEL, messageModelId } from '../model/refs.js';
import type { Database } from '../database/client.js';
import {
  telegramActiveLiveLocationMessages,
  telegramFileSlots,
  telegramMessages
} from '../database/schema.js';
import { tdDate, tdId, tdJsonObject, tdJsonValue } from '../tdlib/shape.js';
import type { message as Message, updateMessageContent as MessageContentUpdate } from 'tdlib-types';
import type { FileSubsystem } from '../files/index.js';
import type { MediaDownloadPolicyCause } from '../files/policy.js';

type StoreMessageConflict = 'ignore' | 'update';
type TelegramMessageReaction = NonNullable<
  NonNullable<NonNullable<Message['interaction_info']>['reactions']>['reactions'][number]
>;
type TelegramMessageInteractionInfo = Message['interaction_info'];

export type TelegramMessageFragment = typeof telegramMessages.$inferInsert;
type TelegramMessageInsertKey = keyof TelegramMessageFragment;

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
] as const satisfies readonly TelegramMessageInsertKey[];

export async function storeMessage(
  database: Database,
  message: Message,
  conflict: StoreMessageConflict = 'update'
): Promise<boolean> {
  const row = telegramMessageRow(message);

  const insert = database.insert(telegramMessages).values(row);
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

  if (stored.length === 0) {
    return false;
  }

  return true;
}

export async function storeMessages(
  database: Database,
  messages: Message[],
  conflict: StoreMessageConflict = 'update'
): Promise<number> {
  const rows = uniqueMessageRows(messages);
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

function telegramMessageRow(message: Message): TelegramMessageFragment {
  return {
    authorSignature: message.author_signature,
    autoDeleteIn: message.auto_delete_in,
    canBeSaved: message.can_be_saved,
    chatId: String(message.chat_id),
    containsUnreadMention: message.contains_unread_mention,
    containsUnreadPollVotes: undefined,
    content: tdJsonObject(message.content),
    date: tdDate(message.date),
    editDate: tdDate(message.edit_date),
    effectId: tdId(message.effect_id),
    factCheck: tdJsonValue(message.fact_check),
    fileSlotsRecordedAt: null,
    forwardInfo: tdJsonValue(message.forward_info),
    guestBotCallerId: undefined,
    hasTimestampedMedia: message.has_timestamped_media,
    id: String(message.id),
    importInfo: tdJsonValue(message.import_info),
    interactionInfo: interactionInfoWithoutReactions(message.interaction_info),
    isChannelPost: message.is_channel_post,
    isFromOffline: message.is_from_offline,
    isOutgoing: message.is_outgoing,
    isPaidStarSuggestedPost: message.is_paid_star_suggested_post,
    isPaidTonSuggestedPost: message.is_paid_ton_suggested_post,
    isPinned: message.is_pinned,
    mediaAlbumId: tdId(message.media_album_id),
    paidMessageStarCount: tdId(message.paid_message_star_count),
    reactions: reactionStateFromInteractionInfo(message.interaction_info),
    replyMarkup: tdJsonValue(message.reply_markup),
    replyTo: tdJsonValue(message.reply_to),
    restrictionInfo: tdJsonValue(message.restriction_info),
    schedulingState: tdJsonValue(message.scheduling_state),
    selfDestructIn: message.self_destruct_in,
    selfDestructType: tdJsonValue(message.self_destruct_type),
    senderBoostCount: message.sender_boost_count,
    senderBusinessBotUserId: tdId(message.sender_business_bot_user_id),
    senderId: tdJsonObject(message.sender_id),
    senderTag: message.sender_tag,
    sendingState: tdJsonValue(message.sending_state),
    suggestedPostInfo: tdJsonValue(message.suggested_post_info),
    summaryLanguageCode: message.summary_language_code,
    topicId: tdJsonValue(message.topic_id),
    unreadReactions: tdJsonValue(message.unread_reactions),
    viaBotUserId: tdId(message.via_bot_user_id)
  };
}

function uniqueMessageRows(messages: Message[]): TelegramMessageFragment[] {
  const rowsByKey = new Map<string, TelegramMessageFragment>();
  for (const message of messages) {
    const row = telegramMessageRow(message);
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
    fileSlotsRecordedAt: fileSlotsRecordedAtAfterContentUpsert()
  };
}

export async function replaceMessageContent(
  database: Database,
  update: MessageContentUpdate
): Promise<void> {
  await database
    .insert(telegramMessages)
    .values({
      chatId: String(update.chat_id),
      content: tdJsonObject(update.new_content),
      fileSlotsRecordedAt: null,
      id: String(update.message_id)
    })
    .onConflictDoUpdate({
      set: {
        content: sql.raw(`excluded."${getTableColumns(telegramMessages).content.name}"`),
        fileSlotsRecordedAt: fileSlotsRecordedAtAfterContentUpsert()
      },
      target: [telegramMessages.chatId, telegramMessages.id]
    });
}

export async function upsertTelegramMessageFragment(
  database: Database,
  row: TelegramMessageFragment
): Promise<void> {
  await database
    .insert(telegramMessages)
    .values(row)
    .onConflictDoUpdate({
      set: telegramMessageFragmentUpdateSet(row),
      target: [telegramMessages.chatId, telegramMessages.id]
    });
}

function telegramMessageFragmentUpdateSet(row: TelegramMessageFragment) {
  if (row.content === undefined) {
    return row;
  }
  return {
    ...row,
    fileSlotsRecordedAt: fileSlotsRecordedAtAfterContentUpsert()
  };
}

function fileSlotsRecordedAtAfterContentUpsert(): SQL {
  const columns = getTableColumns(telegramMessages);
  return sql`case when ${telegramMessages.content} is distinct from ${sql.raw(`excluded."${columns.content.name}"`)} then null else ${telegramMessages.fileSlotsRecordedAt} end`;
}

export async function patchOpenedMessageContent(
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

  await upsertTelegramMessageFragment(database, {
    chatId: input.chatId,
    content,
    id: input.messageId
  });

  return true;
}

export async function replaceMessageReactionSummaries(
  database: Database,
  input: {
    chatId: string;
    messageId: string;
    reactions: readonly TelegramMessageReaction[];
  }
): Promise<void> {
  await database.transaction(async (transaction) => {
    const current = await readReactionStateForUpdate(transaction, input);
    await upsertTelegramMessageFragment(transaction, {
      chatId: input.chatId,
      id: input.messageId,
      reactions: reactionStateWithSummaries(current, input.reactions)
    });
  });
}

export async function replaceActiveLiveLocationMessageSet(
  database: Database,
  messages: Message[]
): Promise<void> {
  await database.delete(telegramActiveLiveLocationMessages);

  const rows = messages.map((message) => ({
    chatId: String(message.chat_id),
    messageId: String(message.id)
  }));

  if (rows.length === 0) {
    return;
  }

  await database.insert(telegramActiveLiveLocationMessages).values(rows);
}

export async function deleteMessages(
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

export function recordMessageFiles(
  files: FileSubsystem,
  message: Message,
  cause: MediaDownloadPolicyCause
): Promise<void> {
  return files.recordMessageFiles(message, cause);
}

export function recordMessageContentFiles(
  files: FileSubsystem,
  update: MessageContentUpdate,
  cause: MediaDownloadPolicyCause
): Promise<void> {
  return files.recordMessageContentFiles(update, cause);
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

export function interactionInfoWithoutReactions(
  input: TelegramMessageInteractionInfo | null | undefined
): JsonValue | undefined {
  if (input === undefined) {
    return undefined;
  }
  const value = tdJsonValue(input);
  if (!isJsonObject(value)) {
    return value;
  }
  const withoutReactions = { ...value };
  delete withoutReactions.reactions;
  return withoutReactions;
}

export function reactionStateFromInteractionInfo(
  input: TelegramMessageInteractionInfo | null | undefined
): JsonValue | undefined {
  return input === undefined ? undefined : (tdJsonValue(input?.reactions ?? null) ?? null);
}

async function readReactionStateForUpdate(
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

function reactionStateWithSummaries(
  current: JsonValue | null,
  reactions: readonly TelegramMessageReaction[]
): JsonValue {
  const state = isJsonObject(current) ? { ...current } : {};
  state.reactions = requiredJsonValue(reactions);
  return state;
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredJsonValue(value: unknown): JsonValue {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
