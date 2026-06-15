import type { Database } from '../database/client.js';
import type { Chat } from '../domain/models/chat.js';
import type {
  ChatListMembership,
  ChatPositionState,
  ChatState,
  ChatPatch
} from '../domain/models/chatState.js';
import type { FileRef } from '../domain/models/fileRef.js';
import { readFileRefsForOwners } from '../storage/fileReadStorage.js';
import { readChatRowById } from '../storage/chatRowStorage.js';
import {
  addChatListMembership,
  deleteChatPositionState,
  removeChatListMembership,
  replaceChatPositionStates,
  saveChatState,
  upsertChatPositionState,
  upsertChatPatch
} from '../storage/chatStorage.js';

export type ChatRepository = {
  addListMembership(membership: ChatListMembership): Promise<void>;
  deletePosition(input: { chatId: string; listKey: string }): Promise<void>;
  read(chatId: string): Promise<Chat | null>;
  removeListMembership(membership: Omit<ChatListMembership, 'chatList'>): Promise<void>;
  replacePositions(chatId: string, positions: readonly ChatPositionState[]): Promise<void>;
  save(chat: ChatState, positions: readonly ChatPositionState[]): Promise<void>;
  transaction<T>(operation: (repository: ChatRepository) => Promise<T>): Promise<T>;
  upsert(chat: ChatPatch): Promise<void>;
  upsertPosition(position: ChatPositionState): Promise<void>;
};

export function createChatRepository(database: Database): ChatRepository {
  return {
    addListMembership(membership) {
      return addChatListMembership(database, membership);
    },
    deletePosition(input) {
      return deleteChatPositionState(database, input);
    },
    async read(chatId) {
      const row = await readChatRowById(database, chatId);
      if (row === undefined) {
        return null;
      }
      return toChat(row, await readChatFileRefs(database, row.telegramChatId));
    },
    removeListMembership(membership) {
      return removeChatListMembership(database, membership);
    },
    replacePositions(chatId, positions) {
      return replaceChatPositionStates(database, chatId, positions);
    },
    save(chat, positions) {
      return saveChatState(database, chat, positions);
    },
    transaction(operation) {
      return database.transaction((transaction) => operation(createChatRepository(transaction)));
    },
    upsert(chat) {
      return upsertChatPatch(database, chat);
    },
    upsertPosition(position) {
      return upsertChatPositionState(database, position);
    }
  };
}

async function readChatFileRefs(database: Database, chatId: string): Promise<FileRef[]> {
  const refs = await readFileRefsForOwners(database, [
    {
      ownerId: chatId,
      ownerModel: 'telegram.chat'
    }
  ]);
  return refs.get(`telegram.chat:${chatId}`) ?? [];
}

function toChat(row: Awaited<ReturnType<typeof readChatRowById>>, files: FileRef[]): Chat {
  if (row === undefined) {
    throw new Error('chat row is required');
  }
  return {
    _model: 'telegram.chat',
    avatar: {
      big: files.find((file) => file.slotKey === 'avatar.big') ?? null,
      small: files.find((file) => file.slotKey === 'avatar.small') ?? null
    },
    id: row.telegramChatId,
    title: row.title,
    type: row.type,
    updatedAt: new Date(0).toISOString()
  };
}
