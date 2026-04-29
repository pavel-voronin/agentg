import { connect, StringCodec, type NatsConnection, type Subscription } from 'nats';

import { createIntegrationEvent, type IntegrationEvent } from './envelope.js';

export type EventBus = {
  close(): Promise<void>;
  publish(event: IntegrationEvent): void;
  request(event: IntegrationEvent, options?: EventRequestOptions): Promise<IntegrationEvent>;
  respond(
    subject: string,
    handler: (event: IntegrationEvent) => IntegrationEvent | Promise<IntegrationEvent>
  ): EventSubscription;
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

export type EventRequestOptions = {
  timeoutMs?: number;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 5000;
const NATS_DRAIN_TIMEOUT_MS = 1000;

export async function createNatsEventBus(config: EventBusConfig): Promise<EventBus> {
  const connection = await connect({
    name: 'agentg',
    servers: config.url
  });
  const codec = StringCodec();

  return {
    async close(): Promise<void> {
      await closeNatsConnection(connection);
    },
    publish(event: IntegrationEvent): void {
      connection.publish(event.type, codec.encode(JSON.stringify(event)));
    },
    async request(
      event: IntegrationEvent,
      options: EventRequestOptions = {}
    ): Promise<IntegrationEvent> {
      const response = await connection.request(event.type, codec.encode(JSON.stringify(event)), {
        timeout: options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
      });
      const parsed = parseEvent(codec.decode(response.data));
      if (parsed === undefined) {
        throw new Error(`Invalid response for event request: ${event.type}`);
      }

      return parsed;
    },
    respond(
      subject: string,
      handler: (event: IntegrationEvent) => IntegrationEvent | Promise<IntegrationEvent>
    ): EventSubscription {
      const subscription = connection.subscribe(subject);
      void consumeRequestSubscription(connection, subscription, handler, codec);

      return {
        unsubscribe(): void {
          subscription.unsubscribe();
        }
      };
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

async function closeNatsConnection(connection: NatsConnection): Promise<void> {
  const drain = connection.drain();
  const closeAfterTimeout = delay(NATS_DRAIN_TIMEOUT_MS).then(async () => {
    if (!connection.isClosed()) {
      await connection.close();
    }
  });

  await Promise.race([drain, closeAfterTimeout]);
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, milliseconds);
    timeout.unref();
  });
}

async function consumeRequestSubscription(
  connection: NatsConnection,
  subscription: Subscription,
  handler: (event: IntegrationEvent) => IntegrationEvent | Promise<IntegrationEvent>,
  codec: ReturnType<typeof StringCodec>
): Promise<void> {
  try {
    for await (const message of subscription) {
      const event = parseEvent(codec.decode(message.data));
      if (event === undefined) {
        continue;
      }

      let response: IntegrationEvent;
      try {
        response = await handler(event);
      } catch (error) {
        response = createIntegrationEvent({
          data: {
            error: error instanceof Error ? error.message : String(error)
          },
          source: 'event_bus',
          type: `${event.type}.failed`
        });
      }

      message.respond(codec.encode(JSON.stringify(response)));
    }
  } catch (error) {
    if (!connection.isClosed()) {
      console.error(
        JSON.stringify({
          event: 'event_bus.request_subscription_failed',
          error: error instanceof Error ? error.message : String(error),
          subject: subscription.getSubject()
        })
      );
    }
  }
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
