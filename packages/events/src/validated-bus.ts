import type { EventBus, EventSubscription } from './bus.js';
import type { IntegrationEvent } from './envelope.js';

export type ValidatedEventBusConfig = {
  allowedTypes: readonly string[];
  publisher: string;
};

export function createValidatedEventBus(
  eventBus: EventBus,
  config: ValidatedEventBusConfig
): EventBus {
  const allowedTypes = new Set(config.allowedTypes);

  return {
    close(): Promise<void> {
      return eventBus.close();
    },
    publish(event: IntegrationEvent): void {
      if (!allowedTypes.has(event.type)) {
        throw new Error(
          `Unregistered integration event type for ${config.publisher}: ${event.type}`
        );
      }
      eventBus.publish(event);
    },
    subscribe(
      subject: string,
      handler: (event: IntegrationEvent) => void | Promise<void>
    ): EventSubscription {
      return eventBus.subscribe(subject, handler);
    }
  };
}
