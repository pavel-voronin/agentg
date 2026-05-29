import { defineResourceSubsystem } from '@agentg/framework';

import type { TelegramDatabase } from './client.js';
import type { TelegramIngestionModule, TelegramIngestionOptions } from '../tdlib/ingestion.js';

export const useDatabase = defineResourceSubsystem<
  TelegramDatabase,
  TelegramIngestionOptions,
  TelegramIngestionModule
>('database', {
  fromContext(context) {
    return isDatabaseContext(context) ? context.database : undefined;
  },
  fromRun(options) {
    return options.database;
  }
});

function isDatabaseContext(context: unknown): context is { database: TelegramDatabase } {
  return typeof context === 'object' && context !== null && 'database' in context;
}
