import type { EventBus } from '@agentg/events/bus';
import type { IntegrationEvent } from '@agentg/events/envelope';
import { bindSubsystemContext, defineSubsystem } from '@agentg/framework';
import { currentInternalRpcEventBus } from '@agentg/framework';

import type { HistorySyncServiceOptions } from '../service/runService.js';

export const useEvents = defineSubsystem('events', () => {
  let eventBus: EventBus | undefined;

  function readyEventBus(): EventBus {
    const ready = currentInternalRpcEventBus() ?? eventBus;
    if (ready === undefined) {
      throw new Error('Events resource is not ready');
    }
    return ready;
  }

  return {
    [bindSubsystemContext](context: unknown): void {
      if (isEventBusContext(context)) {
        eventBus = context.eventBus;
      }
    },
    close(): Promise<void> {
      return readyEventBus().close();
    },
    publish(event: IntegrationEvent): void {
      readyEventBus().publish(event);
    },
    start(options: HistorySyncServiceOptions): Promise<void> {
      eventBus = options.eventBus;
      return Promise.resolve();
    },
    subscribe: (...args: Parameters<EventBus['subscribe']>): ReturnType<EventBus['subscribe']> =>
      readyEventBus().subscribe(...args)
  };
});

function isEventBusContext(context: unknown): context is { eventBus: EventBus } {
  return typeof context === 'object' && context !== null && 'eventBus' in context;
}
