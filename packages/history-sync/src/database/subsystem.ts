import { defineResourceSubsystem } from '@agentg/framework/domain';

import type { HistorySyncDatabase } from '../database.js';
import type { HistorySyncServiceDomain, HistorySyncServiceOptions } from '../service/runService.js';

export const useDatabase = defineResourceSubsystem<
  HistorySyncDatabase,
  HistorySyncServiceOptions,
  HistorySyncServiceDomain
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
