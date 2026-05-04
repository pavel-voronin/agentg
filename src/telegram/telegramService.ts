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
import type { TelegramTdlibClient } from './tdlibClient.js';

export type TelegramService = {
  clearTdlibClient(client: TelegramTdlibClient): void;
  countChats(input?: TelegramChatCountInput): number;
  getChat(chatId: string): Promise<TelegramChatDto | undefined>;
  getMessage(chatId: string, messageId: string): Promise<TelegramMessageDto | undefined>;
  ingestHistoricalMessage(message: unknown): Promise<TelegramIngestResult>;
  ingestUpdate(update: unknown): Promise<TelegramIngestResult>;
  listChatFolders(): TelegramChatFolderDto[];
  listChatTypeCounts(): TelegramChatTypeCountDto[];
  listChats(input?: TelegramChatListInput): TelegramChatDto[];
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
    setTdlibClient(client): void {
      tdlibClient = client;
    }
  };

  return service;
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
