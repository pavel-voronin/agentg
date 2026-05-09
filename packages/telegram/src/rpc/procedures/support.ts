import type { EventBus } from '@agentg/events/bus';
import {
  telegramChatRef,
  telegramMessageRef,
  telegramMessageSenderRef
} from '@agentg/telegram/model-refs';
import { and, asc, eq, ilike, inArray, sql, type SQL } from 'drizzle-orm';

import type { TelegramDatabase as AppDatabase } from '../../database.js';
import {
  asTdObject,
  extractFormattedTextLinkEntities,
  normalizeChat,
  type JsonObject,
  type TdObject
} from '../../normalize.js';
import {
  telegramChatFolders,
  telegramChats,
  telegramMessages,
  telegramUsers
} from '../../schema.js';
import { upsertChat } from '../../store.js';
import { invokeTdlibWithEvents } from '../../telegram-operation-events.js';
import type {
  TelegramChatDirectoryEntry,
  TelegramChatPlacement,
  TelegramChatTypeCount,
  TelegramHistoryChat,
  TelegramReadMessage
} from '../contracts.js';
import type { TelegramClient } from '../runtime.js';

type ChatListKind =
  | {
      kind: 'archive' | 'main';
    }
  | {
      folderId: number;
      kind: 'folder';
    };

export type TelegramChatStorageRow = {
  raw: JsonObject;
  telegramChatId: string;
  title: string;
  type: string;
  updatedAt: Date;
};

type TelegramMessageStorageRow = {
  contentType: string;
  deletedAt: Date | null;
  editDate: Date | null;
  isDeleted: boolean;
  messageDate: Date | null;
  raw: JsonObject;
  senderId: string | null;
  senderType: string | null;
  telegramChatId: string;
  telegramMessageId: string;
  text: string | null;
  updatedAt: Date;
};

type TelegramUserInfo = {
  isBot: boolean;
  isSelf: boolean;
  telegramUserId: string;
};

type TelegramSenderDisplayInfo = {
  displayName: string;
};

export async function discoverHistoryChats(
  database: AppDatabase,
  client: TelegramClient,
  eventBus: EventBus,
  loadBatchSize: number
): Promise<TelegramHistoryChat[]> {
  const folderIds = await listKnownFolderIds(database);
  await loadAllChats(client, eventBus, loadBatchSize, folderIds);
  const chatIds = dedupeTelegramIds([
    ...(await getChatIds(client, eventBus, { kind: 'main' }, 100000)),
    ...(await getChatIds(client, eventBus, { kind: 'archive' }, 100000)),
    ...(await getFolderChatIds(client, eventBus, folderIds, 100000))
  ]);
  const chats: TelegramHistoryChat[] = [];

  for (const chatId of chatIds) {
    const chat = await getChatOrUndefined(client, eventBus, chatId);
    const normalized = normalizeChat(chat);
    if (normalized === undefined) {
      continue;
    }
    if (!isListableChatRaw(normalized.raw)) {
      continue;
    }

    await upsertChat(database, normalized);
    if (isHistorySyncChatType(normalized.type)) {
      chats.push({
        _model: 'telegram.chat',
        id: normalized.id,
        title: normalized.title,
        type: normalized.type
      });
    }
  }

  return chats;
}

export async function listKnownHistoryChats(database: AppDatabase): Promise<TelegramHistoryChat[]> {
  const rows = await database
    .select({
      id: telegramChats.telegramChatId,
      raw: telegramChats.raw,
      title: telegramChats.title,
      type: telegramChats.type
    })
    .from(telegramChats)
    .orderBy(asc(telegramChats.telegramChatId));

  return rows.filter(isStoredHistorySyncChat).map((row) => ({
    _model: 'telegram.chat',
    id: row.id,
    title: row.title,
    type: row.type
  }));
}

