import type { EventBus } from '@agentg/events/bus';
import {
  telegramChatRef,
  telegramMessageRef,
  telegramMessageSenderRef
} from '@agentg/telegram/model-refs';
import type { JsonObject, JsonValue } from '@agentg/events/json';
import { and, asc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';

import type { TelegramDatabase as AppDatabase } from '../../database.js';
import {
  telegramChatFolderInfos,
  telegramChatPositions,
  telegramChats,
  telegramMessages,
  telegramUsers
} from '../../schema.js';
import { tdlibChat, tdlibChats } from '../../tdlib-schema/Chat.js';
import { tdlibIdNumber, type TdlibObject } from '../../tdlib-schema/common.js';
import { tdlibMessage, type TdlibMessage } from '../../tdlib-schema/Message.js';
import {
  readTelegramFileRefsForOwners,
  type TelegramFileOwnerKey
} from '../../telegram-file-read.js';
import { persistTelegramChat } from '../../telegram-chat-persistence.js';
import { persistTelegramMessage } from '../../telegram-message-persistence.js';
import { invokeTdlibWithEvents, type TdlibInvokeOptions } from '../../telegram-operation-events.js';
import { telegramTdlibPriorities } from '../../telegram-tdlib-priority.js';
import type {
  TelegramChatDirectoryEntry,
  TelegramChatPlacement,
  TelegramChatTypeCount,
  TelegramFileRef,
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
  chat: JsonObject;
  lastMessageId: string | null;
  telegramChatId: string;
  title: string;
  type: string;
};

type TelegramMessageStorageRow = {
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
};

export type TelegramDateLike = Date | number | string;

type TelegramUserInfo = {
  isBot: boolean;
  isPremium: boolean | null;
  telegramUserId: string;
};

type TelegramSenderRow = {
  senderId: string | null;
  senderType: string | null;
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
    if (chat === undefined) {
      continue;
    }
    if (!isListableChat(chat.chat)) {
      continue;
    }

    await database.transaction(async (transaction) => {
      if (chat.lastMessage !== null && chat.lastMessage !== undefined) {
        await persistTelegramMessage(transaction, chat.lastMessage);
      }

      await persistTelegramChat(transaction, chat);
    });
    if (isHistorySyncChatType(chat.type)) {
      chats.push({
        _model: 'telegram.chat',
        id: chat.id,
        title: chat.title,
        type: chat.type
      });
    }
  }

  return chats;
}

export async function listKnownHistoryChats(database: AppDatabase): Promise<TelegramHistoryChat[]> {
  const rows = await database
    .select(readChatSelection())
    .from(telegramChats)
    .orderBy(asc(telegramChats.id));
  const entries = listableDirectoryEntries(
    await toDirectoryEntries(database, rows.map(toTelegramChatStorageRow))
  );

  return entries
    .filter((entry) => isHistorySyncChatType(entry.type))
    .map((entry) => ({
      _model: 'telegram.chat',
      id: entry.id,
      title: entry.title,
      type: entry.type
    }));
}

