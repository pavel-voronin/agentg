import type { EventBus } from '@agentg/events/bus';
import { bindSubsystemContext, defineSubsystem } from '@agentg/framework';

import type { TelegramIngestionOptions } from '../tdlib/ingestion.js';

type EventsSubsystem = EventBus & {
  [bindSubsystemContext](context: unknown): void;
  configure(eventBus: EventBus): void;
  start(options: TelegramIngestionOptions): Promise<void>;
};

export const useEvents = defineSubsystem('events', (): EventsSubsystem => {
  let eventBus: EventBus | undefined;

  function configure(nextEventBus: EventBus | undefined): void {
    if (nextEventBus !== undefined) {
      eventBus = nextEventBus;
    }
  }

  function readyEventBus(): EventBus {
    if (eventBus === undefined) {
      throw new Error('Subsystem events resource is not ready');
    }
    return eventBus;
  }

  return {
    [bindSubsystemContext](context: unknown): void {
      configure(isEventBusContext(context) ? context.eventBus : undefined);
    },
    close(): Promise<void> {
      return readyEventBus().close();
    },
    configure(eventBus: EventBus): void {
      configure(eventBus);
    },
    publish(...args: Parameters<EventBus['publish']>): ReturnType<EventBus['publish']> {
      return readyEventBus().publish(...args);
    },
    start(options: TelegramIngestionOptions): Promise<void> {
      configure(options.eventBus);
      return Promise.resolve();
    },
    subscribe(...args: Parameters<EventBus['subscribe']>): ReturnType<EventBus['subscribe']> {
      return readyEventBus().subscribe(...args);
    }
  };
});

function isEventBusContext(context: unknown): context is { eventBus: EventBus } {
  return typeof context === 'object' && context !== null && 'eventBus' in context;
}
