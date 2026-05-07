import type { JsonObject } from '@agentg/events/json';
import {
  telegramChatFolderRef,
  telegramChatRef,
  telegramMessageRef,
  telegramMessageSenderRef,
  telegramUserRef,
  type TelegramChatFolderModelRef,
  type TelegramChatModelRef,
  type TelegramMessageModelRef,
  type TelegramSenderModelRef,
  type TelegramUserModelRef
} from './model-refs.js';
import { createIntegrationEvent, type IntegrationEvent } from '@agentg/events/envelope';

export type TelegramEventPersistResult = {
  chat: boolean;
  chatFolders: boolean;
  message: boolean;
  user: boolean;
};

export type TelegramEventSourceChat = {
  id: string;
  type: string;
  title: string;
};

export type TelegramEventSourceUser = {
  id: string;
  firstName: string;
  isBot: boolean;
  isSelf?: boolean;
  lastName: string;
  username?: string;
};

export type TelegramEventSourceMessage = {
  chatId: string;
  messageId: string;
  senderId?: string;
  senderType?: string;
  contentType: string;
  text?: string;
  messageDate?: Date;
  editDate?: Date;
};

export type TelegramEventSourceMessageContentUpdate = {
  chatId: string;
  contentType: string;
  editDate?: Date;
  messageId: string;
  text?: string;
};

export type TelegramEventSourceMessageDelete = {
  chatId: string;
  deletedAt: Date;
  fromCache: boolean;
  isPermanent: boolean;
  messageIds: string[];
};

export type TelegramEventSourceChatFolder = {
  iconName?: string;
  id: number;
  position: number;
  title: string;
};

export type TelegramEventSourceUpdate = {
  chat?: TelegramEventSourceChat;
  chatFolders?: {
    folders: TelegramEventSourceChatFolder[];
  };
  contentUpdate?: TelegramEventSourceMessageContentUpdate;
  delete?: TelegramEventSourceMessageDelete;
  message?: TelegramEventSourceMessage;
  user?: TelegramEventSourceUser;
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
          chat: eventChat(update.chat)
        },
        meta: {
          chatId: update.chat.id
        }
      })
    );
  }

  if (result.chatFolders && update.chatFolders !== undefined) {
    events.push(
      createIntegrationEvent({
        type: 'telegram.chat_folders.updated',
        source: 'telegram',
        data: {
          folders: update.chatFolders.folders.map(eventChatFolder)
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

  if (result.user && update.user !== undefined) {
    events.push(
      createIntegrationEvent({
        type: 'telegram.user.updated',
        source: 'telegram',
        data: {
          user: eventUser(update.user)
        },
        meta: {
          userId: update.user.id
        }
      })
    );
  }

  return events;
}

type TelegramEventChat = TelegramChatModelRef & {
  title: string;
  type: string;
};

type TelegramEventChatFolder = TelegramChatFolderModelRef & {
  iconName: string | null;
  position: number;
  title: string;
};

type TelegramEventUser = TelegramUserModelRef & {
  firstName: string;
  isBot: boolean;
  isSelf: boolean;
  lastName: string;
  username: string | null;
};

type TelegramEventMessage = TelegramMessageModelRef & {
  chat: TelegramChatModelRef;
  contentType: string;
  editDate: string | null;
  messageDate: string | null;
  sender: TelegramSenderModelRef | null;
  senderType: string | null;
  telegramMessageId: string;
  text: string | null;
};

type TelegramEventMessageUpdate = TelegramMessageModelRef & {
  chat: TelegramChatModelRef;
  contentType: string;
  editDate: string | null;
  telegramMessageId: string;
  text: string | null;
};

type TelegramEventMessageDelete = {
  chat: TelegramChatModelRef;
  deletedAt: string;
  fromCache: boolean;
  isPermanent: boolean;
  messages: TelegramMessageModelRef[];
};

function messageEvent(type: string, message: TelegramEventSourceMessage): IntegrationEvent {
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

function contentUpdateEvent(update: TelegramEventSourceMessageContentUpdate): IntegrationEvent {
  return createIntegrationEvent({
    type: 'telegram.message.updated',
    source: 'telegram',
    data: {
      message: eventMessageUpdate(update)
    },
    meta: {
      chatId: update.chatId,
      messageId: update.messageId
    },
    ...(update.editDate === undefined ? {} : { occurredAt: update.editDate })
  });
}

function deleteEvent(update: TelegramEventSourceMessageDelete): IntegrationEvent {
  return createIntegrationEvent({
    type: 'telegram.message.deleted',
    source: 'telegram',
    occurredAt: update.deletedAt,
    data: {
      delete: eventMessageDelete(update)
    },
    meta: {
      chatId: update.chatId,
      messageIds: update.messageIds
    }
  });
}

function compactMessage(message: TelegramEventSourceMessage): JsonObject {
  return eventMessage(message);
}

function eventChat(chat: TelegramEventSourceChat): TelegramEventChat {
  return {
    ...telegramChatRef(chat.id),
    title: chat.title,
    type: chat.type
  };
}

function eventChatFolder(folder: TelegramEventSourceChatFolder): TelegramEventChatFolder {
  return {
    ...telegramChatFolderRef(folder.id),
    iconName: folder.iconName ?? null,
    position: folder.position,
    title: folder.title
  };
}

function eventUser(user: TelegramEventSourceUser): TelegramEventUser {
  return {
    ...telegramUserRef(user.id),
    firstName: user.firstName,
    isBot: user.isBot,
    isSelf: user.isSelf === true,
    lastName: user.lastName,
    username: user.username ?? null
  };
}

function eventMessage(message: TelegramEventSourceMessage): TelegramEventMessage {
  return {
    ...telegramMessageRef({ chatId: message.chatId, messageId: message.messageId }),
    chat: telegramChatRef(message.chatId),
    contentType: message.contentType,
    editDate: message.editDate?.toISOString() ?? null,
    messageDate: message.messageDate?.toISOString() ?? null,
    sender: telegramMessageSenderRef(message.senderType, message.senderId),
    senderType: message.senderType ?? null,
    telegramMessageId: message.messageId,
    text: message.text ?? null
  };
}

function eventMessageUpdate(
  update: TelegramEventSourceMessageContentUpdate
): TelegramEventMessageUpdate {
  return {
    ...telegramMessageRef({ chatId: update.chatId, messageId: update.messageId }),
    chat: telegramChatRef(update.chatId),
    contentType: update.contentType,
    editDate: update.editDate?.toISOString() ?? null,
    telegramMessageId: update.messageId,
    text: update.text ?? null
  };
}

function eventMessageDelete(update: TelegramEventSourceMessageDelete): TelegramEventMessageDelete {
  return {
    chat: telegramChatRef(update.chatId),
    deletedAt: update.deletedAt.toISOString(),
    fromCache: update.fromCache,
    isPermanent: update.isPermanent,
    messages: update.messageIds.map((messageId) =>
      telegramMessageRef({ chatId: update.chatId, messageId })
    )
  };
}