export async function getLastMessageNoLaterThan(
  client: TelegramClient,
  eventBus: EventBus,
  chatId: number,
  end: Date,
  options: TdlibInvokeOptions = {}
): Promise<TdlibMessage | undefined> {
  try {
    return tdlibMessage(
      await invokeTdlib(
        eventBus,
        client,
        {
          _: 'getChatMessageByDate',
          chat_id: chatId,
          date: Math.floor((end.getTime() - 1) / 1000)
        },
        options
      )
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
  request: TdlibObject,
  options: TdlibInvokeOptions = {}
): Promise<unknown> {
  for (;;) {
    try {
      return await invokeTdlibWithEvents(eventBus, client, request, {
        ...options
      });
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
    text: messageTextExpression()
  };
}

export function readChatSelection() {
  return {
    isMarkedAsUnread: telegramChats.isMarkedAsUnread,
    lastMessageId: telegramChats.lastMessageId,
    lastReadInboxMessageId: telegramChats.lastReadInboxMessageId,
    lastReadOutboxMessageId: telegramChats.lastReadOutboxMessageId,
    notificationSettings: telegramChats.notificationSettings,
    telegramChatId: telegramChats.id,
    title: telegramChats.title,
    type: telegramChats.type,
    unreadCount: telegramChats.unreadCount
  };
}

export function messageTextExpression(): SQL<string | null> {
  return sql<string | null>`${telegramMessages.content}->'text'->>'text'`;
}

function messageReplyExpression(): SQL<JsonValue | null> {
  return sql<JsonValue | null>`${telegramMessages.replyTo}`;
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
    textEntities: []
  };
}

export async function toReadMessages(
  database: AppDatabase,
  messages: TelegramMessageStorageRow[]
): Promise<TelegramReadMessage[]> {
  const senderInfoByKey = await readSenderDisplayInfo(database, messages);
  const filesByOwner = await readTelegramFileRefsForOwners(
    database,
    messages.map((message) => ({
      ownerId: telegramMessageRef({
        chatId: message.telegramChatId,
        messageId: message.telegramMessageId
      }).id,
      ownerModel: 'telegram.message'
    }))
  );

  return messages.map((message) => {
    const readMessage = toReadMessage(
      message,
      filesByOwner.get(
        ownerKey({
          ownerId: telegramMessageRef({
            chatId: message.telegramChatId,
            messageId: message.telegramMessageId
          }).id,
          ownerModel: 'telegram.message'
        })
      ) ?? []
    );
    const senderKey = senderDisplayKey(message.senderType, message.senderId);
    return {
      ...readMessage,
      senderDisplayName:
        senderKey === null ? null : (senderInfoByKey.get(senderKey)?.displayName ?? null),
      serviceAction: null
    };
  });
}

export async function toDirectoryEntries(
  database: AppDatabase,
  chats: TelegramChatStorageRow[]
): Promise<TelegramChatDirectoryEntry[]> {
  const userIds = chats.map((chat) => telegramChatUserId(chat.chat)).filter(isDefined);
  const lastMessagesByChat = await readLastMessagesByChat(database, chats);
  const placementsByChat = await readChatPlacementsByChat(database, chats);
  const filesByOwner = await readTelegramFileRefsForOwners(
    database,
    chats.map((chat) => ({
      ownerId: chat.telegramChatId,
      ownerModel: 'telegram.chat'
    }))
  );
  const users =
    userIds.length === 0
      ? []
      : await database
          .select({
            isBot: sql<boolean>`coalesce(${telegramUsers.type}->>'_' = 'userTypeBot', false)`,
            isPremium: telegramUsers.isPremium,
            telegramUserId: telegramUsers.id
          })
          .from(telegramUsers)
          .where(inArray(telegramUsers.id, userIds));
  const usersById = new Map(users.map((user) => [user.telegramUserId, user]));

  return chats.map((chat) => {
    const user = usersById.get(telegramChatUserId(chat.chat) ?? '');
    return toDirectoryEntry(
      chat,
      user,
      filesByOwner.get(
        ownerKey({
          ownerId: chat.telegramChatId,
          ownerModel: 'telegram.chat'
        })
      ) ?? [],
      lastMessagesByChat.get(chat.telegramChatId) ?? null,
      placementsByChat.get(chat.telegramChatId) ?? []
    );
  });
}

async function readChatPlacementsByChat(
  database: AppDatabase,
  chats: TelegramChatStorageRow[]
): Promise<Map<string, TelegramChatPlacement[]>> {
  const chatIds = chats.map((chat) => chat.telegramChatId).filter((id) => id.length > 0);
  if (chatIds.length === 0) {
    return new Map();
  }

  const rows = await database
    .select({
      chatId: telegramChatPositions.chatId,
      isPinned: telegramChatPositions.isPinned,
      listKey: telegramChatPositions.listKey,
      order: telegramChatPositions.order
    })
    .from(telegramChatPositions)
    .where(inArray(telegramChatPositions.chatId, chatIds));
  const result = new Map<string, TelegramChatPlacement[]>();

  for (const row of rows) {
    const placement = telegramChatPlacementFromRow(row);
    if (placement === undefined) {
      continue;
    }
    const existing = result.get(row.chatId) ?? [];
    existing.push(placement);
    result.set(row.chatId, existing);
  }

  return result;
}

async function readLastMessagesByChat(
  database: AppDatabase,
  chats: TelegramChatStorageRow[]
): Promise<Map<string, TelegramReadMessage>> {
  const pairs = chats
    .map((chat) => ({
      chatId: chat.telegramChatId,
      messageId: chat.lastMessageId
    }))
    .filter((pair): pair is { chatId: string; messageId: string } => pair.messageId !== null);

  if (pairs.length === 0) {
    return new Map();
  }

  const rows = await database
    .select(readMessageSelection())
    .from(telegramMessages)
    .where(
      or(
        ...pairs.map((pair) =>
          and(eq(telegramMessages.chatId, pair.chatId), eq(telegramMessages.id, pair.messageId))
        )
      )
    );
  const messages = await toReadMessages(database, rows);
  return new Map(messages.map((message) => [message.chat.id, message]));
}

export async function getDirectoryEntryByChatId(
  database: AppDatabase,
  chatId: string
): Promise<TelegramChatDirectoryEntry | null> {
  const rows = await database
    .select(readChatSelection())
    .from(telegramChats)
    .where(eq(telegramChats.id, chatId))
    .limit(1);

  const [entry] = listableDirectoryEntries(
    await toDirectoryEntries(database, rows.map(toTelegramChatStorageRow))
  );
  return entry ?? null;
}

export function chatSearchWhere(value: string): SQL {
  return orSql(ilike(telegramChats.title, `%${value}%`), ilike(telegramChats.id, `%${value}%`));
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

export function tdMessageId(message: TdlibMessage | undefined): number | undefined {
  return tdlibIdNumber(message?.id);
}

export function tdMessageDate(message: TdlibMessage | undefined): Date | undefined {
  return message?.date;
}

export function isBeforeInterval(message: TdlibMessage, startAt: Date): boolean {
  const messageDate = tdMessageDate(message);
  return messageDate !== undefined && messageDate < startAt;
}

export function oldestMessageDate(messages: TdlibMessage[]): Date | undefined {
  const dates = messages.map(tdMessageDate).filter((date): date is Date => date !== undefined);
  const [first, ...rest] = dates;
  return first === undefined
    ? undefined
    : rest.reduce((oldest, date) => (date < oldest ? date : oldest), first);
}

export function oldestMessageIdOlderThan(
  messages: TdlibMessage[],
  cursorMessageId: number
): number | undefined {
  const ids = messages
    .map(tdMessageId)
    .filter((id): id is number => id !== undefined && id < cursorMessageId);

  return ids.length === 0 ? undefined : Math.min(...ids);
}

function toDirectoryEntry(
  chat: TelegramChatStorageRow,
  user: TelegramUserInfo | undefined,
  files: TelegramFileRef[],
  lastMessage: TelegramReadMessage | null,
  placements: TelegramChatPlacement[]
): TelegramChatDirectoryEntry {
  const unreadCount = telegramChatUnreadCount(chat.chat);
  const notificationsEnabled = telegramChatNotificationsEnabled(chat.chat);
  return {
    _model: 'telegram.chat',
    avatar: {
      big: files.find((file) => file.slotKey === 'avatar.big') ?? null,
      small: files.find((file) => file.slotKey === 'avatar.small') ?? null
    },
    id: chat.telegramChatId,
    isBot: user?.isBot === true,
    isPremium: user?.isPremium === true,
    isSelf: false,
    isUnread: telegramChatIsUnread(chat.chat, unreadCount),
    lastMessage: telegramChatLastMessage(chat.chat, lastMessage),
    lastMessageDate: lastMessage?.messageDate ?? null,
    notificationsEnabled: notificationsEnabled.value,
    notificationsPlaceholder: notificationsEnabled.placeholder,
    placements,
    title: chat.title,
    type: chat.type,
    unreadCount: unreadCount.value,
    unreadCountPlaceholder: unreadCount.placeholder,
    updatedAt: new Date(0).toISOString()
  };
}

function ownerKey(owner: TelegramFileOwnerKey): string {
  return `${owner.ownerModel}:${owner.ownerId}`;
}

function telegramChatPlacements(chat: JsonObject): TelegramChatPlacement[] {
  return chatPositions(chat)
    .map((position) => {
      const list = asPlainRecord(position.list);
      const order = parsePositiveBigInt(position.order);
      if (list === undefined || order === undefined) {
        return undefined;
      }

      const type = typeof list._ === 'string' ? list._ : undefined;
      if (type === 'chatListMain') {
        return {
          isPinned: position.is_pinned === true || position.isPinned === true,
          kind: 'main' as const,
          order: order.toString()
        };
      }
      if (type === 'chatListArchive') {
        return {
          isPinned: position.is_pinned === true || position.isPinned === true,
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
              isPinned: position.is_pinned === true || position.isPinned === true,
              kind: 'folder' as const,
              order: order.toString()
            };
      }

      return undefined;
    })
    .filter(isDefined);
}

function telegramChatPlacementFromRow(row: {
  isPinned: boolean;
  listKey: string;
  order: string;
}): TelegramChatPlacement | undefined {
  if (row.listKey === 'main') {
    return {
      isPinned: row.isPinned,
      kind: 'main',
      order: row.order
    };
  }
  if (row.listKey === 'archive') {
    return {
      isPinned: row.isPinned,
      kind: 'archive',
      order: row.order
    };
  }
  const folderMatch = /^folder:(\d+)$/.exec(row.listKey);
  if (folderMatch?.[1] === undefined) {
    return undefined;
  }
  return {
    folderId: Number(folderMatch[1]),
    isPinned: row.isPinned,
    kind: 'folder',
    order: row.order
  };
}

async function listKnownFolderIds(database: AppDatabase): Promise<number[]> {
  const rows = await database
    .select({
      folderId: telegramChatFolderInfos.id
    })
    .from(telegramChatFolderInfos)
    .orderBy(asc(telegramChatFolderInfos.position), asc(telegramChatFolderInfos.id));

  return rows.map((row) => row.folderId);
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
      await invokeTdlib(
        eventBus,
        client,
        {
          _: 'loadChats',
          chat_list: toTdChatList(chatList),
          limit: batchSize
        },
        { priority: telegramTdlibPriorities.maximum }
      );
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
  let chats: ReturnType<typeof tdlibChats> | undefined;
  try {
    chats = tdlibChats(
      await invokeTdlib(
        eventBus,
        client,
        {
          _: 'getChats',
          chat_list: toTdChatList(chatList),
          limit
        },
        { priority: telegramTdlibPriorities.maximum }
      )
    );
  } catch (error) {
    if (isOptionalChatListNotFound(chatList, error)) {
      return [];
    }

    throw error;
  }

  return chats.chat_ids;
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
): Promise<ReturnType<typeof tdlibChat> | undefined> {
  try {
    return tdlibChat(
      await invokeTdlib(
        eventBus,
        client,
        { _: 'getChat', chat_id: chatId },
        {
          priority: telegramTdlibPriorities.maximum
        }
      )
    );
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

export function toTelegramDate(value: TelegramDateLike | null): Date | null {
  if (value === null) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }

  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid Telegram date value: ${String(value)}`);
  }
  return date;
}

export function toNullableIsoString(value: TelegramDateLike | null): string | null {
  return toTelegramDate(value)?.toISOString() ?? null;
}

function chatPositions(chat: JsonObject): Record<string, unknown>[] {
  return (Array.isArray(chat.positions) ? chat.positions : []).map(asPlainRecord).filter(isDefined);
}

function chatFolderId(list: Record<string, unknown> | undefined): number | undefined {
  const value = list?.chat_folder_id ?? list?.chatFolderId;
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}

function telegramChatLastMessage(
  chat: JsonObject,
  message: TelegramReadMessage | null
): TelegramChatDirectoryEntry['lastMessage'] {
  if (message === null) {
    return null;
  }

  const preview = telegramReadMessagePreview(message);
  const isOutgoing = message.isOutgoing;
  const readState = isOutgoing
    ? telegramOutgoingMessageRead(chat, message.telegramMessageId)
    : null;

  return {
    authorName: message.senderDisplayName,
    authorPlaceholder: message.sender !== null && message.senderDisplayName === null,
    date: message.messageDate,
    datePlaceholder: message.messageDate === null,
    isForwarded: false,
    isOutgoing,
    isRead: readState,
    readPlaceholder: isOutgoing && readState === null,
    text: preview.text,
    textPlaceholder: preview.placeholder
  };
}

function telegramReadMessagePreview(message: TelegramReadMessage): {
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

function formattedTextValue(value: unknown): string | null {
  const formattedText = asPlainRecord(value);
  const text = typeof formattedText?.text === 'string' ? formattedText.text.trim() : '';
  return text.length === 0 ? null : text;
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

function telegramOutgoingMessageRead(chat: JsonObject, messageIdValue: string): boolean | null {
  const messageId = parseNonNegativeBigInt(messageIdValue);
  const lastReadOutboxMessageId = parseNonNegativeBigInt(
    chat.last_read_outbox_message_id ?? chat.lastReadOutboxMessageId
  );
  if (messageId === undefined || lastReadOutboxMessageId === undefined) {
    return null;
  }
  return messageId <= lastReadOutboxMessageId;
}

function telegramChatUnreadCount(chat: JsonObject): { placeholder: boolean; value: number } {
  const value = chat.unread_count ?? chat.unreadCount;
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? { placeholder: false, value }
    : { placeholder: true, value: 0 };
}

function telegramChatIsUnread(
  chat: JsonObject,
  unreadCount: { placeholder: boolean; value: number }
): boolean {
  if (unreadCount.value > 0) {
    return true;
  }
  const marked = chat.is_marked_as_unread ?? chat.isMarkedAsUnread;
  return typeof marked === 'boolean' ? marked : false;
}

function telegramChatNotificationsEnabled(chat: JsonObject): {
  placeholder: boolean;
  value: boolean | null;
} {
  const settings =
    asPlainRecord(chat.notification_settings) ?? asPlainRecord(chat.notificationSettings);
  const muteFor = settings?.mute_for ?? settings?.muteFor;
  if (typeof muteFor === 'number' && Number.isSafeInteger(muteFor) && muteFor >= 0) {
    return {
      placeholder: false,
      value: muteFor === 0
    };
  }
  return {
    placeholder: true,
    value: null
  };
}

function telegramChatUserId(chat: JsonObject): string | undefined {
  const type = asPlainRecord(chat.type);
  const userId = type?.user_id ?? type?.userId;
  return stringifyTelegramId(userId);
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
  database: AppDatabase,
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

function stringifyTelegramId(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return String(value);
  }
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return undefined;
}

export function toTelegramChatStorageRow(row: {
  isMarkedAsUnread?: boolean | null;
  lastMessageId?: string | null;
  lastReadInboxMessageId?: string | null;
  lastReadOutboxMessageId?: string | null;
  notificationSettings?: JsonValue | null;
  telegramChatId?: string | null;
  id?: string | null;
  title: string | null;
  type: JsonValue | null;
  unreadCount?: number | null;
}): TelegramChatStorageRow {
  const chat: JsonObject = {};
  assignJsonField(chat, 'type', row.type);
  assignJsonField(chat, 'notification_settings', row.notificationSettings);
  assignScalarField(chat, 'is_marked_as_unread', row.isMarkedAsUnread);
  assignScalarField(chat, 'last_message_id', row.lastMessageId);
  assignScalarField(chat, 'last_read_inbox_message_id', row.lastReadInboxMessageId);
  assignScalarField(chat, 'last_read_outbox_message_id', row.lastReadOutboxMessageId);
  assignScalarField(chat, 'unread_count', row.unreadCount);

  return {
    chat,
    lastMessageId: row.lastMessageId ?? null,
    telegramChatId: row.telegramChatId ?? row.id ?? '',
    title: row.title ?? '',
    type: telegramChatTypeLabel(row.type, chat)
  };
}

function telegramChatTypeLabel(value: JsonValue | null, chat: JsonObject): string {
  const type = asPlainRecord(value) ?? asPlainRecord(chat.type);
  if (type?._ === 'chatTypePrivate') {
    return 'private';
  }
  if (type?._ === 'chatTypeSecret') {
    return 'secret';
  }
  if (type?._ === 'chatTypeBasicGroup') {
    return 'group';
  }
  if (type?._ === 'chatTypeSupergroup') {
    return type.is_channel === true || type.isChannel === true ? 'channel' : 'group';
  }
  return typeof type?._ === 'string' ? type._ : 'unknown';
}

function assignJsonField(target: JsonObject, key: string, value: JsonValue | null | undefined) {
  if (value !== null && value !== undefined) {
    target[key] = value;
  }
}

function assignScalarField(
  target: JsonObject,
  key: string,
  value: boolean | number | string | null | undefined
) {
  if (value !== null && value !== undefined) {
    target[key] = value;
  }
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

function parseNonNegativeBigInt(value: unknown): bigint | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return BigInt(value);
  }

  if (typeof value === 'string' && /^[0-9]+$/.test(value)) {
    return BigInt(value);
  }

  return undefined;
}

function orSql(first: SQL, second: SQL): SQL {
  return sql`(${first} or ${second})`;
}

function toTdChatList(chatList: ChatListKind): TdlibObject {
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

function isHistorySyncChatType(type: string): boolean {
  return type === 'private' || type === 'secret' || type === 'group' || type === 'channel';
}

function isListableChat(chat: JsonObject): boolean {
  return telegramChatPlacements(chat).length > 0;
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
