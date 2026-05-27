import { telegramChatFolderRef } from '@agentg/telegram/model-refs';
import type { JsonObject } from '@agentg/events/json';
import { and, eq, inArray, or, sql } from 'drizzle-orm';

import type { TelegramDatabase } from '../database.js';
import {
  telegramChatPositions,
  telegramChats,
  telegramMessages,
  telegramUsers
} from '../schema.js';
import {
  ownerKey,
  readTelegramFileRefsForOwners,
  type TelegramFileOwnerKey
} from '../telegramFileRead.js';
import type {
  TelegramChatDirectoryEntry,
  TelegramChatFolder,
  TelegramChatPlacement,
  TelegramChatTypeCount,
  TelegramFileRef,
  TelegramReadMessage
} from '../rpc/contracts.js';
import {
  asPlainRecord,
  parsePositiveBigInt,
  readChatSelection,
  stringifyTelegramId,
  type TelegramChatStorageRow,
  toTelegramChatStorageRow
} from './chat.js';
import {
  readMessageSelection,
  telegramOutgoingMessageRead,
  telegramReadMessagePreview,
  toReadMessages
} from './message.js';

type TelegramUserInfo = {
  isBot: boolean;
  isPremium: boolean | null;
  telegramUserId: string;
};

export async function toDirectoryEntries(
  database: TelegramDatabase,
  chats: TelegramChatStorageRow[]
): Promise<TelegramChatDirectoryEntry[]> {
  const userIds = chats.map((chat) => telegramChatUserId(chat.chat)).filter(isDefined);
  const lastMessagesByChat = await readLastMessagesByChat(database, chats);
  const placementsByChat = await readChatPlacementsByChat(database, chats);
  const filesByOwner = await readTelegramFileRefsForOwners(database, chatFileOwners(chats));
  const users =
    userIds.length === 0
      ? []
      : await database
          .select({
            isBot: sqlBooleanUserIsBot(),
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
      filesByOwner.get(ownerKey(chatFileOwner(chat))) ?? [],
      lastMessagesByChat.get(chat.telegramChatId) ?? null,
      placementsByChat.get(chat.telegramChatId) ?? []
    );
  });
}

export async function getDirectoryEntryByChatId(
  database: TelegramDatabase,
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

export function chatFolderEntry(folder: {
  icon: unknown;
  id: number;
  name: unknown;
  position: number;
}): TelegramChatFolder {
  return {
    ...telegramChatFolderRef(folder.id),
    folderId: folder.id,
    iconName: chatFolderIconName(folder.icon),
    position: folder.position,
    title: chatFolderTitle(folder)
  };
}

export function telegramChatPlacements(chat: JsonObject): TelegramChatPlacement[] {
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

export function telegramChatTypeCounts(databaseEntries: TelegramChatDirectoryEntry[]) {
  return chatTypeCounts(databaseEntries);
}

async function readChatPlacementsByChat(
  database: TelegramDatabase,
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
  database: TelegramDatabase,
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

function chatFileOwners(chats: TelegramChatStorageRow[]): TelegramFileOwnerKey[] {
  return chats.map(chatFileOwner);
}

function chatFileOwner(chat: TelegramChatStorageRow): TelegramFileOwnerKey {
  return {
    ownerId: chat.telegramChatId,
    ownerModel: 'telegram.chat'
  };
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

function chatFolderTitle(folder: { id: number; name: unknown }): string {
  const name = asPlainRecord(folder.name);
  const text = asPlainRecord(name?.text);
  return typeof text?.text === 'string' ? text.text : `Folder ${String(folder.id)}`;
}

function chatFolderIconName(value: unknown): string | null {
  const icon = asPlainRecord(value);
  return typeof icon?.name === 'string' ? icon.name : null;
}

function sqlBooleanUserIsBot() {
  return sql<boolean>`coalesce(${telegramUsers.type}->>'_' = 'userTypeBot', false)`;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
