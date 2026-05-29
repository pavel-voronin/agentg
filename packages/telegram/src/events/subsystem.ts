import type { EventBus } from '@agentg/events/bus';
import { defineResourceSubsystem } from '@agentg/framework';

import type { TelegramIngestionModule, TelegramIngestionOptions } from '../tdlib/ingestion.js';

export const useEvents = defineResourceSubsystem<
  EventBus,
  TelegramIngestionOptions,
  TelegramIngestionModule
>('events', {
  fromContext(context) {
    return isEventBusContext(context) ? context.eventBus : undefined;
  },
  fromRun(options) {
    return options.eventBus;
  }
});

function isEventBusContext(context: unknown): context is { eventBus: EventBus } {
  return typeof context === 'object' && context !== null && 'eventBus' in context;
}
