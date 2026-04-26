import { mkdir } from 'node:fs/promises';

import { getTdjson } from 'prebuilt-tdlib';
import { configure, createClient } from 'tdl';
import type { Client } from 'tdl';

export type TelegramClientConfig = {
  apiHash?: string;
  apiId?: number;
  databaseDirectory: string;
  filesDirectory: string;
};

export type TelegramDependencyStatus = {
  tdjsonPath: string;
};

export function configureTdlib(): TelegramDependencyStatus {
  const tdjsonPath = getTdjson();
  configure({ tdjson: tdjsonPath, verbosityLevel: 1 });

  return { tdjsonPath };
}

export function hasTelegramCredentials(
  config: TelegramClientConfig
): config is TelegramClientConfig & {
  apiHash: string;
  apiId: number;
} {
  return config.apiId !== undefined && config.apiHash !== undefined && config.apiHash.length > 0;
}

export async function createTelegramClient(config: TelegramClientConfig): Promise<Client> {
  if (!hasTelegramCredentials(config)) {
    throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH are required to create TDLib client');
  }

  await Promise.all([
    mkdir(config.databaseDirectory, { recursive: true }),
    mkdir(config.filesDirectory, { recursive: true })
  ]);

  return createClient({
    apiHash: config.apiHash,
    apiId: config.apiId,
    databaseDirectory: config.databaseDirectory,
    filesDirectory: config.filesDirectory,
    tdlibParameters: {
      application_version: '0.1.0',
      device_model: 'AgenTG Docker Client',
      system_language_code: 'en',
      system_version: 'linux'
    }
  });
}
