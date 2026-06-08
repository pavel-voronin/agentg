import { timeTelemetrySpan, type JsonValue } from '@agentg/framework';
import { inArray, sql } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import { telegramChats, telegramMessages, telegramUsers } from '../database/schema.js';
import { chatRef, messageRef, messageSenderRef } from '../model/refs.js';
import { ownerKey, readFileRefsForOwners } from '../files/read.js';
import type { FileOwnerKey } from '../files/types.js';
import type { FileRef, MessageReaction, MessageTextEntity, ReadMessage } from './schemas.js';
import { toNullableIsoString, type DateLike } from './date.js';
import { asPlainRecord, parseNonNegativeBigInt, stringifyTelegramId } from './chat.js';
import { extractFormattedTextLinkEntities, formattedTextValue } from './messageText.js';

const METRIC_MESSAGE_VIEW_STAGE_DURATION = 'telegram.message_view.stage.duration';

export type MessageStorageRow = {
  contentType: string;
  deletedAt: DateLike | null;
  editDate: DateLike | null;
  isDeleted: boolean;
  isOutgoing: boolean;
  messageDate: DateLike | null;
  reactions: JsonValue | null;
  replyTo: JsonValue | null;
  senderId: string | null;
  senderType: string | null;
  telegramChatId: string;
  telegramMessageId: string;
  text: string | null;
  textEntities: JsonValue | null;
};

type SenderRow = {
  senderId: string | null;
  senderType: string | null;
};

type SenderDisplayInfo = {
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
    reactions: telegramMessages.reactions,
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

export function toReadMessage(message: MessageStorageRow, files: FileRef[] = []): ReadMessage {
  const replyTo = telegramMessageReply(message);

  return {
    ...messageRef({
      chatId: message.telegramChatId,
      messageId: message.telegramMessageId
    }),
    chat: chatRef(message.telegramChatId),
    contentType: message.contentType,
    deletedAt: toNullableIsoString(message.deletedAt),
    editDate: toNullableIsoString(message.editDate),
    isDeleted: message.isDeleted,
    isOutgoing: message.isOutgoing,
    media: {
      files
    },
    messageDate: toNullableIsoString(message.messageDate),
    reactions: messageReactionsFromStorage(message.reactions),
    replyTo,
    sender: messageSenderRef(message.senderType, message.senderId),
    senderDisplayName: null,
    senderType: message.senderType,
    serviceAction: null,
    telegramMessageId: message.telegramMessageId,
    text: message.text,
    textEntities: messageTextEntitiesFromStorage(message.text, message.textEntities)
  };
}

function messageReactionsFromStorage(value: JsonValue | null): MessageReaction[] {
  if (!isJsonObject(value) || !Array.isArray(value.reactions)) {
    return [];
  }
  return value.reactions.map(messageReactionFromStorage).filter(isDefined);
}

function messageReactionFromStorage(value: JsonValue): MessageReaction | undefined {
  const reaction = asPlainRecord(value);
  const reactionType = messageReactionTypeKey(asPlainRecord(reaction?.type));
  const totalCount = nonNegativeInteger(reaction?.total_count);
  if (reactionType === undefined || totalCount === undefined) {
    return undefined;
  }
  return {
    isChosen: reaction?.is_chosen === true,
    reactionType,
    recentSenderIds: Array.isArray(reaction?.recent_sender_ids) ? reaction.recent_sender_ids : [],
    totalCount,
    usedSenderId: reaction?.used_sender_id ?? null
  };
}

function messageReactionTypeKey(reaction: Record<string, unknown> | undefined): string | undefined {
  if (reaction?._ === 'reactionTypeEmoji' && typeof reaction.emoji === 'string') {
    return `emoji:${reaction.emoji}`;
  }
  if (
    reaction?._ === 'reactionTypeCustomEmoji' &&
    (typeof reaction.custom_emoji_id === 'number' || typeof reaction.custom_emoji_id === 'string')
  ) {
    return `custom_emoji:${String(reaction.custom_emoji_id)}`;
  }
  return reaction?._ === 'reactionTypePaid' ? 'paid' : undefined;
}

function nonNegativeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function isJsonObject(value: JsonValue | null): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

export function messageTextEntitiesFromStorage(
  text: string | null,
  entities: JsonValue | null | undefined
): MessageTextEntity[] {
  if (text === null) {
    return [];
  }
  return extractFormattedTextLinkEntities({
    entities: Array.isArray(entities) ? entities : [],
    text
  });
}

export async function toReadMessages(
  database: Database,
  messages: MessageStorageRow[]
): Promise<ReadMessage[]> {
  const senderInfoByKey = await timeMessageViewStage('sender_lookup', () =>
    readSenderDisplayInfo(database, messages)
  );
  const filesByOwner = await timeMessageViewStage('file_hydration', () =>
    readFileRefsForOwners(database, messageFileOwners(messages))
  );

  return timeMessageViewStage('assemble', () =>
    Promise.resolve(
      messages.map((message) => {
        const messageOwner = telegramMessageFileOwner(message);
        const readMessage = toReadMessage(message, filesByOwner.get(ownerKey(messageOwner)) ?? []);
        const senderKey = senderDisplayKey(message.senderType, message.senderId);
        return {
          ...readMessage,
          senderDisplayName:
            senderKey === null ? null : (senderInfoByKey.get(senderKey)?.displayName ?? null),
          serviceAction: null
        };
      })
    )
  );
}

function timeMessageViewStage<T>(stage: string, operation: () => Promise<T>): Promise<T> {
  const attributes = {
    'telegram.message_view.stage': stage
  };
  return timeTelemetrySpan(
    {
      attributes,
      metric: {
        attributes,
        name: METRIC_MESSAGE_VIEW_STAGE_DURATION
      },
      name: `telegram.message_view.${stage}`
    },
    operation
  );
}

function messageReplyExpression() {
  return sql<JsonValue | null>`${telegramMessages.replyTo}`;
}

function messageFileOwners(messages: MessageStorageRow[]): FileOwnerKey[] {
  return messages.map(telegramMessageFileOwner);
}

function telegramMessageFileOwner(message: MessageStorageRow): FileOwnerKey {
  return {
    ownerId: messageRef({
      chatId: message.telegramChatId,
      messageId: message.telegramMessageId
    }).id,
    ownerModel: 'telegram.message'
  };
}

function telegramMessageReply(message: MessageStorageRow): ReadMessage['replyTo'] {
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
    chat: chatRef(chatId),
    message: messageRef({ chatId, messageId }),
    telegramMessageId: messageId
  };
}

async function readSenderDisplayInfo(
  database: Database,
  messages: SenderRow[]
): Promise<Map<string, SenderDisplayInfo>> {
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
  const senderInfoByKey = new Map<string, SenderDisplayInfo>();

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

export function telegramReadMessagePreview(message: ReadMessage): {
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

export function telegramOutgoingMessageRead(chat: unknown, messageIdValue: string): boolean | null {
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
