import type { EventBus } from '@agentg/events/bus';
import { createIntegrationEvent } from '@agentg/events/envelope';

import type { TelegramDatabase } from '../database.js';
import {
  createTelegramChatUpdatedEvent,
  createTelegramIntegrationEvents,
  type TelegramEventPersistResult,
  type TelegramEventSourceChatFolder,
  type TelegramEventSourceMessage,
  type TelegramEventSourceMessageContentUpdate,
  type TelegramEventSourceMessageDelete,
  type TelegramEventSourceMessageServiceAction,
  type TelegramEventSourceUpdate,
  type TelegramEventSourceUser
} from '../integrationEvents.js';
import type { TelegramMessageTextEntity } from '../rpc/contracts.js';
import { getDirectoryEntryByChatId } from '../rpc/procedures/support.js';
import {
  telegramWireDate,
  telegramWireId,
  type TelegramWireChatFoldersUpdate,
  type TelegramWireMessage,
  type TelegramWireMessageContentUpdate,
  type TelegramWireObject,
  type TelegramWireUser
} from '../telegramWire.js';

const CHAT_FOLDERS_UPDATED: TelegramEventPersistResult = {
  chat: false,
  chatFolders: true,
  message: false,
  user: false
};

const MESSAGE_UPDATED: TelegramEventPersistResult = {
  chat: false,
  chatFolders: false,
  message: true,
  user: false
};

const USER_UPDATED: TelegramEventPersistResult = {
  chat: false,
  chatFolders: false,
  message: false,
  user: true
};

export type TelegramMessagesDeletedEventInput = {
  chatId: string;
  deletedAt: Date;
  fromCache: boolean;
  isPermanent: boolean;
  messageIds: string[];
};

export function createTelegramUpdateEventPublishers(eventBus: EventBus, database: TelegramDatabase) {
  function publishTelegramEvents(
    update: TelegramEventSourceUpdate,
    result: TelegramEventPersistResult
  ): void {
    for (const event of createTelegramIntegrationEvents(update, result)) {
      eventBus.publish(event);
    }
  }

  return {
    async publishTelegramChatDirectoryUpdated(chatId: string): Promise<void> {
      const chat = await getDirectoryEntryByChatId(database, chatId);
      eventBus.publish(
        chat === null
          ? createIntegrationEvent({
              data: { chatId },
              meta: { chatId },
              type: 'telegram.chat.removed'
            })
          : createTelegramChatUpdatedEvent(chat)
      );
    },
    publishTelegramChatFoldersUpdated(update: TelegramWireChatFoldersUpdate): void {
      publishTelegramEvents(
        { chatFolders: { folders: telegramChatFoldersUpdateSource(update) } },
        CHAT_FOLDERS_UPDATED
      );
    },
    publishTelegramMessageCreated(message: TelegramWireMessage): void {
      publishTelegramEvents({ message: telegramMessageEventSource(message) }, MESSAGE_UPDATED);
    },
    publishTelegramMessageDeleted(input: TelegramMessagesDeletedEventInput): void {
      publishTelegramEvents({ delete: input }, MESSAGE_UPDATED);
    },
    publishTelegramMessageUpdated(update: TelegramWireMessageContentUpdate): void {
      publishTelegramEvents(
        { contentUpdate: telegramMessageContentUpdateSource(update) },
        MESSAGE_UPDATED
      );
    },
    publishTelegramUserUpdated(
      user: TelegramWireUser,
      options: { isSelf?: boolean } = {}
    ): void {
      publishTelegramEvents({ user: telegramUserEventSource(user, options) }, USER_UPDATED);
    }
  };
}

export type TelegramUpdateEventPublishers = ReturnType<typeof createTelegramUpdateEventPublishers>;

function telegramChatFoldersUpdateSource(
  update: TelegramWireChatFoldersUpdate
): TelegramEventSourceChatFolder[] {
  return update.chat_folders.map((folder, position) => ({
    id: folder.id,
    position,
    title: folder.name.text.text,
    ...(folder.icon.name.length === 0 ? {} : { iconName: folder.icon.name })
  }));
}

function telegramUserEventSource(
  user: TelegramWireUser,
  options: { isSelf?: boolean }
): TelegramEventSourceUser {
  const username = activeUsername(user.usernames);
  return {
    firstName: user.first_name,
    id: String(user.id),
    isBot: user.type._ === 'userTypeBot',
    lastName: user.last_name,
    ...(options.isSelf === true ? { isSelf: true } : {}),
    ...(username === undefined ? {} : { username })
  };
}

function activeUsername(value: TelegramWireUser['usernames']): string | undefined {
  return value?.active_usernames[0];
}

