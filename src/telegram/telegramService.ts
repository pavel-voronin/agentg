import type { EventBus } from '../bus/eventBus.js';
import { createAppEvent } from '../bus/events.js';
import {
  normalizeHistoricalMessage,
  normalizeTelegramUpdate,
  type NormalizedTelegramUpdate
} from './normalize.js';
import type {
  TelegramChatFolderDto,
  TelegramChatCountInput,
  TelegramChatListInput,
  TelegramChatDto,
  TelegramChatTypeCountDto,
  TelegramMessageDto,
  TelegramPersistResult,
  TelegramRepository
} from './telegramRepository.js';
import type { TelegramTdlibChatList, TelegramTdlibClient } from './tdlibClient.js';

export type TelegramService = {
  clearTdlibClient(client: TelegramTdlibClient): void;
  countChats(input?: TelegramChatCountInput): number;
  discoverChats(input?: TelegramHistoryDiscoverChatsInput): Promise<TelegramChatDto[]>;
  fetchHistoryPage(input: TelegramHistoryFetchPageInput): Promise<TelegramHistoryFetchPageResult>;
  getChat(chatId: string): Promise<TelegramChatDto | undefined>;
  getMessage(chatId: string, messageId: string): Promise<TelegramMessageDto | undefined>;
  ingestHistoricalMessage(message: unknown): Promise<TelegramIngestResult>;
  ingestUpdate(update: unknown): Promise<TelegramIngestResult>;
  listChatFolders(): TelegramChatFolderDto[];
  listChatTypeCounts(): TelegramChatTypeCountDto[];
  listChats(input?: TelegramChatListInput): TelegramChatDto[];
  listRecentMessages(input?: TelegramRecentMessagesInput): TelegramMessageDto[];
  searchMessages(input: TelegramSearchMessagesInput): TelegramMessageDto[];
  setTdlibClient(client: TelegramTdlibClient): void;
};

export type TelegramServiceDependencies = {
  eventBus: EventBus;
  repository: TelegramRepository;
  tdlibClient?: TelegramTdlibClient;
};

export type TelegramIngestResult = {
  normalized: boolean;
  persisted: TelegramPersistResult;
};

export type TelegramHistoryDiscoverChatsInput = {
  loadBatchSize?: number;
};

export type TelegramHistoryFetchPageInput = {
  chatId: string;
  endAt: string;
  limit: number;
  startAt: string;
  cursorMessageId?: number;
};

export type TelegramHistoryFetchPageResult =
  | {
      fetchedMessages: 0;
      kind: 'no_messages_before_end';
      storedMessages: 0;
    }
  | {
      anchorMessageDate: string;
      fetchedMessages: 0;
      kind: 'anchor_before_start';
      storedMessages: 0;
    }
  | {
      crossedStart: boolean;
      fetchedMessages: number;
      kind: 'page';
      reachedBeginning: boolean;
      storedMessages: number;
      nextCursorMessageId?: number;
      oldestFetchedMessageDate?: string;
    };

export type TelegramRecentMessagesInput = {
  chatId?: string;
  limit?: number;
};

export type TelegramSearchMessagesInput = {
  query: string;
  chatId?: string;
  limit?: number;
};

const EMPTY_PERSIST_RESULT: TelegramPersistResult = {
  chat: false,
  chatFolders: false,
  chatList: false,
  event: false,
  message: false,
  user: false
};

