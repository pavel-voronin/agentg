import { createHash } from 'node:crypto';

import type { JsonObject, JsonValue } from '../bus/events.js';

export type { JsonObject, JsonValue } from '../bus/events.js';

export type TdObject = {
  _: string;
  [key: string]: unknown;
};

export type RawTelegramEvent = {
  eventKey: string;
  eventType: string;
  payload: JsonObject;
  payloadHash: string;
  tdlibUpdateType: string;
  occurredAt?: Date;
  telegramChatId?: string;
  telegramMessageId?: string;
};

export type NormalizedTelegramChat = {
  id: string;
  raw: JsonObject;
  title: string;
  type: string;
};

export type NormalizedTelegramUser = {
  firstName: string;
  id: string;
  isBot: boolean;
  lastName: string;
  raw: JsonObject;
  isSelf?: boolean;
  username?: string;
};

export type NormalizedTelegramChatFolder = {
  id: number;
  position: number;
  raw: JsonObject;
  title: string;
  iconName?: string;
};

export type NormalizedTelegramChatFolders = {
  folders: NormalizedTelegramChatFolder[];
  raw: JsonObject;
};

export type NormalizedTelegramMessage = {
  chatId: string;
  contentType: string;
  messageId: string;
  raw: JsonObject;
  editDate?: Date;
  messageDate?: Date;
  senderId?: string;
  senderType?: string;
  text?: string;
};

export type NormalizedTelegramMessageContentUpdate = {
  chatId: string;
  contentType: string;
  messageId: string;
  raw: JsonObject;
  editDate?: Date;
  text?: string;
};

export type NormalizedTelegramMessageDelete = {
  chatId: string;
  deletedAt: Date;
  fromCache: boolean;
  isPermanent: boolean;
  messageIds: string[];
};

export type NormalizedTelegramUpdate = {
  chat?: NormalizedTelegramChat;
  chatFolders?: NormalizedTelegramChatFolders;
  contentUpdate?: NormalizedTelegramMessageContentUpdate;
  delete?: NormalizedTelegramMessageDelete;
  event?: RawTelegramEvent;
  message?: NormalizedTelegramMessage;
  user?: NormalizedTelegramUser;
};

export function normalizeTelegramUpdate(update: unknown): NormalizedTelegramUpdate | undefined {
  const tdUpdate = asTdObject(update);
  if (tdUpdate === undefined) {
    return undefined;
  }

  const normalized: NormalizedTelegramUpdate = {};

  if (tdUpdate._ === 'updateNewChat') {
    const chat = asTdObject(tdUpdate.chat);
    const normalizedChat = normalizeChat(chat);
    if (normalizedChat !== undefined) {
      normalized.chat = normalizedChat;
    }
  } else if (tdUpdate._ === 'updateUser') {
    const user = asTdObject(tdUpdate.user);
    const normalizedUser = normalizeUser(user);
    if (normalizedUser !== undefined) {
      normalized.user = normalizedUser;
    }
  } else if (tdUpdate._ === 'updateChatFolders') {
    const chatFolders = normalizeChatFolders(tdUpdate);
    if (chatFolders !== undefined) {
      normalized.chatFolders = chatFolders;
    }
  } else if (tdUpdate._ === 'updateNewMessage') {
    const message = asTdObject(tdUpdate.message);
    const normalizedMessage = normalizeMessage(message);
    if (normalizedMessage !== undefined) {
      normalized.message = normalizedMessage;
    }
  } else if (tdUpdate._ === 'updateMessageContent') {
    const contentUpdate = normalizeMessageContentUpdate(tdUpdate);
    if (contentUpdate !== undefined) {
      normalized.contentUpdate = contentUpdate;
    }
  } else if (tdUpdate._ === 'updateDeleteMessages') {
    const deletedMessages = normalizeMessageDelete(tdUpdate);
    if (deletedMessages !== undefined) {
      normalized.delete = deletedMessages;
    }
  }

  normalized.event = normalizeRawEvent(tdUpdate, normalized);

  return normalized;
}

export function normalizeChatFolders(
  update: TdObject | undefined
): NormalizedTelegramChatFolders | undefined {
  if (update === undefined || !Array.isArray(update.chat_folders)) {
    return undefined;
  }

  const folders = update.chat_folders
    .map(asTdObject)
    .filter((folder): folder is TdObject => folder !== undefined)
    .map(normalizeChatFolderInfo)
    .filter((folder): folder is NormalizedTelegramChatFolder => folder !== undefined);

  return {
    folders,
    raw: toJsonObject(update)
  };
}

export function normalizeMessageContentUpdate(
  update: TdObject | undefined
): NormalizedTelegramMessageContentUpdate | undefined {
  if (update === undefined) {
    return undefined;
  }

  const chatId = stringifyTelegramId(update.chat_id);
  const messageId = stringifyTelegramId(update.message_id);
  if (chatId === undefined || messageId === undefined) {
    return undefined;
  }

  const content = asTdObject(update.new_content);
  const editDate = unixSecondsToDate(update.edit_date);
  const text = extractMessageText(content);

  return {
    chatId,
    contentType: content?._ ?? 'unknown',
    messageId,
    raw: toJsonObject(update),
    ...(editDate === undefined ? {} : { editDate }),
    ...(text === undefined ? {} : { text })
  };
}

