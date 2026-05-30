import { bindSubsystemContext, defineSubsystem } from '@agentg/framework';

import type { TelegramDatabase } from './client.js';
import type { TelegramIngestionOptions } from '../tdlib/ingestion.js';

type DatabaseSubsystem = TelegramDatabase & {
  [bindSubsystemContext](context: unknown): void;
  configure(database: TelegramDatabase): void;
  start(options: TelegramIngestionOptions): Promise<void>;
};

export const useDatabase = defineSubsystem('database', (): DatabaseSubsystem => {
  let database: TelegramDatabase | undefined;

  function configure(nextDatabase: TelegramDatabase | undefined): void {
    if (nextDatabase !== undefined) {
      database = nextDatabase;
    }
  }

  function readyDatabase(): TelegramDatabase {
    if (database === undefined) {
      throw new Error('Subsystem database resource is not ready');
    }
    return database;
  }

  const lifecycle = {
    [bindSubsystemContext](context: unknown): void {
      configure(isDatabaseContext(context) ? context.database : undefined);
    },
    configure(database: TelegramDatabase): void {
      configure(database);
    },
    init(): void {
      return;
    },
    start(options: TelegramIngestionOptions): Promise<void> {
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

function isDatabaseContext(context: unknown): context is { database: TelegramDatabase } {
  return typeof context === 'object' && context !== null && 'database' in context;
}
