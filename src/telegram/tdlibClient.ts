import { mkdir } from 'node:fs/promises';

import { getTdjson } from 'prebuilt-tdlib';
import { configure, createClient, type Client } from 'tdl';

export type TelegramClientConfig = {
  databaseDirectory: string;
  filesDirectory: string;
  apiHash?: string;
  apiId?: number;
};

export type TelegramTdlibClient = {
  close(): Promise<void>;
  getChat(chatId: string): Promise<unknown>;
  getChatHistory(input: TelegramTdlibGetChatHistoryInput): Promise<unknown>;
  getChatMessageByDate(chatId: string, endAt: Date): Promise<unknown>;
  getChats(input: TelegramTdlibChatListRequest): Promise<unknown>;
  getMessage(chatId: string, messageId: string): Promise<unknown>;
  getUser(userId: string): Promise<unknown>;
  loadChats(input: TelegramTdlibChatListRequest): Promise<void>;
  login(): Promise<void>;
  onError(handler: (error: Error) => void): TdlibSubscription;
  onUpdate(handler: (update: unknown) => void): TdlibSubscription;
};

export type TelegramTdlibChatList =
  | {
      type: 'archive' | 'main';
    }
  | {
      folderId: number;
      type: 'folder';
    };

export type TelegramTdlibChatListRequest = {
  list: TelegramTdlibChatList;
  limit: number;
};

export type TelegramTdlibGetChatHistoryInput = {
  chatId: string;
  fromMessageId: number;
  limit: number;
};

export type TdlibSubscription = {
  unsubscribe(): void;
};

export type TelegramDependencyStatus = {
  tdjsonPath: string;
};

export function configureTdlib(): TelegramDependencyStatus {
  const tdjsonPath = getTdjson();
  configure({ tdjson: tdjsonPath, verbosityLevel: 1 });

  return { tdjsonPath };
}

export async function createTelegramTdlibClient(
  config: TelegramClientConfig
): Promise<TelegramTdlibClient> {
  if (!hasTelegramCredentials(config)) {
    throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH are required to create TDLib client');
  }

  await Promise.all([
    mkdir(config.databaseDirectory, { recursive: true }),
    mkdir(config.filesDirectory, { recursive: true })
  ]);

  configureTdlib();

  const client = createClient({
    apiHash: config.apiHash,
    apiId: config.apiId,
    databaseDirectory: config.databaseDirectory,
    filesDirectory: config.filesDirectory,
    tdlibParameters: {
      application_version: '0.1.0',
      device_model: 'AgenTG Monolith',
      system_language_code: 'en',
      system_version: process.platform
    }
  });

  return createTelegramTdlibClientAdapter(client);
}

export function createTelegramTdlibClientAdapter(client: Client): TelegramTdlibClient {
  return {
    async close(): Promise<void> {
      await client.close();
    },
    async getChat(chatId): Promise<unknown> {
      return await invokeTdlib(client, {
        _: 'getChat',
        chat_id: parseTelegramIntegerId(chatId)
      });
    },
    async getChatHistory(input): Promise<unknown> {
      return await invokeTdlib(client, {
        _: 'getChatHistory',
        chat_id: parseTelegramIntegerId(input.chatId),
        from_message_id: input.fromMessageId,
        limit: input.limit,
        offset: 0,
        only_local: false
      });
    },
    async getChatMessageByDate(chatId, endAt): Promise<unknown> {
      return await invokeTdlib(client, {
        _: 'getChatMessageByDate',
        chat_id: parseTelegramIntegerId(chatId),
        date: Math.floor((endAt.getTime() - 1) / 1000)
      });
    },
    async getChats(input): Promise<unknown> {
      return await invokeTdlib(client, {
        _: 'getChats',
        chat_list: toTdChatList(input.list),
        limit: input.limit
      });
    },
    async getMessage(chatId, messageId): Promise<unknown> {
      return await invokeTdlib(client, {
        _: 'getMessage',
        chat_id: parseTelegramIntegerId(chatId),
        message_id: parseTelegramIntegerId(messageId)
      });
    },
    async getUser(userId): Promise<unknown> {
      return await invokeTdlib(client, {
        _: 'getUser',
        user_id: parseTelegramIntegerId(userId)
      });
    },
    async loadChats(input): Promise<void> {
      await invokeTdlib(client, {
        _: 'loadChats',
        chat_list: toTdChatList(input.list),
        limit: input.limit
      });
    },
    async login(): Promise<void> {
      await client.login();
    },
    onError(handler): TdlibSubscription {
      client.on('error', handler);
      return {
        unsubscribe(): void {
          client.off('error', handler);
        }
      };
    },
    onUpdate(handler): TdlibSubscription {
      client.on('update', handler);
      return {
        unsubscribe(): void {
          client.off('update', handler);
        }
      };
    }
  };
}

export function hasTelegramCredentials(
  config: TelegramClientConfig
): config is TelegramClientConfig & {
  apiHash: string;
  apiId: number;
} {
  return config.apiId !== undefined && config.apiHash !== undefined && config.apiHash.length > 0;
}

function parseTelegramIntegerId(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Telegram identifier must be a safe integer: ${value}`);
  }

  return parsed;
}

function toTdChatList(list: TelegramTdlibChatList): Record<string, unknown> {
  switch (list.type) {
    case 'main':
      return { _: 'chatListMain' };
    case 'archive':
      return { _: 'chatListArchive' };
    case 'folder':
      return { _: 'chatListFolder', chat_folder_id: list.folderId };
  }
}

async function invokeTdlib(client: Client, request: Record<string, unknown>): Promise<unknown> {
  for (;;) {
    try {
      return await client.invoke(request as Parameters<Client['invoke']>[0]);
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

function parseFloodWaitSeconds(error: unknown): number | undefined {
  const message = error instanceof Error ? error.message : String(error);
  const match = /FLOOD(?:_PREMIUM)?_WAIT_(\d+)/.exec(message);
  return match?.[1] === undefined ? undefined : Number.parseInt(match[1], 10);
}

async function delay(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
