import type { JsonObject } from '../json.js';
import { createIntegrationEvent, type IntegrationEvent } from './envelope.js';

export type TelegramEventPersistResult = {
  chat: boolean;
  message: boolean;
};

export type TelegramEventChat = {
  id: string;
  type: string;
  title: string;
};

export type TelegramEventMessage = {
  chatId: string;
  messageId: string;
  senderId?: string;
  senderType?: string;
  contentType: string;
  text?: string;
  messageDate?: Date;
  editDate?: Date;
};

export type TelegramEventMessageContentUpdate = {
  chatId: string;
  contentType: string;
  editDate?: Date;
  messageId: string;
  text?: string;
};

export type TelegramEventMessageDelete = {
  chatId: string;
  deletedAt: Date;
  messageIds: string[];
};

export type TelegramEventSourceUpdate = {
  chat?: TelegramEventChat;
  contentUpdate?: TelegramEventMessageContentUpdate;
  delete?: TelegramEventMessageDelete;
  message?: TelegramEventMessage;
};

export function createTelegramIntegrationEvents(
  update: TelegramEventSourceUpdate,
  result: TelegramEventPersistResult
): IntegrationEvent[] {
  const events: IntegrationEvent[] = [];

  if (result.chat && update.chat !== undefined) {
    events.push(
      createIntegrationEvent({
        type: 'telegram.chat.updated',
        source: 'telegram',
        data: {
          chat: {
            id: update.chat.id,
            title: update.chat.title,
            type: update.chat.type
          }
        },
        meta: {
          chatId: update.chat.id
        }
      })
    );
  }

  if (result.message && update.message !== undefined) {
    events.push(messageEvent('telegram.message.created', update.message));
  }

  if (result.message && update.contentUpdate !== undefined) {
    events.push(contentUpdateEvent(update.contentUpdate));
  }

  if (result.message && update.delete !== undefined) {
    events.push(deleteEvent(update.delete));
  }

  return events;
}

function messageEvent(type: string, message: TelegramEventMessage): IntegrationEvent {
  return createIntegrationEvent({
    type,
    source: 'telegram',
    data: {
      message: compactMessage(message)
    },
    meta: {
      chatId: message.chatId,
      messageId: message.messageId
    },
    ...(message.messageDate === undefined ? {} : { occurredAt: message.messageDate })
  });
}

function contentUpdateEvent(update: TelegramEventMessageContentUpdate): IntegrationEvent {
  return createIntegrationEvent({
    type: 'telegram.message.updated',
    source: 'telegram',
    data: {
      message: {
        chatId: update.chatId,
        contentType: update.contentType,
        editDate: update.editDate?.toISOString() ?? null,
        messageId: update.messageId,
        text: update.text ?? null
      }
    },
    meta: {
      chatId: update.chatId,
      messageId: update.messageId
    },
    ...(update.editDate === undefined ? {} : { occurredAt: update.editDate })
  });
}

function deleteEvent(update: TelegramEventMessageDelete): IntegrationEvent {
  return createIntegrationEvent({
    type: 'telegram.message.deleted',
    source: 'telegram',
    occurredAt: update.deletedAt,
    data: {
      delete: {
        chatId: update.chatId,
        messageIds: update.messageIds
      }
    },
    meta: {
      chatId: update.chatId,
      messageIds: update.messageIds
    }
  });
}

function compactMessage(message: TelegramEventMessage): JsonObject {
  return {
    chatId: message.chatId,
    contentType: message.contentType,
    editDate: message.editDate?.toISOString() ?? null,
    messageDate: message.messageDate?.toISOString() ?? null,
    messageId: message.messageId,
    senderId: message.senderId ?? null,
    senderType: message.senderType ?? null,
    text: message.text ?? null
  };
}
