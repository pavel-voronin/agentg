import { randomUUID } from 'node:crypto';

import { connect, StringCodec, type ConnectionOptions, type NatsConnection } from 'nats';

import type { EventBus, EventBusFactory, EventEnvelope, EventSubscription } from './eventBus.js';
import { consumeEventMessages } from './subscription.js';

type StartedEventBus = Pick<EventBus, 'publish' | 'subscribe' | 'stop'>;

type PendingSubscription = {
  active: EventSubscription | undefined;
  closed: boolean;
  handler: (event: EventEnvelope) => void | Promise<void>;
  subject: string;
};

export function nats(options: ConnectionOptions | string): EventBusFactory {
  const connectionOptions = typeof options === 'string' ? { servers: options } : options;
  assertConnectionTarget(connectionOptions);
  return () => createNatsEventBus(connectionOptions);
}

function createNatsEventBus(options: ConnectionOptions): EventBus {
  const codec = StringCodec();
  const pendingSubscriptions: PendingSubscription[] = [];
  let started: StartedEventBus | undefined;

  return {
    publish(type, data) {
      requireEventBus(started).publish(type, data);
    },
    async start() {
      if (started !== undefined) {
        return;
      }

      const connection = await connect(options);
      started = createStartedEventBus(connection, codec);
      for (const subscription of pendingSubscriptions) {
        attachSubscription(started, subscription);
      }
    },
    async stop() {
      const bus = started;
      started = undefined;
      for (const subscription of pendingSubscriptions) {
        subscription.active?.unsubscribe();
        subscription.active = undefined;
      }
      if (bus !== undefined) {
        await bus.stop();
      }
    },
    subscribe(subject, handler) {
      const subscription: PendingSubscription = {
        active: undefined,
        closed: false,
        handler,
        subject
      };
      pendingSubscriptions.push(subscription);
      if (started !== undefined) {
        attachSubscription(started, subscription);
      }

      return {
        unsubscribe() {
          subscription.closed = true;
          subscription.active?.unsubscribe();
          subscription.active = undefined;
          const index = pendingSubscriptions.indexOf(subscription);
          if (index !== -1) {
            pendingSubscriptions.splice(index, 1);
          }
        }
      };
    }
  };
}

function assertConnectionTarget(options: ConnectionOptions): void {
  if (options.servers === undefined && options.port === undefined) {
    throw new Error('NATS connection requires servers or port');
  }
}

function createStartedEventBus(
  connection: NatsConnection,
  codec: ReturnType<typeof StringCodec>
): StartedEventBus {
  return {
    publish(type, data) {
      connection.publish(type, codec.encode(JSON.stringify(createEventEnvelope(type, data))));
    },
    async stop() {
      await closeEventConnection(connection);
    },
    subscribe(subject, handler) {
      const subscription = connection.subscribe(subject);
      void consumeEventMessages({
        closed: () => connection.isClosed(),
        decode: (data) => codec.decode(data),
        handler,
        source: subscription
      });

      return {
        unsubscribe() {
          subscription.unsubscribe();
        }
      };
    }
  };
}

function createEventEnvelope(type: string, data: unknown): EventEnvelope {
  return {
    at: new Date().toISOString(),
    ...(data === undefined ? {} : { data }),
    id: `evt_${randomUUID()}`,
    type
  };
}

async function closeEventConnection(connection: NatsConnection): Promise<void> {
  const drain = connection.drain();
  const closeAfterTimeout = delay(1000).then(async () => {
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

function attachSubscription(bus: StartedEventBus, subscription: PendingSubscription): void {
  if (subscription.closed || subscription.active !== undefined) {
    return;
  }
  subscription.active = bus.subscribe(subscription.subject, subscription.handler);
}

function requireEventBus(bus: StartedEventBus | undefined): StartedEventBus {
  if (bus === undefined) {
    throw new Error('Event bus is not started');
  }
  return bus;
}
