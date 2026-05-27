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
} from './modelRefs.js';
import { createIntegrationEvent, type IntegrationEvent } from '@agentg/events/envelope';
import type {
  TelegramReadMessage,
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

export type TelegramHistoryCoverageChangedEventSource = {
  intervals: {
    chatId: string;
    endAt: Date;
    messageCount: number;
    provedAt: Date;
    startAt: Date;
  }[];
};

export type TelegramFileQueueStats = {
  downloadingCount: number;
  failedCount: number;
  knownCount: number;
  knownDownloadedBytes: number;
  knownRemainingBytes: number;
  knownTotalBytes: number;
  queuedCount: number;
  readyCount: number;
  remainingCount: number;
  totalCount: number;
  unknownRemainingCount: number;
};

export type TelegramDefaultBackgroundUpdatedEventInput = {
  backgroundId: string | null;
  forDarkTheme: boolean;
  key: string;
  scope: 'dark' | 'light';
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

export function createTelegramFileQueueUpdatedEvent(
  stats: TelegramFileQueueStats
): IntegrationEvent {
  return createIntegrationEvent({
    data: {
      downloadingCount: stats.downloadingCount,
      failedCount: stats.failedCount,
      knownCount: stats.knownCount,
      knownDownloadedBytes: stats.knownDownloadedBytes,
      knownRemainingBytes: stats.knownRemainingBytes,
      knownTotalBytes: stats.knownTotalBytes,
      queuedCount: stats.queuedCount,
      readyCount: stats.readyCount,
      remainingCount: stats.remainingCount,
      totalCount: stats.totalCount,
      unknownRemainingCount: stats.unknownRemainingCount
    },
    type: 'telegram.files.queue.updated'
  });
}

export function createTelegramDefaultBackgroundUpdatedEvent(
  input: TelegramDefaultBackgroundUpdatedEventInput
): IntegrationEvent {
  return createIntegrationEvent({
    data: input,
    meta: {
      key: input.key,
      scope: input.scope
    },
    type: 'telegram.default_background.updated'
  });
}

export function createTelegramHistoryCoverageChangedEvent(
  source: TelegramHistoryCoverageChangedEventSource
): IntegrationEvent {
  const intervals = source.intervals.map((interval) => ({
    chat: telegramChatRef(interval.chatId),
    endAt: interval.endAt.toISOString(),
    messageCount: interval.messageCount,
    provedAt: interval.provedAt.toISOString(),
    startAt: interval.startAt.toISOString()
  }));
  const startAt = minIso(intervals.map((interval) => interval.startAt));
  const endAt = maxIso(intervals.map((interval) => interval.endAt));

  return createIntegrationEvent({
    data: {
      ...(intervals.length === 1 && intervals[0] !== undefined ? { chat: intervals[0].chat } : {}),
      chatCount: new Set(intervals.map((interval) => interval.chat.id)).size,
      endAt,
      intervals,
      startAt
    },
    meta: {
      ...(intervals.length === 1 && intervals[0] !== undefined
        ? { chatId: intervals[0].chat.id }
        : {})
    },
    type: 'telegram.history.coverage.changed'
  });
}

export function createTelegramChatUpdatedEvent(chat: TelegramChatDirectoryEntry): IntegrationEvent {
  return createIntegrationEvent({
    data: {
      chat
    },
    meta: {
      chatId: chat.id
    },
    type: 'telegram.chat.updated'
  });
}

export function createTelegramReadMessageUpdatedEvent(
  message: TelegramReadMessage
): IntegrationEvent {
  return createIntegrationEvent({
    data: {
      message
    },
    meta: {
      chatId: message.chat.id,
      messageId: message.telegramMessageId
    },
    type: 'telegram.message.updated'
  });
}

export function createTelegramMessageCreatedEvent(
  message: TelegramEventSourceMessage
): IntegrationEvent {
  return messageEvent('telegram.message.created', message);
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

  return createTelegramChatUpdatedEvent(event.chat);
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
    textEntities: message.textEntities ?? []
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

function minIso(values: string[]): string {
  const [first, ...rest] = values;
  if (first === undefined) {
    throw new Error('telegram.history.coverage.changed requires at least one interval');
  }
  return rest.reduce((minimum, value) => (value < minimum ? value : minimum), first);
}

function maxIso(values: string[]): string {
  const [first, ...rest] = values;
  if (first === undefined) {
    throw new Error('telegram.history.coverage.changed requires at least one interval');
  }
  return rest.reduce((maximum, value) => (value > maximum ? value : maximum), first);
}
