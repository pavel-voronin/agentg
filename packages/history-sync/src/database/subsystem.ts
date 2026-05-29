import { defineResourceSubsystem } from '@agentg/framework';

import type { HistorySyncDatabase } from '../database.js';
import type { HistorySyncServiceModule, HistorySyncServiceOptions } from '../service/runService.js';

export const useDatabase = defineResourceSubsystem<
  HistorySyncDatabase,
  HistorySyncServiceOptions,
  HistorySyncServiceModule
>('database', {
  fromContext(context) {
    return isDatabaseContext(context) ? context.database : undefined;
  },
  fromRun(options) {
    return options.database;
  }
});

function isDatabaseContext(context: unknown): context is { database: HistorySyncDatabase } {
  return typeof context === 'object' && context !== null && 'database' in context;
}
