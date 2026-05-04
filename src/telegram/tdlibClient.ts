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
  getMessage(chatId: string, messageId: string): Promise<unknown>;
  login(): Promise<void>;
  onError(handler: (error: Error) => void): TdlibSubscription;
  onUpdate(handler: (update: unknown) => void): TdlibSubscription;
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
      return await client.invoke({
        _: 'getChat',
        chat_id: parseTelegramIntegerId(chatId)
      });
    },
    async getMessage(chatId, messageId): Promise<unknown> {
      return await client.invoke({
        _: 'getMessage',
        chat_id: parseTelegramIntegerId(chatId),
        message_id: parseTelegramIntegerId(messageId)
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