function telegramMessageEventSource(message: TelegramWireMessage): TelegramEventSourceMessage {
  const senderId = messageSenderId(message);
  const senderType = message.sender_id._;
  const text = messageText(message);
  const messageDate = telegramWireDate(message.date);

  return {
    chatId: String(message.chat_id),
    contentType: message.content._,
    isOutgoing: message.is_outgoing,
    messageId: String(message.id),
    textEntities: messageTextEntities(message),
    ...(messageDate === undefined ? {} : { messageDate }),
    ...(senderId === undefined ? {} : { senderId }),
    senderType,
    ...(text === undefined ? {} : { text })
  };
}

function telegramMessageContentUpdateSource(
  update: TelegramWireMessageContentUpdate
): TelegramEventSourceMessageContentUpdate {
  const text = messageContentText(update.new_content);
  const serviceAction = messageContentServiceAction(update.new_content);

  return {
    chatId: String(update.chat_id),
    contentType: update.new_content._,
    messageId: String(update.message_id),
    textEntities: messageContentTextEntities(update.new_content),
    ...(text === undefined ? {} : { text }),
    ...(serviceAction === undefined ? {} : { serviceAction })
  };
}

function messageSenderId(message: TelegramWireMessage): string | undefined {
  const sender = message.sender_id as TelegramWireObject;
  return jsonId(sender.user_id) ?? jsonId(sender.chat_id);
}

function messageText(message: TelegramWireMessage): string | undefined {
  return messageContentText(message.content);
}

function messageTextEntities(message: TelegramWireMessage): TelegramMessageTextEntity[] {
  return messageContentTextEntities(message.content);
}

function messageContentText(content: unknown): string | undefined {
  const text = messageTextContent(content);
  return typeof text?.text === 'string' ? text.text : undefined;
}

function messageContentTextEntities(content: unknown): TelegramMessageTextEntity[] {
  const text = messageTextContent(content);
  return text === undefined ? [] : extractFormattedTextLinkEntities(text);
}

function messageContentServiceAction(
  content: unknown
): TelegramEventSourceMessageServiceAction | undefined {
  const object = recordValue(content);
  if (object?._ !== 'messageChatDeleteMember') {
    return undefined;
  }

  const userId = jsonId(object.user_id);
  return userId === undefined
    ? undefined
    : {
        kind: 'chatMemberLeft',
        userId
      };
}

function messageTextContent(content: unknown): TelegramWireObject | undefined {
  const object = recordValue(content);
  if (object?._ !== 'messageText') {
    return undefined;
  }
  return recordValue(object.text);
}

function extractFormattedTextLinkEntities(value: unknown): TelegramMessageTextEntity[] {
  const formattedText = recordValue(value);
  const text = typeof formattedText?.text === 'string' ? formattedText.text : '';
  const sourceEntities = Array.isArray(formattedText?.entities) ? formattedText.entities : [];
  const entities = sourceEntities
    .map((entity) => telegramTextLinkEntity(entity, text))
    .filter((entity): entity is TelegramMessageTextEntity => entity !== undefined)
    .sort(compareTextEntities);

  const result: TelegramMessageTextEntity[] = [];
  let consumedUntil = 0;
  for (const entity of entities) {
    if (entity.offset < consumedUntil) {
      continue;
    }
    result.push(entity);
    consumedUntil = entity.offset + entity.length;
  }
  return result;
}

function telegramTextLinkEntity(
  value: unknown,
  text: string
): TelegramMessageTextEntity | undefined {
  const entity = recordValue(value);
  const type = recordValue(entity?.type);
  const offset = safeInteger(entity?.offset);
  const length = safeInteger(entity?.length);
  if (
    offset === undefined ||
    length === undefined ||
    length <= 0 ||
    offset < 0 ||
    offset + length > text.length
  ) {
    return undefined;
  }

  if (type?._ === 'textEntityTypeUrl') {
    const url = normalizeHttpUrl(text.slice(offset, offset + length), true);
    return url === null ? undefined : { kind: 'url', length, offset, url };
  }

  if (type?._ === 'textEntityTypeTextUrl') {
    const url = normalizeHttpUrl(type.url, false);
    return url === null ? undefined : { kind: 'textUrl', length, offset, url };
  }

  return undefined;
}

function normalizeHttpUrl(value: unknown, allowMissingProtocol: boolean): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const directUrl = parseHttpUrl(trimmed);
  if (directUrl !== null || !allowMissingProtocol) {
    return directUrl;
  }
  return parseHttpUrl(`https://${trimmed}`);
}

function parseHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function compareTextEntities(
  left: TelegramMessageTextEntity,
  right: TelegramMessageTextEntity
): number {
  if (left.offset !== right.offset) {
    return left.offset - right.offset;
  }
  return right.length - left.length;
}

function safeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}

function jsonId(value: unknown): string | undefined {
  return typeof value === 'number' || typeof value === 'string' ? telegramWireId(value) : undefined;
}

function recordValue(value: unknown): TelegramWireObject | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as TelegramWireObject)
    : undefined;
}
