import type { AppEvent } from './events.js';

export type EventHandler<TEvent extends AppEvent = AppEvent> = (
  event: TEvent
) => Promise<void> | void;

export type EventSubscription = {
  unsubscribe(): void;
};

export type EventBus<TEvent extends AppEvent = AppEvent> = {
  close(): void;
  listenerCount(type?: TEvent['type']): number;
  publish(event: TEvent): Promise<void>;
  subscribeAll(handler: EventHandler<TEvent>): EventSubscription;
  subscribe<TType extends TEvent['type']>(
    type: TType,
    handler: EventHandler<TEvent & { type: TType }>
  ): EventSubscription;
};

export function createEventBus<TEvent extends AppEvent = AppEvent>(): EventBus<TEvent> {
  const handlers = new Map<TEvent['type'], Set<EventHandler<TEvent>>>();
  const allHandlers = new Set<EventHandler<TEvent>>();
  let closed = false;

  return {
    close(): void {
      closed = true;
      handlers.clear();
      allHandlers.clear();
    },
    listenerCount(type?: TEvent['type']): number {
      if (type !== undefined) {
        return handlers.get(type)?.size ?? 0;
      }

      let count = 0;
      for (const typedHandlers of handlers.values()) {
        count += typedHandlers.size;
      }
      return count + allHandlers.size;
    },
    async publish(event: TEvent): Promise<void> {
      if (closed) {
        throw new Error('Event bus is closed');
      }

      const typedHandlers = handlers.get(event.type);
      if ((typedHandlers === undefined || typedHandlers.size === 0) && allHandlers.size === 0) {
        return;
      }

      const errors: unknown[] = [];
      for (const handler of [...(typedHandlers ?? []), ...allHandlers]) {
        try {
          await handler(event);
        } catch (error) {
          errors.push(error);
        }
      }

      if (errors.length > 0) {
        throw new AggregateError(errors, `Event handlers failed for ${event.type}`);
      }
    },
    subscribeAll(handler): EventSubscription {
      if (closed) {
        throw new Error('Event bus is closed');
      }

      allHandlers.add(handler);

      return {
        unsubscribe(): void {
          allHandlers.delete(handler);
        }
      };
    },
    subscribe<TType extends TEvent['type']>(
      type: TType,
      handler: EventHandler<TEvent & { type: TType }>
    ): EventSubscription {
      if (closed) {
        throw new Error('Event bus is closed');
      }

      let typedHandlers = handlers.get(type);
      if (typedHandlers === undefined) {
        typedHandlers = new Set<EventHandler<TEvent>>();
        handlers.set(type, typedHandlers);
      }

      const registeredHandler = handler as EventHandler<TEvent>;
      typedHandlers.add(registeredHandler);

      return {
        unsubscribe(): void {
          typedHandlers.delete(registeredHandler);
          if (typedHandlers.size === 0) {
            handlers.delete(type);
          }
        }
      };
    }
  };
}
