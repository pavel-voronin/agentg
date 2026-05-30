import { bindSubsystemContext, defineSubsystem } from '@agentg/framework';

import type { HistorySyncDatabase } from '../database.js';
import type { HistorySyncServiceOptions } from '../service/runService.js';

type DatabaseSubsystem = HistorySyncDatabase & {
  [bindSubsystemContext](context: unknown): void;
  configure(database: HistorySyncDatabase): void;
  start(options: HistorySyncServiceOptions): Promise<void>;
};

export const useDatabase = defineSubsystem('database', (): DatabaseSubsystem => {
  let database: HistorySyncDatabase | undefined;

  function configure(nextDatabase: HistorySyncDatabase | undefined): void {
    if (nextDatabase !== undefined) {
      database = nextDatabase;
    }
  }

  function readyDatabase(): HistorySyncDatabase {
    if (database === undefined) {
      throw new Error('Subsystem database resource is not ready');
    }
    return database;
  }

  const lifecycle = {
    [bindSubsystemContext](context: unknown): void {
      configure(isDatabaseContext(context) ? context.database : undefined);
    },
    configure(database: HistorySyncDatabase): void {
      configure(database);
    },
    init(): void {
      return;
    },
    start(options: HistorySyncServiceOptions): Promise<void> {
      configure(options.database);
      return Promise.resolve();
    }
  };

  return new Proxy(lifecycle, {
    get(target, property) {
      if (property in target) {
        return (target as Record<PropertyKey, unknown>)[property];
      }
      if (typeof property === 'symbol') {
        return undefined;
      }

      const value = (readyDatabase() as unknown as Record<PropertyKey, unknown>)[property];
      if (typeof value !== 'function') {
        return value;
      }

      return value.bind(readyDatabase()) as (...args: unknown[]) => unknown;
    },
    set(_target, property, value) {
      (readyDatabase() as unknown as Record<PropertyKey, unknown>)[property] = value;
      return true;
    }
  }) as unknown as DatabaseSubsystem;
});

function isDatabaseContext(context: unknown): context is { database: HistorySyncDatabase } {
  return typeof context === 'object' && context !== null && 'database' in context;
}
