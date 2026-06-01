import { mkdir } from 'node:fs/promises';

import { getTdjson } from 'prebuilt-tdlib';
import { configure, createClient as createTdlibClient } from 'tdl';
import type { Client } from 'tdl';

export type ClientConfig = {
  apiHash?: string;
  apiId?: number;
  databaseDirectory: string;
  filesDirectory: string;
};

export type DependencyStatus = {
  tdjsonPath: string;
};

export function configureTdlib(): DependencyStatus {
  const tdjsonPath = getTdjson();
  configure({ tdjson: tdjsonPath, verbosityLevel: 1 });

  return { tdjsonPath };
}

export function hasCredentials(config: ClientConfig): config is ClientConfig & {
  apiHash: string;
  apiId: number;
} {
  return config.apiId !== undefined && config.apiHash !== undefined && config.apiHash.length > 0;
}

export async function createClient(config: ClientConfig): Promise<Client> {
  if (!hasCredentials(config)) {
    throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH are required to create TDLib client');
  }

  await Promise.all([
    mkdir(config.databaseDirectory, { recursive: true }),
    mkdir(config.filesDirectory, { recursive: true })
  ]);

  return createTdlibClient({
    apiHash: config.apiHash,
    apiId: config.apiId,
    databaseDirectory: config.databaseDirectory,
    filesDirectory: config.filesDirectory,
    tdlibParameters: {
      application_version: '0.1.0',
      device_model: 'AgenTG Docker Client',
      system_language_code: 'en',
      system_version: 'linux',
      use_chat_info_database: true,
      use_file_database: true,
      use_message_database: true,
      use_secret_chats: false
    }
  });
}
