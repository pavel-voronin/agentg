import { connect, StringCodec, type NatsConnection, type Subscription } from 'nats';

import type { IntegrationEvent } from './envelope.js';

export type EventBus = {
  close(): Promise<void>;
  publish(event: IntegrationEvent): void;
  subscribe(
    subject: string,
    handler: (event: IntegrationEvent) => void | Promise<void>
  ): EventSubscription;
};

export type EventSubscription = {
  unsubscribe(): void;
};

export type EventBusConfig = {
  url: string;
};

export async function createNatsEventBus(config: EventBusConfig): Promise<EventBus> {
  const connection = await connect({
    name: 'agentg',
    servers: config.url
  });
  const codec = StringCodec();

  return {
    async close(): Promise<void> {
      await connection.drain();
    },
    publish(event: IntegrationEvent): void {
      connection.publish(event.type, codec.encode(JSON.stringify(event)));
    },
    subscribe(
      subject: string,
      handler: (event: IntegrationEvent) => void | Promise<void>
    ): EventSubscription {
      const subscription = connection.subscribe(subject);
      void consumeSubscription(connection, subscription, handler, codec);

      return {
        unsubscribe(): void {
          subscription.unsubscribe();
        }
      };
    }
  };
}

async function consumeSubscription(
  connection: NatsConnection,
  subscription: Subscription,
  handler: (event: IntegrationEvent) => void | Promise<void>,
  codec: ReturnType<typeof StringCodec>
): Promise<void> {
  try {
    for await (const message of subscription) {
      const event = parseEvent(codec.decode(message.data));
      if (event === undefined) {
        continue;
      }

      await handler(event);
    }
  } catch (error) {
    if (!connection.isClosed()) {
      console.error(
        JSON.stringify({
          event: 'event_bus.subscription_failed',
          error: error instanceof Error ? error.message : String(error),
          subject: subscription.getSubject()
        })
      );
    }
  }
}

function parseEvent(payload: string): IntegrationEvent | undefined {
  try {
    const parsed = JSON.parse(payload) as unknown;
    const record = asRecord(parsed);
    if (
      record === undefined ||
      typeof record.id !== 'string' ||
      typeof record.type !== 'string' ||
      typeof record.source !== 'string' ||
      typeof record.occurredAt !== 'string' ||
      asRecord(record.data) === undefined
    ) {
      return undefined;
    }

    return record as IntegrationEvent;
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}
