import type { JsonValue } from '@agentg/framework';
import type { message } from 'tdlib-types';

import { chatRef, messageRef } from '../model/refs.js';
import { reactionStateFromInteractionInfo } from '../store/message.js';
import { tdDate, tdJsonValue } from '../tdlib/shape.js';
import {
  messageTextEntitiesFromStorage,
  toReadMessage,
  type MessageStorageRow
} from '../views/message.js';
import { formattedTextString, messageContentFormattedText } from '../views/messageText.js';
import type { ReadMessage } from '../views/schemas.js';
import type { UpdateByType } from '../tdlib/shape.js';

type DeleteMessagesUpdate = UpdateByType<'updateDeleteMessages'>;
type MessageContentUpdate = UpdateByType<'updateMessageContent'>;

type MessageUpdatedPayload = Pick<
  ReadMessage,
  | 'chat'
  | 'contentType'
  | 'editDate'
  | 'media'
  | 'reactions'
  | 'serviceAction'
  | 'telegramMessageId'
  | 'text'
  | 'textEntities'
>;

export function createdMessagePayload(message: message): ReadMessage {
  return toReadMessage(messageRow(message));
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
): {
  chat: ReturnType<typeof chatRef>;
  deletedAt: string;
  messages: ReturnType<typeof messageRef>[];
} {
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
    textEntities: messageTextEntitiesFromStorage(text, textEntitiesJson(formattedText))
  };
}

function messageRow(message: message): MessageStorageRow {
  const formattedText = messageContentFormattedText(message.content);
  return {
    contentType: contentType(message.content),
    deletedAt: null,
    editDate: tdDate(message.edit_date) ?? null,
    isDeleted: false,
    isOutgoing: message.is_outgoing,
    messageDate: tdDate(message.date) ?? null,
    reactions: reactionStateFromInteractionInfo(message.interaction_info) ?? null,
    replyTo: tdJsonValue(message.reply_to) ?? null,
    senderId: senderId(message.sender_id),
    senderType: senderType(message.sender_id),
    telegramChatId: String(message.chat_id),
    telegramMessageId: String(message.id),
    text: formattedTextString(formattedText) ?? null,
    textEntities: textEntitiesJson(formattedText)
  };
}

function textEntitiesJson(formattedText: unknown): JsonValue {
  const entities = recordValue(formattedText)?.entities;
  return tdJsonValue(Array.isArray(entities) ? entities : []) ?? [];
}

function contentType(content: unknown): string {
  return stringField(content, '_') ?? 'unknown';
}

function senderType(sender: unknown): string | null {
  return stringField(sender, '_') ?? null;
}

function senderId(sender: unknown): string | null {
  const object = recordValue(sender);
  const userId = stringOrNumber(object?.user_id);
  if (userId !== null) {
    return userId;
  }
  return stringOrNumber(object?.chat_id);
}

function stringField(value: unknown, key: string): string | undefined {
  const field = recordValue(value)?.[key];
  return typeof field === 'string' && field.length > 0 ? field : undefined;
}

function stringOrNumber(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  return null;
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
