import { bindSubsystemContext, defineSubsystem } from '@agentg/framework';

import type { TelegramReadClient } from '../telegramClient.js';

type TelegramSubsystem = TelegramReadClient & {
  [bindSubsystemContext](context: unknown): void;
  configure(telegram: TelegramReadClient): void;
  start(): Promise<void>;
};

export const useTelegram = defineSubsystem('telegram', (): TelegramSubsystem => {
  let telegram: TelegramReadClient | undefined;

  function configure(nextTelegram: TelegramReadClient | undefined): void {
    if (nextTelegram !== undefined) {
      telegram = nextTelegram;
    }
  }

  function readyTelegram(): TelegramReadClient {
    if (telegram === undefined) {
      throw new Error('Subsystem telegram resource is not ready');
    }
    return telegram;
  }

  const lifecycle = {
    [bindSubsystemContext](context: unknown): void {
      configure(isTelegramContext(context) ? context.telegram : undefined);
    },
    configure(telegram: TelegramReadClient): void {
      configure(telegram);
    },
    init(): void {
      return;
    },
    start(): Promise<void> {
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

      const value = (readyTelegram() as Record<PropertyKey, unknown>)[property];
      if (typeof value !== 'function') {
        return value;
      }

      return value.bind(readyTelegram()) as (...args: unknown[]) => unknown;
    }
  }) as unknown as TelegramSubsystem;
});

function isTelegramContext(context: unknown): context is { telegram: TelegramReadClient } {
  return typeof context === 'object' && context !== null && 'telegram' in context;
}
