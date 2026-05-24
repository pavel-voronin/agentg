import { and, eq, inArray } from 'drizzle-orm';

import { TELEGRAM_MESSAGE_MODEL, telegramMessageModelId } from '../modelRefs.js';
import type { TelegramDatabase } from '../database.js';
import { telegramFileSlots, telegramMessageReactions, telegramMessages } from '../schema.js';
import {
  telegramWireDate,
  telegramWireId,
  telegramWireJsonObject,
  telegramWireJsonValue,
  type TelegramWireMessage,
  type TelegramWireMessageContentUpdate
} from '../telegramWire.js';
import type { TelegramFileSubsystem } from '../telegramFileSubsystem.js';
import type { TelegramMediaDownloadPolicyCause } from '../telegramFilePolicy.js';

type StoreMessageConflict = 'ignore' | 'update';

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
