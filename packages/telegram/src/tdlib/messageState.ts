import type { JsonObject, JsonValue } from '@agentg/framework';
import type { message as TdlibMessage } from 'tdlib-types';

import type { MessageState } from '../domain/models/messageState.js';
import {
  messageReactionSenderFromPayload,
  messageReactionSummariesFromJsonState,
  messageReactionTypeFromPayload,
  type MessageReactionSender,
  type MessageReactionSummary
} from '../domain/models/messageReactionState.js';
import { tdDate, tdId, tdJsonObject, tdJsonValue } from './shape.js';

type TelegramMessageInteractionInfo = TdlibMessage['interaction_info'];

export function messageStateFromTdlibMessage(message: TdlibMessage): MessageState {
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

export function reactionSummariesFromTdlibReactions(input: unknown): MessageReactionSummary[] {
  const reactions = tdJsonValue(input);
  return messageReactionSummariesFromJsonState(
    Array.isArray(reactions) ? { reactions } : isJsonObject(reactions) ? reactions : null
  );
}

export function messageReactionSenderFromTdlibSender(input: unknown): MessageReactionSender {
  const sender = messageReactionSenderFromPayload(tdJsonObject(input));
  if (sender === null) {
    throw new Error('Expected TDLib message sender');
  }
  return sender;
}

export function messageReactionTypeFromTdlibType(
  input: unknown
): MessageReactionSummary['reactionType'] {
  const type = messageReactionTypeFromPayload(tdJsonObject(input));
  if (type === null) {
    throw new Error('Expected TDLib reaction type');
  }
  return type;
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