export function normalizeMessageDelete(
  update: TdObject | undefined
): NormalizedTelegramMessageDelete | undefined {
  if (update === undefined) {
    return undefined;
  }

  const chatId = stringifyTelegramId(update.chat_id);
  const messageIds = Array.isArray(update.message_ids)
    ? update.message_ids.map(stringifyTelegramId).filter(isString)
    : [];

  if (chatId === undefined || messageIds.length === 0) {
    return undefined;
  }

  return {
    chatId,
    deletedAt: new Date(),
    fromCache: update.from_cache === true,
    isPermanent: update.is_permanent === true,
    messageIds
  };
}

export function normalizeHistoricalMessage(message: unknown): NormalizedTelegramUpdate | undefined {
  const tdMessage = asTdObject(message);
  const normalizedMessage = normalizeMessage(tdMessage);
  if (tdMessage === undefined || normalizedMessage === undefined) {
    return undefined;
  }

  return {
    event: normalizeHistoricalMessageEvent(tdMessage, normalizedMessage),
    message: normalizedMessage
  };
}

export function normalizeChat(chat: TdObject | undefined): NormalizedTelegramChat | undefined {
  if (chat === undefined) {
    return undefined;
  }

  const id = stringifyTelegramId(chat.id);
  if (id === undefined) {
    return undefined;
  }

  return {
    id,
    raw: toJsonObject(chat),
    title: typeof chat.title === 'string' ? chat.title : '',
    type: normalizeChatType(chat.type)
  };
}

export function normalizeUser(
  user: TdObject | undefined,
  options: { isSelf?: boolean } = {}
): NormalizedTelegramUser | undefined {
  if (user === undefined) {
    return undefined;
  }

  const id = stringifyTelegramId(user.id);
  if (id === undefined) {
    return undefined;
  }

  const username = extractActiveUsername(user);

  return {
    firstName: typeof user.first_name === 'string' ? user.first_name : '',
    id,
    isBot: extractTdType(user.type) === 'userTypeBot',
    ...(options.isSelf === true ? { isSelf: true } : {}),
    lastName: typeof user.last_name === 'string' ? user.last_name : '',
    raw: toJsonObject(user),
    ...(username === undefined ? {} : { username })
  };
}

export function normalizeMessage(
  message: TdObject | undefined
): NormalizedTelegramMessage | undefined {
  if (message === undefined) {
    return undefined;
  }

  const chatId = stringifyTelegramId(message.chat_id);
  const messageId = stringifyTelegramId(message.id);
  if (chatId === undefined || messageId === undefined) {
    return undefined;
  }

  const content = asTdObject(message.content);
  const sender = asTdObject(message.sender_id);
  const editDate = unixSecondsToDate(message.edit_date);
  const messageDate = unixSecondsToDate(message.date);
  const senderId = extractSenderId(sender);
  const text = extractMessageText(content);

  return {
    chatId,
    contentType: content?._ ?? 'unknown',
    messageId,
    raw: toJsonObject(message),
    ...(editDate === undefined ? {} : { editDate }),
    ...(messageDate === undefined ? {} : { messageDate }),
    ...(sender?._ === undefined ? {} : { senderType: sender._ }),
    ...(senderId === undefined ? {} : { senderId }),
    ...(text === undefined ? {} : { text })
  };
}

function normalizeRawEvent(
  update: TdObject,
  normalized: NormalizedTelegramUpdate
): RawTelegramEvent {
  const payload = toJsonObject(update);
  const payloadHash = hashPayload(payload);
  const message = normalized.message;
  const chat = normalized.chat;
  const contentUpdate = normalized.contentUpdate;
  const deletedMessages = normalized.delete;
  const occurredAt = message?.messageDate ?? contentUpdate?.editDate ?? deletedMessages?.deletedAt;
  const telegramChatId =
    message?.chatId ?? chat?.id ?? contentUpdate?.chatId ?? deletedMessages?.chatId;
  const telegramMessageId =
    message?.messageId ?? contentUpdate?.messageId ?? deletedMessages?.messageIds[0];

  return {
    eventKey: [update._, telegramChatId ?? '', telegramMessageId ?? '', payloadHash].join(':'),
    eventType: mapEventType(update._),
    payload,
    payloadHash,
    tdlibUpdateType: update._,
    ...(occurredAt === undefined ? {} : { occurredAt }),
    ...(telegramChatId === undefined ? {} : { telegramChatId }),
    ...(telegramMessageId === undefined ? {} : { telegramMessageId })
  };
}

