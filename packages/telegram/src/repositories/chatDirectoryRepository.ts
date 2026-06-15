import type { Database } from '../database/client.js';
import type {
  ChatDirectory,
  ChatDirectoryEntry,
  ChatDirectoryInput,
  ChatFolder,
  ChatTypeCount
} from '../domain/models/chatDirectory.js';
import type { ChatPlacement } from '../domain/models/chatPlacement.js';
import type { Message } from '../domain/models/message.js';
import { chatFolderRef } from '../model/refs.js';
import type { FileOwnerKey, FileRef } from '../files/types.js';
import { ownerKey, readFileRefsForOwners } from '../storage/fileReadStorage.js';
import type { ChatStorageRow } from '../storage/chatRowStorage.js';
import { readChatUsersByIds, type ChatUserInfo } from '../storage/chatUserRowStorage.js';
import {
  readChatPlacementsByChat,
  readChatDirectoryRows,
  readChatDirectoryRowById
} from '../storage/chatDirectoryStorage.js';
import { createMessageRepository } from './messageRepository.js';
import { messagePreview, outgoingMessageRead } from './messageAssembler.js';

export type ChatDirectoryRepository = {
  list(input: ChatDirectoryInput): Promise<ChatDirectory>;
  readEntry(chatId: string): Promise<ChatDirectoryEntry | null>;
};

export function createChatDirectoryRepository(database: Database): ChatDirectoryRepository {
  return {
    async list(input) {
      const { folders, matchingChats, navigationChats } = await readChatDirectoryRows(
        database,
        input
      );
      const chats = listableChatDirectoryEntries(
        await toChatDirectoryEntries(database, matchingChats)
      );
      const navigation = listableChatDirectoryEntries(
        await toChatDirectoryEntries(database, navigationChats)
      );
      return {
        chats,
        folders: folders.map(chatFolderEntry),
        navigationChats: navigation,
        types: chatTypeCounts(navigation)
      };
    },
    async readEntry(chatId) {
      const row = await readChatDirectoryRowById(database, chatId);
      const [entry] = listableChatDirectoryEntries(
        await toChatDirectoryEntries(database, row === undefined ? [] : [row])
      );
      return entry ?? null;
    }
  };
}

async function toChatDirectoryEntries(
  database: Database,
  chats: ChatStorageRow[]
): Promise<ChatDirectoryEntry[]> {
  const lastMessageRefs = chats
    .map((chat) => ({
      chatId: chat.telegramChatId,
      messageId: chat.lastMessageId
    }))
    .filter((ref): ref is { chatId: string; messageId: string } => ref.messageId !== null);
  const lastMessagesByChat = new Map(
    (await createMessageRepository(database).readManyByRefs(lastMessageRefs)).map((message) => [
      message.chat.id,
      message
    ])
  );
  const placementsByChat = await readChatPlacementsByChat(database, chats);
  const filesByOwner = await readFileRefsForOwners(database, chatFileOwners(chats));
  const usersById = await readChatUsersByIds(
    database,
    chats.map((chat) => chat.privateUserId)
  );

  return chats.map((chat) => {
    const user = chat.privateUserId === null ? undefined : usersById.get(chat.privateUserId);
    return toDirectoryEntry(
      chat,
      user,
      filesByOwner.get(ownerKey(chatFileOwner(chat))) ?? [],
      lastMessagesByChat.get(chat.telegramChatId) ?? null,
      placementsByChat.get(chat.telegramChatId) ?? []
    );
  });
}

function listableChatDirectoryEntries(entries: ChatDirectoryEntry[]): ChatDirectoryEntry[] {
  return entries.filter((entry) => entry.placements.length > 0);
}

function chatTypeCounts(entries: ChatDirectoryEntry[]): ChatTypeCount[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([type, count]) => ({ count, type }));
}

function chatFolderEntry(folder: {
  iconName: string | null;
  id: number;
  position: number;
  title: string;
}): ChatFolder {
  return {
    ...chatFolderRef(folder.id),
    folderId: folder.id,
    iconName: folder.iconName,
    position: folder.position,
    title: folder.title
  };
}

function toDirectoryEntry(
  chat: ChatStorageRow,
  user: ChatUserInfo | undefined,
  files: FileRef[],
  lastMessage: Message | null,
  placements: ChatPlacement[]
): ChatDirectoryEntry {
  const unreadCount = chatUnreadCount(chat);
  const notificationsEnabled = chatNotificationsEnabled(chat);
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
    isUnread: chatIsUnread(chat, unreadCount),
    lastMessage: chatLastMessage(chat, lastMessage),
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

function chatFileOwners(chats: ChatStorageRow[]): FileOwnerKey[] {
  return chats.map(chatFileOwner);
}

function chatFileOwner(chat: ChatStorageRow): FileOwnerKey {
  return {
    ownerId: chat.telegramChatId,
    ownerModel: 'telegram.chat'
  };
}

function chatLastMessage(
  chat: ChatStorageRow,
  message: Message | null
): ChatDirectoryEntry['lastMessage'] {
  if (message === null) {
    return null;
  }

  const preview = messagePreview(message);
  const isOutgoing = message.isOutgoing;
  const readState = isOutgoing
    ? outgoingMessageRead(chat.lastReadOutboxMessageId, message.telegramMessageId)
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

function chatUnreadCount(chat: ChatStorageRow): { placeholder: boolean; value: number } {
  return typeof chat.unreadCount === 'number' &&
    Number.isSafeInteger(chat.unreadCount) &&
    chat.unreadCount >= 0
    ? { placeholder: false, value: chat.unreadCount }
    : { placeholder: true, value: 0 };
}

function chatIsUnread(
  chat: ChatStorageRow,
  unreadCount: { placeholder: boolean; value: number }
): boolean {
  if (unreadCount.value > 0) {
    return true;
  }
  return chat.isMarkedAsUnread ?? false;
}

function chatNotificationsEnabled(chat: ChatStorageRow): {
  placeholder: boolean;
  value: boolean | null;
} {
  if (chat.notificationMuteFor !== null) {
    return {
      placeholder: false,
      value: chat.notificationMuteFor === 0
    };
  }
  return {
    placeholder: true,
    value: null
  };
}
