import { defineSubsystem } from '@agentg/framework';

import type { TelegramUpdateEventPublishers } from './updateEventPublishers.js';

type UpdateEventsSubsystem = TelegramUpdateEventPublishers & {
  configure(publishers: TelegramUpdateEventPublishers): void;
  start(): Promise<void>;
};

export const useUpdateEvents = defineSubsystem('update-events', (): UpdateEventsSubsystem => {
  let publishers: TelegramUpdateEventPublishers | undefined;

  function readyPublishers(): TelegramUpdateEventPublishers {
    if (publishers === undefined) {
      throw new Error('Subsystem update-events resource is not ready');
    }
    return publishers;
  }

  const lifecycle = {
    configure(nextPublishers: TelegramUpdateEventPublishers): void {
      publishers = nextPublishers;
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

      const value = (readyPublishers() as Record<PropertyKey, unknown>)[property];
      if (typeof value !== 'function') {
        return value;
      }

      return value.bind(readyPublishers()) as (...args: unknown[]) => unknown;
    }
  }) as unknown as UpdateEventsSubsystem;
});