export function createTelegramService(dependencies: TelegramServiceDependencies): TelegramService {
  let tdlibClient = dependencies.tdlibClient;
  const service: TelegramService = {
    clearTdlibClient(client): void {
      if (tdlibClient === client) {
        tdlibClient = undefined;
      }
    },
    countChats(input): number {
      return dependencies.repository.countChats(input);
    },
    async discoverChats(input = {}): Promise<TelegramChatDto[]> {
      if (tdlibClient === undefined) {
        return historySyncChats(dependencies.repository.listChats({ limit: 2000 }));
      }

      const loadBatchSize = normalizeLimit(input.loadBatchSize, 100, 1000);
      const folderIds = dependencies.repository.listChatFolders().map((folder) => folder.id);
      await loadAllChats(tdlibClient, loadBatchSize, folderIds);

      const chatIds = uniqueStrings([
        ...(await getChatIds(tdlibClient, { type: 'main' }, 100000)),
        ...(await getChatIds(tdlibClient, { type: 'archive' }, 100000)),
        ...(await getFolderChatIds(tdlibClient, folderIds, 100000))
      ]);

      for (const chatId of chatIds) {
        const rawChat = await getChatOrUndefined(tdlibClient, chatId);
        if (rawChat !== undefined) {
          await service.ingestUpdate({
            _: 'updateNewChat',
            chat: rawChat
          });
        }
      }

      return historySyncChats(dependencies.repository.listChats({ limit: 2000 }));
    },
    async fetchHistoryPage(input): Promise<TelegramHistoryFetchPageResult> {
      if (tdlibClient === undefined) {
        throw new Error('TDLib client is not connected');
      }

      return fetchHistoryPage(service, tdlibClient, input);
    },
    async getChat(chatId): Promise<TelegramChatDto | undefined> {
      const storedChat = dependencies.repository.getChat(chatId);
      if (storedChat !== undefined || tdlibClient === undefined) {
        return storedChat;
      }

      const rawChat = await tdlibClient.getChat(chatId);
      await service.ingestUpdate({
        _: 'updateNewChat',
        chat: rawChat
      });

      return dependencies.repository.getChat(chatId);
    },
    async getMessage(chatId, messageId): Promise<TelegramMessageDto | undefined> {
      const storedMessage = dependencies.repository.getMessage(chatId, messageId);
      if (storedMessage !== undefined || tdlibClient === undefined) {
        return storedMessage;
      }

      const rawMessage = await tdlibClient.getMessage(chatId, messageId);
      await service.ingestHistoricalMessage(rawMessage);

      return dependencies.repository.getMessage(chatId, messageId);
    },
    async ingestHistoricalMessage(message): Promise<TelegramIngestResult> {
      return ingestNormalizedUpdate(dependencies, normalizeHistoricalMessage(message));
    },
    async ingestUpdate(update): Promise<TelegramIngestResult> {
      return ingestNormalizedUpdate(dependencies, normalizeTelegramUpdate(update));
    },
    listChatFolders(): TelegramChatFolderDto[] {
      return dependencies.repository.listChatFolders();
    },
    listChatTypeCounts(): TelegramChatTypeCountDto[] {
      return dependencies.repository.listChatTypeCounts();
    },
    listChats(input): TelegramChatDto[] {
      return dependencies.repository.listChats(input);
    },
    listRecentMessages(input): TelegramMessageDto[] {
      return dependencies.repository.listRecentMessages(input);
    },
    searchMessages(input): TelegramMessageDto[] {
      return dependencies.repository.searchMessages(input);
    },
    setTdlibClient(client): void {
      tdlibClient = client;
    }
  };

  return service;
}

async function fetchHistoryPage(
  service: TelegramService,
  tdlibClient: TelegramTdlibClient,
  input: TelegramHistoryFetchPageInput
): Promise<TelegramHistoryFetchPageResult> {
  const startAt = requireDate(input.startAt, 'telegram.history.fetchPage requires startAt');
  const endAt = requireDate(input.endAt, 'telegram.history.fetchPage requires endAt');
  const limit = normalizeLimit(input.limit, 100, 100);
  let cursorMessageId = input.cursorMessageId;

  if (cursorMessageId !== undefined && !Number.isSafeInteger(cursorMessageId)) {
    throw new Error(`Telegram message id must be numeric: ${String(cursorMessageId)}`);
  }

  if (cursorMessageId === undefined) {
    const anchor = await getLastMessageNoLaterThan(tdlibClient, input.chatId, endAt);
    const anchorDate = tdMessageDate(anchor);
    const anchorMessageId = tdMessageId(anchor);

    if (anchor === undefined || anchorMessageId === undefined) {
      return {
        fetchedMessages: 0,
        kind: 'no_messages_before_end',
        storedMessages: 0
      };
    }

    if (anchorDate !== undefined && anchorDate < startAt) {
      return {
        anchorMessageDate: anchorDate.toISOString(),
        fetchedMessages: 0,
        kind: 'anchor_before_start',
        storedMessages: 0
      };
    }

    cursorMessageId = anchorMessageId;
  }

  const history = readRecord(
    await tdlibClient.getChatHistory({
      chatId: input.chatId,
      fromMessageId: cursorMessageId,
      limit
    })
  );
  const messages = Array.isArray(history?.messages)
    ? history.messages
        .map(readRecord)
        .filter((message): message is Record<string, unknown> => message !== undefined)
    : [];

  if (messages.length === 0) {
    return {
      fetchedMessages: 0,
      kind: 'no_messages_before_end',
      storedMessages: 0
    };
  }

  let storedMessages = 0;
  for (const message of messages) {
    const messageDate = tdMessageDate(message);
    if (messageDate === undefined || messageDate < startAt || messageDate >= endAt) {
      continue;
    }

    const result = await service.ingestHistoricalMessage(message);
    if (result.persisted.message) {
      storedMessages += 1;
    }
  }

  const nextCursorMessageId = oldestMessageIdOlderThan(messages, cursorMessageId);
  const oldestFetchedMessageDate =
    nextCursorMessageId === undefined
      ? undefined
      : messageDateForId(messages, nextCursorMessageId);

  return {
    crossedStart: messages.some((message) => isBeforeInterval(message, startAt)),
    fetchedMessages: messages.length,
    kind: 'page',
    ...(nextCursorMessageId === undefined ? {} : { nextCursorMessageId }),
    ...(oldestFetchedMessageDate === undefined
      ? {}
      : { oldestFetchedMessageDate: oldestFetchedMessageDate.toISOString() }),
    reachedBeginning: nextCursorMessageId === undefined,
    storedMessages
  };
}

