import type { TelegramDatabase } from './database.js';
import { telegramMessages } from './schema.js';
import type { TdlibMessage } from './tdlib-schema/Message.js';

export type TelegramMessagePersistConflictMode = 'ignore' | 'update';

export async function persistTelegramMessage(
  database: TelegramDatabase,
  message: TdlibMessage,
  conflictMode: TelegramMessagePersistConflictMode = 'update'
): Promise<boolean> {
  const row: typeof telegramMessages.$inferInsert = {
    authorSignature: message.author_signature,
    autoDeleteIn: message.auto_delete_in,
    canBeSaved: message.can_be_saved,
    chatId: message.chat_id,
    containsUnreadMention: message.contains_unread_mention,
    containsUnreadPollVotes: message.contains_unread_poll_votes,
    content: message.content,
    date: message.date,
    editDate: message.edit_date,
    effectId: message.effect_id,
    factCheck: message.fact_check,
    forwardInfo: message.forward_info,
    guestBotCallerId: message.guest_bot_caller_id,
    hasTimestampedMedia: message.has_timestamped_media,
    id: message.id,
    importInfo: message.import_info,
    interactionInfo: message.interaction_info,
    isChannelPost: message.is_channel_post,
    isFromOffline: message.is_from_offline,
    isOutgoing: message.is_outgoing,
    isPaidStarSuggestedPost: message.is_paid_star_suggested_post,
    isPaidTonSuggestedPost: message.is_paid_ton_suggested_post,
    isPinned: message.is_pinned,
    mediaAlbumId: message.media_album_id,
    paidMessageStarCount: message.paid_message_star_count,
    replyMarkup: message.reply_markup,
    replyTo: message.reply_to,
    restrictionInfo: message.restriction_info,
    schedulingState: message.scheduling_state,
    selfDestructIn: message.self_destruct_in,
    selfDestructType: message.self_destruct_type,
    senderBoostCount: message.sender_boost_count,
    senderBusinessBotUserId: message.sender_business_bot_user_id,
    senderId: message.sender_id,
    senderTag: message.sender_tag,
    sendingState: message.sending_state,
    suggestedPostInfo: message.suggested_post_info,
    summaryLanguageCode: message.summary_language_code,
    topicId: message.topic_id,
    unreadReactions: message.unread_reactions,
    viaBotUserId: message.via_bot_user_id
  };

  const insert = database.insert(telegramMessages).values(row);
  const stored =
    conflictMode === 'ignore'
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