export async function getLastMessageNoLaterThan(
  client: TelegramClient,
  eventBus: EventBus,
  chatId: number,
  end: Date
): Promise<TdObject | undefined> {
  try {
    return asTdObject(
      await invokeTdlib(eventBus, client, {
        _: 'getChatMessageByDate',
        chat_id: chatId,
        date: Math.floor((end.getTime() - 1) / 1000)
      })
    );
  } catch (error) {
    if (isTdlibNotFound(error)) {
      return undefined;
    }

    throw error;
  }
}

export async function invokeTdlib(
  eventBus: EventBus,
  client: TelegramClient,
  request: TdObject
): Promise<unknown> {
  for (;;) {
    try {
      return await invokeTdlibWithEvents(eventBus, client, request);
    } catch (error) {
      const floodWaitSeconds = parseFloodWaitSeconds(error);
      if (floodWaitSeconds === undefined) {
        throw error;
      }

      console.warn(
        JSON.stringify({
          event: 'telegram.flood_wait',
          request: request._,
          seconds: floodWaitSeconds
        })
      );
      await delay((floodWaitSeconds + 1) * 1000);
    }
  }
}

export function parseTelegramChatId(value: string): number {
  const text = requireString(value, 'telegram.history.fetch_page requires chatId');
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Telegram chat id must be numeric: ${text}`);
  }
  return parsed;
}

export function optionalTelegramMessageId(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isSafeInteger(value)) {
    throw new Error(`Telegram message id must be numeric: ${String(value)}`);
  }
  return value;
}

export function requireDate(value: unknown, message: string): Date {
  const text = requireString(value, message);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new Error(message);
  }
  return date;
}

export function parseLimit(value: unknown, fallback: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    return fallback;
  }

  return Math.min(value, max);
}

export function readMessageSelection() {
  return {
    contentType: telegramMessages.contentType,
    deletedAt: telegramMessages.deletedAt,
    editDate: telegramMessages.editDate,
    isDeleted: telegramMessages.isDeleted,
    messageDate: telegramMessages.messageDate,
    raw: telegramMessages.raw,
    senderId: telegramMessages.senderId,
    senderType: telegramMessages.senderType,
    telegramChatId: telegramMessages.telegramChatId,
    telegramMessageId: telegramMessages.telegramMessageId,
    text: telegramMessages.text,
    updatedAt: telegramMessages.updatedAt
  };
}

export function toReadMessage(message: TelegramMessageStorageRow): TelegramReadMessage {
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
    isOutgoing: message.raw.is_outgoing === true,
    messageDate: toNullableIsoString(message.messageDate),
    replyTo,
    sender: telegramMessageSenderRef(message.senderType, message.senderId),
    senderDisplayName: null,
    senderType: message.senderType,
    telegramMessageId: message.telegramMessageId,
    text: message.text,
    textEntities: telegramMessageTextEntities(message),
    updatedAt: message.updatedAt.toISOString()
  };
}

export async function toReadMessages(
  database: AppDatabase,
  messages: TelegramMessageStorageRow[]
): Promise<TelegramReadMessage[]> {
  const senderInfoByKey = await readSenderDisplayInfo(database, messages);

  return messages.map((message) => {
    const readMessage = toReadMessage(message);
    const senderKey = senderDisplayKey(message.senderType, message.senderId);
    if (senderKey === null) {
      return readMessage;
    }
    return {
      ...readMessage,
      senderDisplayName: senderInfoByKey.get(senderKey)?.displayName ?? null
    };
  });
}

export async function toDirectoryEntries(
  database: AppDatabase,
  chats: TelegramChatStorageRow[]
): Promise<TelegramChatDirectoryEntry[]> {
  const userIds = chats.map((chat) => telegramChatUserId(chat.raw)).filter(isDefined);
  const users =
    userIds.length === 0
      ? []
      : await database
          .select({
            isBot: telegramUsers.isBot,
            isSelf: telegramUsers.isSelf,
            telegramUserId: telegramUsers.telegramUserId
          })
          .from(telegramUsers)
          .where(inArray(telegramUsers.telegramUserId, userIds));
  const usersById = new Map(users.map((user) => [user.telegramUserId, user]));

  return chats.map((chat) => {
    const user = usersById.get(telegramChatUserId(chat.raw) ?? '');
    return toDirectoryEntry(chat, user);
  });
}

export async function getDirectoryEntryByChatId(
  database: AppDatabase,
  chatId: string
): Promise<TelegramChatDirectoryEntry | null> {
  const rows = await database
    .select({
      raw: telegramChats.raw,
      telegramChatId: telegramChats.telegramChatId,
      title: telegramChats.title,
      type: telegramChats.type,
      updatedAt: telegramChats.updatedAt
    })
    .from(telegramChats)
    .where(eq(telegramChats.telegramChatId, chatId))
    .limit(1);

  const [entry] = listableDirectoryEntries(await toDirectoryEntries(database, rows));
  return entry ?? null;
}

export function chatSearchWhere(value: string): SQL {
  return orSql(
    ilike(telegramChats.title, `%${value}%`),
    ilike(telegramChats.telegramChatId, `%${value}%`)
  );
}

export function andSql(...conditions: (SQL | undefined)[]): SQL | undefined {
  const defined = conditions.filter((condition): condition is SQL => condition !== undefined);
  return defined.length === 0 ? undefined : and(...defined);
}

export function listableDirectoryEntries(
  entries: TelegramChatDirectoryEntry[]
): TelegramChatDirectoryEntry[] {
  return entries.filter(isListableDirectoryEntry);
}

export function isListableDirectoryEntry(entry: TelegramChatDirectoryEntry): boolean {
  return entry.placements.length > 0;
}

export function chatTypeCounts(entries: TelegramChatDirectoryEntry[]): TelegramChatTypeCount[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([type, count]) => ({ count, type }));
}

export function tdMessageId(message: TdObject | undefined): number | undefined {
  return typeof message?.id === 'number' ? message.id : undefined;
}

export function tdMessageDate(message: TdObject | undefined): Date | undefined {
  return typeof message?.date === 'number' && message.date > 0
    ? new Date(message.date * 1000)
    : undefined;
}

export function isBeforeInterval(message: TdObject, startAt: Date): boolean {
  const messageDate = tdMessageDate(message);
  return messageDate !== undefined && messageDate < startAt;
}

export function oldestMessageDate(messages: TdObject[]): Date | undefined {
  const dates = messages.map(tdMessageDate).filter((date): date is Date => date !== undefined);
  const [first, ...rest] = dates;
  return first === undefined
    ? undefined
    : rest.reduce((oldest, date) => (date < oldest ? date : oldest), first);
}

export function oldestMessageIdOlderThan(
  messages: TdObject[],
  cursorMessageId: number
): number | undefined {
  const ids = messages
    .map(tdMessageId)
    .filter((id): id is number => id !== undefined && id < cursorMessageId);

  return ids.length === 0 ? undefined : Math.min(...ids);
}

export function isTdObject(value: TdObject | undefined): value is TdObject {
  return value !== undefined;
}

function toDirectoryEntry(
  chat: TelegramChatStorageRow,
  user: TelegramUserInfo | undefined
): TelegramChatDirectoryEntry {
  return {
    _model: 'telegram.chat',
    id: chat.telegramChatId,
    isBot: user?.isBot === true,
    isSelf: user?.isSelf === true,
    lastMessageDate: telegramChatLastMessageDate(chat.raw),
    placements: telegramChatPlacements(chat.raw),
    title: chat.type === 'private' && user?.isSelf === true ? 'Saved Messages' : chat.title,
    type: chat.type,
    updatedAt: chat.updatedAt.toISOString()
  };
}

function telegramChatPlacements(raw: JsonObject): TelegramChatPlacement[] {
  return chatPositions(raw)
    .map((position) => {
      const list = asPlainRecord(position.list);
      const order = parsePositiveBigInt(position.order);
      if (list === undefined || order === undefined) {
        return undefined;
      }

      const type = typeof list._ === 'string' ? list._ : undefined;
      if (type === 'chatListMain') {
        return {
          kind: 'main' as const,
          order: order.toString()
        };
      }
      if (type === 'chatListArchive') {
        return {
          kind: 'archive' as const,
          order: order.toString()
        };
      }
      if (type === 'chatListFolder') {
        const folderId = chatFolderId(list);
        return folderId === undefined
          ? undefined
          : {
              folderId,
              kind: 'folder' as const,
              order: order.toString()
            };
      }

      return undefined;
    })
    .filter(isDefined);
}

async function listKnownFolderIds(database: AppDatabase): Promise<number[]> {
  const rows = await database
    .select({
      id: telegramChatFolders.telegramChatFolderId
    })
    .from(telegramChatFolders)
    .orderBy(asc(telegramChatFolders.telegramChatFolderId));

  return rows.map((row) => row.id);
}

async function loadAllChats(
  client: TelegramClient,
  eventBus: EventBus,
  batchSize: number,
  folderIds: number[]
): Promise<void> {
  await loadAllChatsFromList(client, eventBus, { kind: 'main' }, batchSize);
  await loadAllChatsFromList(client, eventBus, { kind: 'archive' }, batchSize);
  for (const folderId of folderIds) {
    await loadAllChatsFromList(client, eventBus, { folderId, kind: 'folder' }, batchSize);
  }
}

async function loadAllChatsFromList(
  client: TelegramClient,
  eventBus: EventBus,
  chatList: ChatListKind,
  batchSize: number
): Promise<void> {
  for (;;) {
    try {
      await invokeTdlib(eventBus, client, {
        _: 'loadChats',
        chat_list: toTdChatList(chatList),
        limit: batchSize
      });
    } catch (error) {
      if (isTdlibNotFound(error)) {
        return;
      }

      throw error;
    }
  }
}

async function getChatIds(
  client: TelegramClient,
  eventBus: EventBus,
  chatList: ChatListKind,
  limit: number
): Promise<number[]> {
  let chats: TdObject | undefined;
  try {
    chats = asTdObject(
      await invokeTdlib(eventBus, client, {
        _: 'getChats',
        chat_list: toTdChatList(chatList),
        limit
      })
    );
  } catch (error) {
    if (isOptionalChatListNotFound(chatList, error)) {
      return [];
    }

    throw error;
  }

  return Array.isArray(chats?.chat_ids) ? chats.chat_ids.filter(isTelegramId) : [];
}

async function getFolderChatIds(
  client: TelegramClient,
  eventBus: EventBus,
  folderIds: number[],
  limit: number
): Promise<number[]> {
  const chatIds: number[] = [];
  for (const folderId of folderIds) {
    chatIds.push(...(await getChatIds(client, eventBus, { folderId, kind: 'folder' }, limit)));
  }
  return chatIds;
}

async function getChatOrUndefined(
  client: TelegramClient,
  eventBus: EventBus,
  chatId: number
): Promise<TdObject | undefined> {
  try {
    return asTdObject(await invokeTdlib(eventBus, client, { _: 'getChat', chat_id: chatId }));
  } catch (error) {
    if (isTdlibNotFound(error)) {
      return undefined;
    }

    throw error;
  }
}

function requireString(value: unknown, message: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  throw new Error(message);
}

function toNullableIsoString(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

function chatPositions(raw: JsonObject): Record<string, unknown>[] {
  return (Array.isArray(raw.positions) ? raw.positions : []).map(asPlainRecord).filter(isDefined);
}

function chatFolderId(list: Record<string, unknown> | undefined): number | undefined {
  const value = list?.chat_folder_id ?? list?.chatFolderId;
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}

function telegramChatLastMessageDate(raw: JsonObject): number {
  const lastMessage = asPlainRecord(raw.last_message) ?? asPlainRecord(raw.lastMessage);
  return typeof lastMessage?.date === 'number' && lastMessage.date > 0 ? lastMessage.date : 0;
}

function telegramChatUserId(raw: JsonObject): string | undefined {
  const type = asPlainRecord(raw.type);
  const userId = type?.user_id ?? type?.userId;
  return stringifyTelegramId(userId);
}

function telegramMessageReply(message: TelegramMessageStorageRow): TelegramReadMessage['replyTo'] {
  const reply = asPlainRecord(message.raw.reply_to);
  const messageId =
    stringifyTelegramId(reply?.message_id) ??
    stringifyTelegramId(reply?.messageId) ??
    stringifyTelegramId(message.raw.reply_to_message_id) ??
    stringifyTelegramId(message.raw.replyToMessageId);
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

function telegramMessageTextEntities(
  message: TelegramMessageStorageRow
): TelegramReadMessage['textEntities'] {
  const content = asPlainRecord(message.raw.content) ?? asPlainRecord(message.raw.new_content);
  return extractFormattedTextLinkEntities(content?.text);
}

async function readSenderDisplayInfo(
  database: AppDatabase,
  messages: TelegramMessageStorageRow[]
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
        telegramUserId: telegramUsers.telegramUserId,
        username: telegramUsers.username
      })
      .from(telegramUsers)
      .where(inArray(telegramUsers.telegramUserId, userIds));
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
        telegramChatId: telegramChats.telegramChatId,
        title: telegramChats.title
      })
      .from(telegramChats)
      .where(inArray(telegramChats.telegramChatId, chatIds));
    for (const chat of chats) {
      const key = senderDisplayKey('messageSenderChat', chat.telegramChatId);
      if (key !== null) {
        senderInfoByKey.set(key, {
          displayName: chat.title
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
  firstName: string;
  lastName: string;
  telegramUserId: string;
  username: string | null;
}): string {
  const name = [user.firstName, user.lastName].filter((part) => part.length > 0).join(' ');
  if (name.length > 0) {
    return name;
  }
  return user.username === null ? user.telegramUserId : `@${user.username}`;
}

function stringifyTelegramId(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return String(value);
  }
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return undefined;
}

function parsePositiveBigInt(value: unknown): bigint | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return BigInt(value);
  }

  if (typeof value === 'string' && /^[0-9]+$/.test(value)) {
    const parsed = BigInt(value);
    return parsed > 0n ? parsed : undefined;
  }

  return undefined;
}

function orSql(first: SQL, second: SQL): SQL {
  return sql`(${first} or ${second})`;
}

function toTdChatList(chatList: ChatListKind): TdObject {
  switch (chatList.kind) {
    case 'main':
      return { _: 'chatListMain' };
    case 'archive':
      return { _: 'chatListArchive' };
    case 'folder':
      return { _: 'chatListFolder', chat_folder_id: chatList.folderId };
  }
}

function isOptionalChatListNotFound(chatList: ChatListKind, error: unknown): boolean {
  return chatList.kind !== 'main' && isTdlibNotFound(error);
}

function isHistorySyncChat(chat: { raw: JsonObject; type: string }): boolean {
  return isHistorySyncChatType(chat.type) && isListableChatRaw(chat.raw);
}

function isStoredHistorySyncChat(row: { raw: JsonObject; type: string }): boolean {
  return isHistorySyncChat(row);
}

function isHistorySyncChatType(type: string): boolean {
  return type === 'private' || type === 'secret' || type === 'group' || type === 'channel';
}

function isListableChatRaw(raw: JsonObject): boolean {
  return telegramChatPlacements(raw).length > 0;
}

function parseFloodWaitSeconds(error: unknown): number | undefined {
  const message = error instanceof Error ? error.message : String(error);
  const match = /FLOOD(?:_PREMIUM)?_WAIT_(\d+)/.exec(message);
  return match?.[1] === undefined ? undefined : Number.parseInt(match[1], 10);
}

function isTdlibNotFound(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b404\b/.test(message) || message.includes('NOT_FOUND') || message.includes('Not Found');
}

function isTelegramId(value: unknown): value is number {
  return typeof value === 'number';
}

function dedupeTelegramIds(ids: number[]): number[] {
  return [...new Set(ids)];
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function isString(value: string | null | undefined): value is string {
  return typeof value === 'string';
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function asPlainRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

async function delay(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
