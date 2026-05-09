import type { JsonObject } from '@agentg/events/json';
import {
  telegramChatFolderRef,
  telegramChatRef,
  telegramMessageRef,
  telegramMessageSenderRef,
  telegramUserRef,
  type TelegramChatModelRef,
  type TelegramMessageModelRef,
  type TelegramSenderModelRef,
  type TelegramUserModelRef
} from './model-refs.js';
import { createIntegrationEvent, type IntegrationEvent } from '@agentg/events/envelope';
import type {
  TelegramChatDirectoryEntry,
  TelegramChatFolder,
  TelegramMessageServiceAction,
  TelegramMessageTextEntity
} from './rpc/contracts.js';

export type TelegramEventPersistResult = {
  chat: boolean;
  chatFolders: boolean;
  message: boolean;
  user: boolean;
};

export type TelegramChatDirectoryEvent =
  | {
      chat: TelegramChatDirectoryEntry;
      kind: 'updated';
    }
  | {
      chatId: string;
      kind: 'removed';
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
  isOutgoing: boolean;
  replyToChatId?: string;
  replyToMessageId?: string;
  serviceAction?: TelegramEventSourceMessageServiceAction;
  text?: string;
  textEntities?: TelegramMessageTextEntity[];
  messageDate?: Date;
  editDate?: Date;
};

export type TelegramEventSourceMessageContentUpdate = {
  chatId: string;
  contentType: string;
  editDate?: Date;
  messageId: string;
  serviceAction?: TelegramEventSourceMessageServiceAction;
  text?: string;
  textEntities?: TelegramMessageTextEntity[];
};

export type TelegramEventSourceMessageServiceAction = {
  kind: 'chatMemberLeft';
  userId: string;
  userDisplayName?: string;
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
  result: TelegramEventPersistResult,
  options: { chatDirectoryEvent?: TelegramChatDirectoryEvent } = {}
): IntegrationEvent[] {
  const events: IntegrationEvent[] = [];

  if (options.chatDirectoryEvent !== undefined) {
    events.push(chatDirectoryEvent(options.chatDirectoryEvent));
  }

  if (result.chatFolders && update.chatFolders !== undefined) {
    events.push(
      createIntegrationEvent({
        type: 'telegram.chat_folders.updated',
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

type TelegramEventChatFolder = TelegramChatFolder;

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
  isDeleted: boolean;
  isOutgoing: boolean;
  messageDate: string | null;
  replyTo: {
    chat: TelegramChatModelRef;
    message: TelegramMessageModelRef;
    telegramMessageId: string;
  } | null;
  sender: TelegramSenderModelRef | null;
  senderDisplayName: string | null;
  senderType: string | null;
  serviceAction: TelegramMessageServiceAction | null;
  telegramMessageId: string;
  text: string | null;
  textEntities: TelegramMessageTextEntity[];
  updatedAt: string;
};

type TelegramEventMessageUpdate = TelegramMessageModelRef & {
  chat: TelegramChatModelRef;
  contentType: string;
  editDate: string | null;
  serviceAction: TelegramMessageServiceAction | null;
  telegramMessageId: string;
  text: string | null;
  textEntities: TelegramMessageTextEntity[];
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

function eventChatFolder(folder: TelegramEventSourceChatFolder): TelegramEventChatFolder {
  return {
    ...telegramChatFolderRef(folder.id),
    folderId: folder.id,
    iconName: folder.iconName ?? null,
    position: folder.position,
    title: folder.title
  };
}

function chatDirectoryEvent(event: TelegramChatDirectoryEvent): IntegrationEvent {
  if (event.kind === 'removed') {
    return createIntegrationEvent({
      data: {
        chatId: event.chatId
      },
      meta: {
        chatId: event.chatId
      },
      type: 'telegram.chat.removed'
    });
  }

  return createIntegrationEvent({
    data: {
      chat: event.chat
    },
    meta: {
      chatId: event.chat.id
    },
    type: 'telegram.chat.updated'
  });
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
    isDeleted: false,
    isOutgoing: message.isOutgoing,
    messageDate: message.messageDate?.toISOString() ?? null,
    replyTo:
      message.replyToMessageId === undefined
        ? null
        : {
            chat: telegramChatRef(message.replyToChatId ?? message.chatId),
            message: telegramMessageRef({
              chatId: message.replyToChatId ?? message.chatId,
              messageId: message.replyToMessageId
            }),
            telegramMessageId: message.replyToMessageId
          },
    sender: telegramMessageSenderRef(message.senderType, message.senderId),
    senderDisplayName: null,
    senderType: message.senderType ?? null,
    serviceAction: eventMessageServiceAction(message.serviceAction),
    telegramMessageId: message.messageId,
    text: message.text ?? null,
    textEntities: message.textEntities ?? [],
    updatedAt: new Date().toISOString()
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
    serviceAction: eventMessageServiceAction(update.serviceAction),
    telegramMessageId: update.messageId,
    text: update.text ?? null,
    textEntities: update.textEntities ?? []
  };
}

function eventMessageServiceAction(
  action: TelegramEventSourceMessageServiceAction | undefined
): TelegramMessageServiceAction | null {
  if (action === undefined) {
    return null;
  }
  return {
    kind: 'chatMemberLeft',
    user: telegramUserRef(action.userId),
    userDisplayName: action.userDisplayName ?? action.userId
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
