import {
  telegramChatRef,
  telegramMessageRef,
  telegramMessageSenderRef
} from '@agentg/telegram/model-refs';
import type { JsonValue } from '@agentg/events/json';
import { inArray, sql } from 'drizzle-orm';

import type { TelegramDatabase } from '../database.js';
import { telegramChats, telegramMessages, telegramUsers } from '../schema.js';
import { ownerKey, readTelegramFileRefsForOwners, type TelegramFileOwnerKey } from '../fileRead.js';
import type {
  TelegramFileRef,
  TelegramMessageTextEntity,
  TelegramReadMessage
} from '../rpc/contracts.js';
import { toNullableIsoString, type TelegramDateLike } from './dates.js';
import { asPlainRecord, parseNonNegativeBigInt, stringifyTelegramId } from './chat.js';
import { extractFormattedTextLinkEntities, formattedTextValue } from '../messageText.js';

export type TelegramMessageStorageRow = {
  contentType: string;
  deletedAt: TelegramDateLike | null;
  editDate: TelegramDateLike | null;
  isDeleted: boolean;
  isOutgoing: boolean;
  messageDate: TelegramDateLike | null;
  replyTo: JsonValue | null;
  senderId: string | null;
  senderType: string | null;
  telegramChatId: string;
  telegramMessageId: string;
  text: string | null;
  textEntities: JsonValue | null;
};

type TelegramSenderRow = {
  senderId: string | null;
  senderType: string | null;
};

type TelegramSenderDisplayInfo = {
  displayName: string;
};

export function readMessageSelection() {
  return {
    contentType: sql<string>`coalesce(${telegramMessages.content}->>'_', 'unknown')`,
    deletedAt: sql<null>`null`,
    editDate: telegramMessages.editDate,
    isDeleted: sql<boolean>`false`,
    isOutgoing: sql<boolean>`coalesce(${telegramMessages.isOutgoing}, false)`,
    messageDate: telegramMessages.date,
    replyTo: messageReplyExpression(),
    senderId: sql<
      string | null
    >`coalesce(${telegramMessages.senderId}->>'user_id', ${telegramMessages.senderId}->>'chat_id')`,
    senderType: sql<string | null>`${telegramMessages.senderId}->>'_'`,
    telegramChatId: telegramMessages.chatId,
    telegramMessageId: telegramMessages.id,
    text: messageTextExpression(),
    textEntities: messageTextEntitiesExpression()
  };
}

export function messageTextExpression() {
  return sql<string | null>`coalesce(
    ${telegramMessages.content}->'text'->>'text',
    ${telegramMessages.content}->'caption'->>'text'
  )`;
}

export function messageTextEntitiesExpression() {
  return sql<JsonValue | null>`case
    when ${telegramMessages.content}->'text'->>'text' is not null
      then ${telegramMessages.content}->'text'->'entities'
    when ${telegramMessages.content}->'caption'->>'text' is not null
      then ${telegramMessages.content}->'caption'->'entities'
    else null
  end`;
}

export function toReadMessage(
  message: TelegramMessageStorageRow,
  files: TelegramFileRef[] = []
): TelegramReadMessage {
  const replyTo = telegramMessageReply(message);

  return {
    ...telegramMessageRef({
      chatId: message.telegramChatId,
      messageId: message.telegramMessageId
    }),
    chat: telegramChatRef(message.telegramChatId),
    contentType: message.contentType,
    deletedAt: toNullableIsoString(message.deletedAt),
    editDate: toNullableIsoString(message.editDate),
    isDeleted: message.isDeleted,
    isOutgoing: message.isOutgoing,
    media: {
      files
    },
    messageDate: toNullableIsoString(message.messageDate),
    replyTo,
    sender: telegramMessageSenderRef(message.senderType, message.senderId),
    senderDisplayName: null,
    senderType: message.senderType,
    serviceAction: null,
    telegramMessageId: message.telegramMessageId,
    text: message.text,
    textEntities: messageTextEntitiesFromStorage(message.text, message.textEntities)
  };
}