function normalizeHistoricalMessageEvent(
  message: TdObject,
  normalized: NormalizedTelegramMessage
): RawTelegramEvent {
  const payload = toJsonObject({
    _: 'messageBackfilled',
    message
  });
  const payloadHash = hashPayload(payload);

  return {
    eventKey: ['messageBackfilled', normalized.chatId, normalized.messageId].join(':'),
    eventType: 'message_backfilled',
    payload,
    payloadHash,
    tdlibUpdateType: 'getChatHistory.message',
    telegramChatId: normalized.chatId,
    telegramMessageId: normalized.messageId,
    ...(normalized.messageDate === undefined ? {} : { occurredAt: normalized.messageDate })
  };
}

function extractMessageText(content: TdObject | undefined): string | undefined {
  if (content?._ !== 'messageText') {
    return undefined;
  }

  const text = asRecord(content.text);
  return typeof text?.text === 'string' ? text.text : undefined;
}

function extractSenderId(sender: TdObject | undefined): string | undefined {
  const userId = stringifyTelegramId(sender?.user_id);
  if (userId !== undefined) {
    return userId;
  }

  const chatId = stringifyTelegramId(sender?.chat_id);
  if (chatId !== undefined) {
    return chatId;
  }

  return undefined;
}

function extractActiveUsername(user: TdObject): string | undefined {
  const usernames = asRecord(user.usernames);
  const activeUsernames = usernames?.active_usernames;

  return Array.isArray(activeUsernames) && typeof activeUsernames[0] === 'string'
    ? activeUsernames[0]
    : undefined;
}

function normalizeChatFolderInfo(
  folder: TdObject,
  position: number
): NormalizedTelegramChatFolder | undefined {
  const id = extractSafeInteger(folder.id ?? folder.chat_folder_id ?? folder.chatFolderId);
  if (id === undefined) {
    return undefined;
  }

  const title = extractChatFolderTitle(folder) ?? `Folder ${String(id)}`;
  const iconName = extractChatFolderIconName(folder);

  return {
    id,
    position,
    raw: toJsonObject(folder),
    title,
    ...(iconName === undefined ? {} : { iconName })
  };
}

function extractChatFolderTitle(folder: TdObject): string | undefined {
  const name = asRecord(folder.name);
  const formattedText = asRecord(name?.text);
  const formattedTitle = asRecord(folder.title);
  const candidates = [
    formattedText?.text,
    name?.text,
    folder.title,
    formattedTitle?.text,
    folder.name
  ];

  return candidates.find((value): value is string => typeof value === 'string' && value.length > 0);
}

function extractChatFolderIconName(folder: TdObject): string | undefined {
  const icon = asRecord(folder.icon);
  return typeof icon?.name === 'string' && icon.name.length > 0 ? icon.name : undefined;
}

function mapEventType(tdlibUpdateType: string): string {
  if (tdlibUpdateType === 'updateNewMessage') {
    return 'message_created';
  }
  if (tdlibUpdateType === 'updateNewChat') {
    return 'chat_seen';
  }
  if (tdlibUpdateType === 'updateUser') {
    return 'user_seen';
  }
  if (tdlibUpdateType === 'updateChatFolders') {
    return 'chat_folders_updated';
  }
  if (tdlibUpdateType === 'updateMessageContent') {
    return 'message_content_updated';
  }
  if (tdlibUpdateType === 'updateDeleteMessages') {
    return 'messages_deleted';
  }

  return 'tdlib_update';
}

function hashPayload(payload: JsonObject): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function unixSecondsToDate(value: unknown): Date | undefined {
  return typeof value === 'number' && value > 0 ? new Date(value * 1000) : undefined;
}

function extractSafeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}

function extractTdType(value: unknown): string {
  return asTdObject(value)?._ ?? 'unknown';
}

function normalizeChatType(value: unknown): string {
  const type = asTdObject(value);
  if (type === undefined) {
    return 'unknown';
  }
  if (type._ === 'chatTypePrivate') {
    return 'private';
  }
  if (type._ === 'chatTypeSecret') {
    return 'secret';
  }
  if (type._ === 'chatTypeBasicGroup') {
    return 'group';
  }
  if (type._ === 'chatTypeSupergroup') {
    return type.is_channel === true || type.isChannel === true ? 'channel' : 'group';
  }

  return type._;
}

function stringifyTelegramId(value: unknown): string | undefined {
  if (typeof value === 'number' || typeof value === 'string') {
    return String(value);
  }

  return undefined;
}

function isString(value: string | undefined): value is string {
  return value !== undefined;
}

export function asTdObject(value: unknown): TdObject | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  return typeof record._ === 'string' ? (record as TdObject) : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function toJsonObject(value: unknown): JsonObject {
  const parsed: unknown = JSON.parse(JSON.stringify(value));
  return sanitizeJsonValue(parsed as JsonValue) as JsonObject;
}

function sanitizeJsonValue(value: JsonValue): JsonValue {
  if (typeof value === 'string') {
    return value.replaceAll('\u0000', '\\u0000');
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeJsonValue);
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeJsonValue(entry)])
    );
  }

  return value;
}