async function ingestNormalizedUpdate(
  dependencies: TelegramServiceDependencies,
  update: NormalizedTelegramUpdate | undefined
): Promise<TelegramIngestResult> {
  if (update === undefined) {
    return {
      normalized: false,
      persisted: EMPTY_PERSIST_RESULT
    };
  }

  const persisted = dependencies.repository.persistUpdate(update);
  await publishTelegramEvents(dependencies.eventBus, update, persisted);

  return {
    normalized: true,
    persisted
  };
}

async function publishTelegramEvents(
  eventBus: EventBus,
  update: NormalizedTelegramUpdate,
  persisted: TelegramPersistResult
): Promise<void> {
  if (persisted.chat && update.chat !== undefined) {
    await eventBus.publish(
      createAppEvent({
        data: {
          chat: {
            id: update.chat.id,
            title: update.chat.title,
            type: update.chat.type
          }
        },
        meta: {
          chatId: update.chat.id
        },
        source: 'telegram',
        type: 'telegram.chat.updated'
      })
    );
  }

  if (persisted.chatList) {
    const chatId = update.chatList?.chatId ?? update.chat?.id;
    await eventBus.publish(
      createAppEvent({
        data: {
          chatId: chatId ?? null,
          lists: update.chat?.lists ?? null,
          update: update.chatList ?? null
        },
        ...(chatId === undefined ? {} : { meta: { chatId } }),
        source: 'telegram',
        type: 'telegram.chat_list.updated'
      })
    );
  }

  if (persisted.message && update.message !== undefined) {
    await eventBus.publish(
      createAppEvent({
        data: {
          message: {
            chatId: update.message.chatId,
            contentType: update.message.contentType,
            editDate: update.message.editDate?.toISOString() ?? null,
            messageDate: update.message.messageDate?.toISOString() ?? null,
            messageId: update.message.messageId,
            senderId: update.message.senderId ?? null,
            senderType: update.message.senderType ?? null,
            text: update.message.text ?? null
          }
        },
        meta: {
          chatId: update.message.chatId,
          messageId: update.message.messageId
        },
        source: 'telegram',
        type: 'telegram.message.created'
      })
    );
  }

  if (persisted.message && update.contentUpdate !== undefined) {
    await eventBus.publish(
      createAppEvent({
        data: {
          message: {
            chatId: update.contentUpdate.chatId,
            contentType: update.contentUpdate.contentType,
            editDate: update.contentUpdate.editDate?.toISOString() ?? null,
            messageId: update.contentUpdate.messageId,
            text: update.contentUpdate.text ?? null
          }
        },
        meta: {
          chatId: update.contentUpdate.chatId,
          messageId: update.contentUpdate.messageId
        },
        source: 'telegram',
        type: 'telegram.message.updated'
      })
    );
  }

  if (persisted.message && update.delete !== undefined) {
    await eventBus.publish(
      createAppEvent({
        data: {
          delete: {
            chatId: update.delete.chatId,
            messageIds: update.delete.messageIds
          }
        },
        meta: {
          chatId: update.delete.chatId,
          messageIds: update.delete.messageIds
        },
        source: 'telegram',
        type: 'telegram.message.deleted'
      })
    );
  }
}