export function messageTextEntitiesFromStorage(
  text: string | null,
  entities: JsonValue | null | undefined
): TelegramMessageTextEntity[] {
  if (text === null) {
    return [];
  }
  return extractFormattedTextLinkEntities({
    entities: Array.isArray(entities) ? entities : [],
    text
  });
}

export async function toReadMessages(
  database: TelegramDatabase,
  messages: TelegramMessageStorageRow[]
): Promise<TelegramReadMessage[]> {
  const senderInfoByKey = await readSenderDisplayInfo(database, messages);
  const filesByOwner = await readTelegramFileRefsForOwners(database, messageFileOwners(messages));

  return messages.map((message) => {
    const messageOwner = telegramMessageFileOwner(message);
    const readMessage = toReadMessage(message, filesByOwner.get(ownerKey(messageOwner)) ?? []);
    const senderKey = senderDisplayKey(message.senderType, message.senderId);
    return {
      ...readMessage,
      senderDisplayName:
        senderKey === null ? null : (senderInfoByKey.get(senderKey)?.displayName ?? null),
      serviceAction: null
    };
  });
}

function messageReplyExpression() {
  return sql<JsonValue | null>`${telegramMessages.replyTo}`;
}

function messageFileOwners(messages: TelegramMessageStorageRow[]): TelegramFileOwnerKey[] {
  return messages.map(telegramMessageFileOwner);
}

function telegramMessageFileOwner(message: TelegramMessageStorageRow): TelegramFileOwnerKey {
  return {
    ownerId: telegramMessageRef({
      chatId: message.telegramChatId,
      messageId: message.telegramMessageId
    }).id,
    ownerModel: 'telegram.message'
  };
}

function telegramMessageReply(message: TelegramMessageStorageRow): TelegramReadMessage['replyTo'] {
  const reply = asPlainRecord(message.replyTo);
  const messageId = stringifyTelegramId(reply?.message_id) ?? stringifyTelegramId(reply?.messageId);
  if (messageId === undefined) {
    return null;
  }
  const chatId =
    stringifyTelegramId(reply?.chat_id) ??
    stringifyTelegramId(reply?.chatId) ??
    message.telegramChatId;

  return {
    chat: telegramChatRef(chatId),
    message: telegramMessageRef({ chatId, messageId }),
    telegramMessageId: messageId
  };
}

async function readSenderDisplayInfo(
  database: TelegramDatabase,
  messages: TelegramSenderRow[]
): Promise<Map<string, TelegramSenderDisplayInfo>> {
  const userIds = dedupeStrings(
    messages
      .filter((message) => message.senderType === 'messageSenderUser')
      .map((message) => message.senderId)
      .filter(isString)
  );
  const chatIds = dedupeStrings(
    messages
      .filter((message) => message.senderType === 'messageSenderChat')
      .map((message) => message.senderId)
      .filter(isString)
  );
  const senderInfoByKey = new Map<string, TelegramSenderDisplayInfo>();

  if (userIds.length > 0) {
    const users = await database
      .select({
        firstName: telegramUsers.firstName,
        lastName: telegramUsers.lastName,
        telegramUserId: telegramUsers.id
      })
      .from(telegramUsers)
      .where(inArray(telegramUsers.id, userIds));
    for (const user of users) {
      const key = senderDisplayKey('messageSenderUser', user.telegramUserId);
      if (key !== null) {
        senderInfoByKey.set(key, {
          displayName: userDisplayName(user)
        });
      }
    }
  }

  if (chatIds.length > 0) {
    const chats = await database
      .select({
        telegramChatId: telegramChats.id,
        title: telegramChats.title
      })
      .from(telegramChats)
      .where(inArray(telegramChats.id, chatIds));
    for (const chat of chats) {
      const key = senderDisplayKey('messageSenderChat', chat.telegramChatId);
      if (key !== null) {
        senderInfoByKey.set(key, {
          displayName: chat.title ?? chat.telegramChatId
        });
      }
    }
  }

  return senderInfoByKey;
}

