import { telegramChatFolderRef } from '@agentg/telegram/model-refs';
import type { JsonObject } from '@agentg/events/json';
import { and, eq, inArray, or } from 'drizzle-orm';

import type { TelegramDatabase } from '../../database/client.js';
import { telegramChatPositions, telegramChats, telegramMessages } from '../../database/schema.js';
import {
  ownerKey,
  readTelegramFileRefsForOwners,
  type TelegramFileOwnerKey
} from '../../files/read.js';
import type { ChatDirectoryEntry, ChatFolder, ChatTypeCount } from './contracts.js';
import type { TelegramFileRef, TelegramReadMessage } from '../../rpc/contracts.js';
import {
  asPlainRecord,
  readChatSelection,
  type TelegramChatStorageRow,
  toTelegramChatStorageRow
} from '../../read-model/chat.js';
import type { TelegramChatPlacement } from '../../read-model/chatPlacements.js';
import {
  readTelegramChatUsersByChat,
  telegramChatUserId,
  type TelegramChatUserInfo
} from '../../read-model/chatUser.js';
import {
  readMessageSelection,
  telegramOutgoingMessageRead,
  telegramReadMessagePreview,
  toReadMessages
} from '../../read-model/message.js';

export async function toChatDirectoryEntries(
  database: TelegramDatabase,
  chats: TelegramChatStorageRow[]
): Promise<ChatDirectoryEntry[]> {
  const lastMessagesByChat = await readLastMessagesByChat(database, chats);
  const placementsByChat = await readChatPlacementsByChat(database, chats);
  const filesByOwner = await readTelegramFileRefsForOwners(database, chatFileOwners(chats));
  const usersById = await readTelegramChatUsersByChat(
    database,
    chats.map((chat) => chat.chat)
  );

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

export async function chatDirectoryEntryByChatId(
  database: TelegramDatabase,
  chatId: string
): Promise<ChatDirectoryEntry | null> {
  const rows = await database
    .select(readChatSelection())
    .from(telegramChats)
    .where(eq(telegramChats.id, chatId))
    .limit(1);

  const [entry] = listableChatDirectoryEntries(
    await toChatDirectoryEntries(database, rows.map(toTelegramChatStorageRow))
  );
  return entry ?? null;
}

export function listableChatDirectoryEntries(entries: ChatDirectoryEntry[]): ChatDirectoryEntry[] {
  return entries.filter(isListableChatDirectoryEntry);
}

export function isListableChatDirectoryEntry(entry: ChatDirectoryEntry): boolean {
  return entry.placements.length > 0;
}

export function chatTypeCounts(entries: ChatDirectoryEntry[]): ChatTypeCount[] {
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
}): ChatFolder {
  return {
    ...telegramChatFolderRef(folder.id),
    folderId: folder.id,
    iconName: chatFolderIconName(folder.icon),
    position: folder.position,
    title: chatFolderTitle(folder)
  };
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
  user: TelegramChatUserInfo | undefined,
  files: TelegramFileRef[],
  lastMessage: TelegramReadMessage | null,
  placements: TelegramChatPlacement[]
): ChatDirectoryEntry {
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

function telegramChatLastMessage(
  chat: JsonObject,
  message: TelegramReadMessage | null
): ChatDirectoryEntry['lastMessage'] {
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

function chatFolderTitle(folder: { id: number; name: unknown }): string {
  const name = asPlainRecord(folder.name);
  const text = asPlainRecord(name?.text);
  return typeof text?.text === 'string' ? text.text : `Folder ${String(folder.id)}`;
}

function chatFolderIconName(value: unknown): string | null {
  const icon = asPlainRecord(value);
  return typeof icon?.name === 'string' ? icon.name : null;
}
