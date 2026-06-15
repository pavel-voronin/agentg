import type { message } from 'tdlib-types';

import type {
  BusinessMessageCreatedChange,
  BusinessMessagesDeletedChange,
  BusinessMessageSavedChange,
  BusinessMessageUpdatedChange,
  ActiveLiveLocationMessagesReplacedChange,
  DomainChange,
  MessageContentOpenedChange,
  MessageCreatedChange,
  MessageReactionSummariesReplacedChange,
  MessageReactionUpdatedChange,
  MessageSchedulingStateClearedChange,
  MessageSendAcknowledgedChange,
  MessageSendFailedChange,
  MessageSendSucceededChange,
  MessageUpdatedChange,
  MessageUpdatedPayload,
  MessagesDeletedChange,
  MessagesDeletedPayload
} from '../../domain/changes.js';
import type { MessagePatch } from '../../domain/models/messageState.js';
import type { Message } from '../../domain/models/message.js';
import { messageFromProjection } from '../../domain/models/messageProjection.js';
import type { BusinessMessageState } from '../../domain/models/businessMessage.js';
import type { TelegramPayload } from '../../domain/models/payload.js';
import { chatRef, messageRef } from '../../model/refs.js';
import {
  interactionInfoWithoutReactions,
  messageReactionSenderFromTdlibSender,
  messageReactionTypeFromTdlibType,
  messageStateFromTdlibMessage,
  reactionStateFromInteractionInfo,
  reactionSummariesFromTdlibReactions
} from '../../tdlib/messageState.js';
import { messageReactionSummariesFromJsonState } from '../../domain/models/messageReactionState.js';
import { tdDate, tdJsonObject, tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';
import {
  formattedTextString,
  messageContentFormattedText,
  messageTextEntitiesFromJson
} from './messageText.js';

type DeleteMessagesUpdate = UpdateByType<'updateDeleteMessages'>;
type BusinessMessageEditedUpdate = UpdateByType<'updateBusinessMessageEdited'>;
type BusinessMessagesDeletedUpdate = UpdateByType<'updateBusinessMessagesDeleted'>;
type NewBusinessCallbackQueryUpdate = UpdateByType<'updateNewBusinessCallbackQuery'>;
type NewBusinessMessageUpdate = UpdateByType<'updateNewBusinessMessage'>;
type MessageInteractionInfoUpdate = UpdateByType<'updateMessageInteractionInfo'>;
type MessageContentUpdate = UpdateByType<'updateMessageContent'>;
type MessageContentOpenedUpdate = UpdateByType<'updateMessageContentOpened'>;
type MessageEditedUpdate = UpdateByType<'updateMessageEdited'>;
type MessageFactCheckUpdate = UpdateByType<'updateMessageFactCheck'>;
type MessageSendAcknowledgedUpdate = UpdateByType<'updateMessageSendAcknowledged'>;
type MessageSendFailedUpdate = UpdateByType<'updateMessageSendFailed'>;
type MessageSendSucceededUpdate = UpdateByType<'updateMessageSendSucceeded'>;
type MessageSuggestedPostInfoUpdate = UpdateByType<'updateMessageSuggestedPostInfo'>;
type MessageUnreadReactionsUpdate = UpdateByType<'updateMessageUnreadReactions'>;
type MessageReactionsUpdate = UpdateByType<'updateMessageReactions'>;
type MessageReactionUpdate = UpdateByType<'updateMessageReaction'>;
type VideoPublishedUpdate = UpdateByType<'updateVideoPublished'>;
type ActiveLiveLocationMessagesUpdate = UpdateByType<'updateActiveLiveLocationMessages'>;
type BusinessMessage = BusinessMessageEditedUpdate['message'];

export function createdMessagePayload(message: message): Message {
  const formattedText = messageContentFormattedText(message.content);
  const text = formattedTextString(formattedText) ?? null;
  const chatId = String(message.chat_id);
  const messageId = String(message.id);
  const reply = messageReplyIds(chatId, message.reply_to);
  return messageFromProjection({
    chatId,
    contentType: contentType(message.content),
    deletedAt: null,
    editDate: tdDate(message.edit_date) ?? null,
    isDeleted: false,
    isOutgoing: message.is_outgoing,
    messageDate: tdDate(message.date) ?? null,
    messageId,
    reactionSummaries: messageReactionSummariesFromJsonState(
      reactionStateFromInteractionInfo(message.interaction_info) ?? null
    ),
    replyChatId: reply.chatId,
    replyMessageId: reply.messageId,
    senderId: senderId(message.sender_id),
    senderDisplayName: null,
    senderType: senderType(message.sender_id),
    serviceAction: null,
    text,
    textEntities: messageTextEntitiesFromJson(text, textEntitiesJson(formattedText))
  });
}

export function createdMessageChanges(message: message): DomainChange[] {
  return [createdMessageChange(message)];
}

export function createdBusinessMessageChanges(update: NewBusinessMessageUpdate): DomainChange[] {
  const businessMessage = businessMessageState(update.connection_id, update.message);
  return [
    {
      kind: 'businessMessage.created',
      businessMessage,
      message: messageStateFromTdlibMessage(update.message.message),
      payload: {
        message: createdMessagePayload(update.message.message)
      },
      replyToMessage: replyToMessageState(update.message)
    } satisfies BusinessMessageCreatedChange
  ];
}

export function updatedBusinessMessageChanges(update: BusinessMessageEditedUpdate): DomainChange[] {
  return [
    {
      kind: 'businessMessage.updated',
      businessMessage: businessMessageState(update.connection_id, update.message),
      message: messageStateFromTdlibMessage(update.message.message),
      payload: {
        message: updatedBusinessMessagePayload(update.message.message)
      },
      replyToMessage: replyToMessageState(update.message)
    } satisfies BusinessMessageUpdatedChange
  ];
}

export function savedBusinessMessageChanges(
  update: NewBusinessCallbackQueryUpdate
): DomainChange[] {
  return [
    {
      kind: 'businessMessage.saved',
      businessMessage: businessMessageState(update.connection_id, update.message),
      message: messageStateFromTdlibMessage(update.message.message),
      replyToMessage: replyToMessageState(update.message)
    } satisfies BusinessMessageSavedChange
  ];
}

export function deletedBusinessMessagesChanges(
  update: BusinessMessagesDeletedUpdate
): DomainChange[] {
  return [
    {
      kind: 'businessMessages.deleted',
      businessMessages: {
        chatId: String(update.chat_id),
        connectionId: update.connection_id,
        messageIds: update.message_ids.map(String)
      }
    } satisfies BusinessMessagesDeletedChange
  ];
}

function createdMessageChange(message: message): MessageCreatedChange {
  return {
    kind: 'message.created',
    liveMessage:
      message.date > 0
        ? {
            chatId: String(message.chat_id),
            date: new Date(message.date * 1000)
          }
        : null,
    message: messageStateFromTdlibMessage(message),
    payload: {
      message: createdMessagePayload(message)
    }
  };
}

function businessMessageState(
  connectionId: string,
  businessMessage: BusinessMessage
): BusinessMessageState {
  const replyToMessage = businessMessage.reply_to_message ?? null;
  return {
    connectionId,
    messageChatId: String(businessMessage.message.chat_id),
    messageId: String(businessMessage.message.id),
    replyToMessageChatId: replyToMessage === null ? null : String(replyToMessage.chat_id),
    replyToMessageId: replyToMessage === null ? null : String(replyToMessage.id)
  };
}

function replyToMessageState(businessMessage: BusinessMessage) {
  const replyToMessage = businessMessage.reply_to_message ?? null;
  return replyToMessage === null ? null : messageStateFromTdlibMessage(replyToMessage);
}

export function updatedMessageContentChanges(update: MessageContentUpdate): DomainChange[] {
  return [
    {
      kind: 'message.updated',
      message: {
        chatId: String(update.chat_id),
        content: tdJsonObject(update.new_content),
        id: String(update.message_id)
      },
      payload: {
        message: updatedMessagePayload(update)
      }
    } satisfies MessageUpdatedChange
  ];
}

export function openedMessageContentChanges(update: MessageContentOpenedUpdate): DomainChange[] {
  return [
    {
      kind: 'message.contentOpened',
      message: {
        chatId: String(update.chat_id),
        messageId: String(update.message_id)
      }
    } satisfies MessageContentOpenedChange
  ];
}

export function messageSendAcknowledgedChanges(
  update: MessageSendAcknowledgedUpdate
): DomainChange[] {
  return [
    {
      kind: 'messageSend.acknowledged',
      message: {
        chatId: String(update.chat_id),
        messageId: String(update.message_id)
      }
    } satisfies MessageSendAcknowledgedChange
  ];
}

export function messageSendFailedChanges(update: MessageSendFailedUpdate): DomainChange[] {
  return [
    {
      kind: 'messageSend.failed',
      currentMessage: messageStateFromTdlibMessage(update.message),
      oldMessage: {
        chatId: String(update.message.chat_id),
        messageId: String(update.old_message_id)
      }
    } satisfies MessageSendFailedChange
  ];
}

export function messageSendSucceededChanges(update: MessageSendSucceededUpdate): DomainChange[] {
  return [
    {
      kind: 'messageSend.succeeded',
      currentMessage: messageStateFromTdlibMessage(update.message),
      oldMessage: {
        chatId: String(update.message.chat_id),
        messageId: String(update.old_message_id)
      }
    } satisfies MessageSendSucceededChange
  ];
}

export function videoPublishedChanges(update: VideoPublishedUpdate): DomainChange[] {
  return [
    {
      kind: 'messageSchedulingState.cleared',
      message: {
        chatId: String(update.chat_id),
        messageId: String(update.message_id)
      }
    } satisfies MessageSchedulingStateClearedChange
  ];
}

export function messageEditedChanges(update: MessageEditedUpdate): DomainChange[] {
  return updatedMessageStateChanges({
    chatId: String(update.chat_id),
    editDate: tdDate(update.edit_date),
    id: String(update.message_id),
    replyMarkup: tdJsonValue(update.reply_markup ?? null)
  });
}

export function messageFactCheckChanges(update: MessageFactCheckUpdate): DomainChange[] {
  return updatedMessageStateChanges({
    chatId: String(update.chat_id),
    factCheck: tdJsonValue(update.fact_check),
    id: String(update.message_id)
  });
}

export function messageSuggestedPostInfoChanges(
  update: MessageSuggestedPostInfoUpdate
): DomainChange[] {
  return updatedMessageStateChanges({
    chatId: String(update.chat_id),
    id: String(update.message_id),
    suggestedPostInfo: tdJsonValue(update.suggested_post_info)
  });
}

export function messageUnreadReactionsChanges(
  update: MessageUnreadReactionsUpdate
): DomainChange[] {
  return updatedMessageStateChanges({
    chatId: String(update.chat_id),
    id: String(update.message_id),
    unreadReactions: tdJsonValue(update.unread_reactions)
  });
}

export function updatedMessageStateChanges(message: MessagePatch): DomainChange[] {
  return [
    {
      kind: 'message.updated',
      message,
      payload: null
    } satisfies MessageUpdatedChange
  ];
}

export function savedMessageChanges(message: message): DomainChange[] {
  return updatedMessageStateChanges(messageStateFromTdlibMessage(message));
}

export function savedMessagesChanges(messages: readonly message[]): DomainChange[] {
  return messages.flatMap(savedMessageChanges);
}

export function updatedMessageInteractionChanges(
  update: MessageInteractionInfoUpdate
): DomainChange[] {
  return [
    {
      kind: 'message.updated',
      message: {
        chatId: String(update.chat_id),
        id: String(update.message_id),
        interactionInfo: interactionInfoWithoutReactions(update.interaction_info ?? null),
        reactions: reactionStateFromInteractionInfo(update.interaction_info ?? null)
      },
      payload: null
    } satisfies MessageUpdatedChange
  ];
}

export function updatedMessageReactionChanges(
  update: MessageReactionUpdate,
  input: {
    currentAccountSenderKey: string;
  }
): DomainChange[] {
  const actorSender = messageReactionSenderFromTdlibSender(update.actor_id);
  return [
    {
      kind: 'message.reactionUpdated',
      actorIsCurrentAccountSender: actorSender.key === input.currentAccountSenderKey,
      actorSender,
      chatId: String(update.chat_id),
      messageId: String(update.message_id),
      newReactionTypes: update.new_reaction_types.map(messageReactionTypeFromTdlibType),
      oldReactionTypes: update.old_reaction_types.map(messageReactionTypeFromTdlibType)
    } satisfies MessageReactionUpdatedChange
  ];
}

export function replacedMessageReactionSummariesChanges(
  update: MessageReactionsUpdate
): DomainChange[] {
  return [
    {
      kind: 'message.reactionSummariesReplaced',
      message: {
        chatId: String(update.chat_id),
        messageId: String(update.message_id),
        reactions: reactionSummariesFromTdlibReactions(update.reactions)
      }
    } satisfies MessageReactionSummariesReplacedChange
  ];
}

export function activeLiveLocationMessageSetChanges(
  update: ActiveLiveLocationMessagesUpdate
): DomainChange[] {
  return [
    ...savedMessagesChanges(update.messages),
    {
      kind: 'activeLiveLocationMessages.replaced',
      messages: update.messages.map((message) => ({
        chatId: String(message.chat_id),
        messageId: String(message.id)
      }))
    } satisfies ActiveLiveLocationMessagesReplacedChange
  ];
}

export function deletedMessagesChanges(
  update: DeleteMessagesUpdate,
  deletedAt = new Date()
): DomainChange[] {
  return [
    {
      kind: 'messages.deleted',
      messages: {
        chatId: String(update.chat_id),
        messageIds: update.message_ids.map(String)
      },
      payload: {
        delete: deletedMessagesPayload(update, deletedAt)
      }
    } satisfies MessagesDeletedChange
  ];
}

export function updatedMessagePayload(update: MessageContentUpdate): MessageUpdatedPayload {
  return updatedPayload({
    chatId: String(update.chat_id),
    content: update.new_content,
    messageId: String(update.message_id)
  });
}

export function updatedBusinessMessagePayload(message: message): MessageUpdatedPayload {
  return updatedPayload({
    chatId: String(message.chat_id),
    content: message.content,
    messageId: String(message.id)
  });
}

export function deletedMessagesPayload(
  update: DeleteMessagesUpdate,
  deletedAt = new Date()
): MessagesDeletedPayload {
  const chatId = String(update.chat_id);
  return {
    chat: chatRef(chatId),
    deletedAt: deletedAt.toISOString(),
    messages: update.message_ids.map((messageId) =>
      messageRef({
        chatId,
        messageId: String(messageId)
      })
    )
  };
}

function updatedPayload(input: {
  chatId: string;
  content: unknown;
  messageId: string;
}): MessageUpdatedPayload {
  const formattedText = messageContentFormattedText(input.content);
  const text = formattedTextString(formattedText) ?? null;
  return {
    chat: chatRef(input.chatId),
    contentType: contentType(input.content),
    editDate: null,
    media: { files: [] },
    reactions: [],
    serviceAction: null,
    telegramMessageId: input.messageId,
    text,
    textEntities: messageTextEntitiesFromJson(text, textEntitiesJson(formattedText))
  };
}

function messageReplyIds(
  chatId: string,
  input: unknown
): { chatId: string | null; messageId: string | null } {
  const reply = objectValue(tdJsonValue(input) ?? null);
  const messageId = stringOrNumber(reply?.message_id ?? reply?.messageId);
  if (messageId === null) {
    return { chatId: null, messageId: null };
  }
  const replyChatId = stringOrNumber(reply?.chat_id ?? reply?.chatId) ?? chatId;
  return { chatId: replyChatId, messageId };
}

function textEntitiesJson(formattedText: unknown): TelegramPayload {
  const entities = objectValue(formattedText)?.entities;
  return tdJsonValue(Array.isArray(entities) ? entities : []) ?? [];
}

function contentType(content: unknown): string {
  return stringField(content, '_') ?? 'unknown';
}

function senderType(sender: unknown): string | null {
  return stringField(sender, '_') ?? null;
}

function senderId(sender: unknown): string | null {
  const object = objectValue(sender);
  const userId = stringOrNumber(object?.user_id);
  if (userId !== null) {
    return userId;
  }
  return stringOrNumber(object?.chat_id);
}

function stringField(value: unknown, key: string): string | undefined {
  const field = objectValue(value)?.[key];
  return typeof field === 'string' && field.length > 0 ? field : undefined;
}

function stringOrNumber(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  return null;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