function senderDisplayKey(senderType: string | null, senderId: string | null): string | null {
  if (senderId === null || senderType === null) {
    return null;
  }
  if (senderType === 'messageSenderUser') {
    return `telegram.user:${senderId}`;
  }
  if (senderType === 'messageSenderChat') {
    return `telegram.chat:${senderId}`;
  }
  return null;
}

function userDisplayName(user: {
  firstName: string | null;
  lastName: string | null;
  telegramUserId: string;
}): string {
  const name = [user.firstName, user.lastName]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ');
  if (name.length > 0) {
    return name;
  }
  return user.telegramUserId;
}

function isString(value: string | null | undefined): value is string {
  return typeof value === 'string';
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values)];
}

export function telegramReadMessagePreview(message: TelegramReadMessage): {
  placeholder: boolean;
  text: string;
} {
  if (message.text !== null && message.text.length > 0) {
    return {
      placeholder: false,
      text: message.text
    };
  }

  const label = telegramMessageContentLabel({ _: message.contentType });
  return {
    placeholder: label === null,
    text: label ?? 'Unsupported message'
  };
}

function telegramMessageContentLabel(content: Record<string, unknown>): string | null {
  switch (content._) {
    case 'messageAnimation':
      return 'GIF';
    case 'messageAudio':
      return nestedTitle(content.audio, 'Audio');
    case 'messageChatAddMembers':
      return 'Members joined';
    case 'messageChatChangePhoto':
      return 'Chat photo updated';
    case 'messageChatChangeTitle':
      return 'Chat title updated';
    case 'messageChatDeleteMember':
      return 'Member left';
    case 'messageChatDeletePhoto':
      return 'Chat photo removed';
    case 'messageContact':
      return 'Contact';
    case 'messageDocument':
      return nestedFileName(content.document, 'File');
    case 'messageExpiredPhoto':
      return 'Expired photo';
    case 'messageExpiredVideo':
      return 'Expired video';
    case 'messageGame':
      return nestedTitle(content.game, 'Game');
    case 'messageInvoice':
      return nestedTitle(content.invoice, 'Invoice');
    case 'messageLocation':
      return 'Location';
    case 'messagePhoto':
      return 'Photo';
    case 'messagePoll':
      return nestedQuestion(content.poll, 'Poll');
    case 'messageSticker':
      return stickerLabel(content.sticker);
    case 'messageVideo':
      return 'Video';
    case 'messageVideoNote':
      return 'Video message';
    case 'messageVoiceNote':
      return 'Voice message';
    default:
      return null;
  }
}

function nestedTitle(value: unknown, fallback: string): string {
  const record = asPlainRecord(value);
  return typeof record?.title === 'string' && record.title.trim().length > 0
    ? record.title.trim()
    : fallback;
}

function nestedQuestion(value: unknown, fallback: string): string {
  const record = asPlainRecord(value);
  const question = formattedTextValue(record?.question);
  return question ?? fallback;
}

function nestedFileName(value: unknown, fallback: string): string {
  const record = asPlainRecord(value);
  return typeof record?.file_name === 'string' && record.file_name.trim().length > 0
    ? record.file_name.trim()
    : fallback;
}

function stickerLabel(value: unknown): string {
  const record = asPlainRecord(value);
  return typeof record?.emoji === 'string' && record.emoji.trim().length > 0
    ? `${record.emoji.trim()} Sticker`
    : 'Sticker';
}

export function telegramOutgoingMessageRead(
  chat: JsonValue,
  messageIdValue: string
): boolean | null {
  const messageId = parseNonNegativeBigInt(messageIdValue);
  const record = asPlainRecord(chat);
  const lastReadOutboxMessageId = parseNonNegativeBigInt(
    record?.last_read_outbox_message_id ?? record?.lastReadOutboxMessageId
  );
  if (messageId === undefined || lastReadOutboxMessageId === undefined) {
    return null;
  }
  return messageId <= lastReadOutboxMessageId;
}
