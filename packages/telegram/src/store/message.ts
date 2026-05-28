import { and, eq, inArray, sql } from 'drizzle-orm';

import type { JsonObject, JsonValue } from '@agentg/events/json';

import { TELEGRAM_MESSAGE_MODEL, telegramMessageModelId } from '../model/refs.js';
import type { TelegramDatabase } from '../database/client.js';
import {
  telegramActiveLiveLocationMessages,
  telegramFileSlots,
  telegramMessageReactions,
  telegramMessages
} from '../database/schema.js';
import {
  telegramWireDate,
  telegramWireId,
  telegramWireJsonObject,
  telegramWireJsonValue,
  type TelegramWireMessage,
  type TelegramWireMessageContentUpdate
} from '../tdlib/wire.js';
import type { TelegramFileSubsystem } from '../files/subsystem.js';
import type { TelegramMediaDownloadPolicyCause } from '../files/policy.js';
import { reactionTypeKey } from './reaction.js';

type StoreMessageConflict = 'ignore' | 'update';
type TelegramMessageReaction = NonNullable<
  NonNullable<
    NonNullable<TelegramWireMessage['interaction_info']>['reactions']
  >['reactions'][number]
>;

export type TelegramMessageFragment = typeof telegramMessages.$inferInsert;

export async function storeMessage(
  database: TelegramDatabase,
  message: TelegramWireMessage,
  conflict: StoreMessageConflict = 'update'
): Promise<boolean> {
  const row: typeof telegramMessages.$inferInsert = {
    authorSignature: message.author_signature,
    autoDeleteIn: message.auto_delete_in,
    canBeSaved: message.can_be_saved,
    chatId: String(message.chat_id),
    containsUnreadMention: message.contains_unread_mention,
    containsUnreadPollVotes: undefined,
    content: telegramWireJsonObject(message.content),
    date: telegramWireDate(message.date),
    editDate: telegramWireDate(message.edit_date),
    effectId: telegramWireId(message.effect_id),
    factCheck: telegramWireJsonValue(message.fact_check),
    forwardInfo: telegramWireJsonValue(message.forward_info),
    guestBotCallerId: undefined,
    hasTimestampedMedia: message.has_timestamped_media,
    id: String(message.id),
    importInfo: telegramWireJsonValue(message.import_info),
    interactionInfo: telegramWireJsonValue(message.interaction_info),
    isChannelPost: message.is_channel_post,
    isFromOffline: message.is_from_offline,
    isOutgoing: message.is_outgoing,
    isPaidStarSuggestedPost: message.is_paid_star_suggested_post,
    isPaidTonSuggestedPost: message.is_paid_ton_suggested_post,
    isPinned: message.is_pinned,
    mediaAlbumId: telegramWireId(message.media_album_id),
    paidMessageStarCount: telegramWireId(message.paid_message_star_count),
    replyMarkup: telegramWireJsonValue(message.reply_markup),
    replyTo: telegramWireJsonValue(message.reply_to),
    restrictionInfo: telegramWireJsonValue(message.restriction_info),
    schedulingState: telegramWireJsonValue(message.scheduling_state),
    selfDestructIn: message.self_destruct_in,
    selfDestructType: telegramWireJsonValue(message.self_destruct_type),
    senderBoostCount: message.sender_boost_count,
    senderBusinessBotUserId: telegramWireId(message.sender_business_bot_user_id),
    senderId: telegramWireJsonObject(message.sender_id),
    senderTag: message.sender_tag,
    sendingState: telegramWireJsonValue(message.sending_state),
    suggestedPostInfo: telegramWireJsonValue(message.suggested_post_info),
    summaryLanguageCode: message.summary_language_code,
    topicId: telegramWireJsonValue(message.topic_id),
    unreadReactions: telegramWireJsonValue(message.unread_reactions),
    viaBotUserId: telegramWireId(message.via_bot_user_id)
  };

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
            set: row,
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

export async function replaceMessageContent(
  database: TelegramDatabase,
  update: TelegramWireMessageContentUpdate
): Promise<void> {
  await database
    .insert(telegramMessages)
    .values({
      chatId: String(update.chat_id),
      content: telegramWireJsonObject(update.new_content),
      id: String(update.message_id)
    })
    .onConflictDoUpdate({
      set: {
        content: telegramWireJsonObject(update.new_content)
      },
      target: [telegramMessages.chatId, telegramMessages.id]
    });
}

export async function upsertTelegramMessageFragment(
  database: TelegramDatabase,
  row: TelegramMessageFragment
): Promise<void> {
  await database
    .insert(telegramMessages)
    .values(row)
    .onConflictDoUpdate({
      set: row,
      target: [telegramMessages.chatId, telegramMessages.id]
    });
}

export async function patchOpenedMessageContent(
  database: TelegramDatabase,
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
  database: TelegramDatabase,
  input: {
    chatId: string;
    messageId: string;
    reactions: readonly TelegramMessageReaction[];
  }
): Promise<void> {
  await database
    .delete(telegramMessageReactions)
    .where(
      and(
        eq(telegramMessageReactions.chatId, input.chatId),
        eq(telegramMessageReactions.messageId, input.messageId)
      )
    );

  const rowsByReactionType = new Map<string, typeof telegramMessageReactions.$inferInsert>();
  for (const reaction of input.reactions) {
    const reactionType = reactionTypeKey(reaction.type);
    rowsByReactionType.set(reactionType, {
      chatId: input.chatId,
      isChosen: reaction.is_chosen,
      messageId: input.messageId,
      reactionType,
      recentSenderIds: requiredTelegramWireJsonValue(reaction.recent_sender_ids),
      totalCount: reaction.total_count,
      usedSenderId: requiredTelegramWireJsonValue(reaction.used_sender_id ?? null)
    });
  }

  const rows = [...rowsByReactionType.values()];

  if (rows.length === 0) {
    return;
  }

  await database
    .insert(telegramMessageReactions)
    .values(rows)
    .onConflictDoUpdate({
      set: {
        isChosen: sql`excluded.is_chosen`,
        recentSenderIds: sql`excluded.recent_sender_ids`,
        totalCount: sql`excluded.total_count`,
        usedSenderId: sql`excluded.used_sender_id`
      },
      target: [
        telegramMessageReactions.chatId,
        telegramMessageReactions.messageId,
        telegramMessageReactions.reactionType
      ]
    });
}

export async function replaceActiveLiveLocationMessageSet(
  database: TelegramDatabase,
  messages: TelegramWireMessage[]
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
  database: TelegramDatabase,
  input: {
    chatId: string;
    messageIds: string[];
  }
): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction.delete(telegramFileSlots).where(
      and(
        eq(telegramFileSlots.ownerModel, TELEGRAM_MESSAGE_MODEL),
        inArray(
          telegramFileSlots.ownerId,
          input.messageIds.map((messageId) => telegramMessageModelId(input.chatId, messageId))
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
      .delete(telegramMessageReactions)
      .where(
        and(
          eq(telegramMessageReactions.chatId, input.chatId),
          inArray(telegramMessageReactions.messageId, input.messageIds)
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
  files: TelegramFileSubsystem,
  message: TelegramWireMessage,
  cause: TelegramMediaDownloadPolicyCause
): Promise<void> {
  return files.recordMessageFiles(message, cause);
}

export function recordMessageContentFiles(
  files: TelegramFileSubsystem,
  update: TelegramWireMessageContentUpdate,
  cause: TelegramMediaDownloadPolicyCause
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

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredTelegramWireJsonValue(value: unknown): JsonValue {
  const json = telegramWireJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