async function loadAllChats(
  tdlibClient: TelegramTdlibClient,
  batchSize: number,
  folderIds: number[]
): Promise<void> {
  await loadAllChatsFromList(tdlibClient, { type: 'main' }, batchSize);
  await loadAllChatsFromList(tdlibClient, { type: 'archive' }, batchSize);
  for (const folderId of folderIds) {
    await loadAllChatsFromList(tdlibClient, { folderId, type: 'folder' }, batchSize);
  }
}

async function loadAllChatsFromList(
  tdlibClient: TelegramTdlibClient,
  list: TelegramTdlibChatList,
  batchSize: number
): Promise<void> {
  for (;;) {
    try {
      await tdlibClient.loadChats({ limit: batchSize, list });
    } catch (error) {
      if (isTdlibNotFound(error)) {
        return;
      }

      throw error;
    }
  }
}

async function getChatIds(
  tdlibClient: TelegramTdlibClient,
  list: TelegramTdlibChatList,
  limit: number
): Promise<string[]> {
  let chats: Record<string, unknown> | undefined;
  try {
    chats = readRecord(await tdlibClient.getChats({ limit, list }));
  } catch (error) {
    if (list.type !== 'main' && isTdlibNotFound(error)) {
      return [];
    }

    throw error;
  }

  return Array.isArray(chats?.chat_ids)
    ? chats.chat_ids.filter(isTelegramId).map((chatId) => String(chatId))
    : [];
}

async function getFolderChatIds(
  tdlibClient: TelegramTdlibClient,
  folderIds: number[],
  limit: number
): Promise<string[]> {
  const chatIds: string[] = [];
  for (const folderId of folderIds) {
    chatIds.push(...(await getChatIds(tdlibClient, { folderId, type: 'folder' }, limit)));
  }
  return chatIds;
}

async function getChatOrUndefined(
  tdlibClient: TelegramTdlibClient,
  chatId: string
): Promise<unknown> {
  try {
    return await tdlibClient.getChat(chatId);
  } catch (error) {
    if (isTdlibNotFound(error)) {
      return undefined;
    }

    throw error;
  }
}

async function getLastMessageNoLaterThan(
  tdlibClient: TelegramTdlibClient,
  chatId: string,
  endAt: Date
): Promise<Record<string, unknown> | undefined> {
  try {
    return readRecord(await tdlibClient.getChatMessageByDate(chatId, endAt));
  } catch (error) {
    if (isTdlibNotFound(error)) {
      return undefined;
    }

    throw error;
  }
}

function historySyncChats(chats: TelegramChatDto[]): TelegramChatDto[] {
  return chats.filter((chat) => isHistorySyncChatType(chat.type));
}

function isHistorySyncChatType(type: string): boolean {
  return type === 'private' || type === 'secret' || type === 'group' || type === 'channel';
}

function tdMessageId(message: Record<string, unknown> | undefined): number | undefined {
  return typeof message?.id === 'number' ? message.id : undefined;
}

function tdMessageDate(message: Record<string, unknown> | undefined): Date | undefined {
  return typeof message?.date === 'number' && message.date > 0
    ? new Date(message.date * 1000)
    : undefined;
}

function isBeforeInterval(message: Record<string, unknown>, startAt: Date): boolean {
  const messageDate = tdMessageDate(message);
  return messageDate !== undefined && messageDate < startAt;
}

function messageDateForId(
  messages: Record<string, unknown>[],
  messageId: number
): Date | undefined {
  return tdMessageDate(messages.find((message) => tdMessageId(message) === messageId));
}

function oldestMessageIdOlderThan(
  messages: Record<string, unknown>[],
  cursorMessageId: number
): number | undefined {
  const ids = messages
    .map(tdMessageId)
    .filter((id): id is number => id !== undefined && id < cursorMessageId);

  return ids.length === 0 ? undefined : Math.min(...ids);
}

function normalizeLimit(value: number | undefined, fallback: number, max: number): number {
  if (value === undefined) {
    return fallback;
  }
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Limit must be a positive safe integer: ${String(value)}`);
  }
  return Math.min(value, max);
}

function requireDate(value: string, message: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(message);
  }
  return date;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function isTelegramId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function isTdlibNotFound(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b404\b/.test(message) || message.includes('NOT_FOUND') || message.includes('Not Found');
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
