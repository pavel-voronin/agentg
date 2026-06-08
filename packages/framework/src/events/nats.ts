import { randomUUID } from 'node:crypto';

import { context, propagation, SpanKind } from '@opentelemetry/api';
import {
  ATTR_MESSAGING_DESTINATION_NAME,
  ATTR_MESSAGING_DESTINATION_SUBSCRIPTION_NAME,
  ATTR_MESSAGING_MESSAGE_ID,
  ATTR_MESSAGING_OPERATION_TYPE,
  ATTR_MESSAGING_SYSTEM,
  MESSAGING_OPERATION_TYPE_VALUE_PROCESS,
  MESSAGING_OPERATION_TYPE_VALUE_SEND,
  METRIC_MESSAGING_CLIENT_OPERATION_DURATION,
  METRIC_MESSAGING_PROCESS_DURATION
} from '@opentelemetry/semantic-conventions/incubating';
import { connect, StringCodec, type ConnectionOptions, type NatsConnection } from 'nats';

import {
  startTelemetrySpan,
  timeTelemetrySpan,
  type TelemetryAttributes
} from '../telemetry/index.js';
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
      const envelope = createEventEnvelope(type, data);
      const attributes = publishAttributes(type);
      const span = startTelemetrySpan({
        attributes: {
          ...attributes,
          [ATTR_MESSAGING_MESSAGE_ID]: envelope.id
        },
        kind: SpanKind.PRODUCER,
        metric: {
          attributes,
          name: METRIC_MESSAGING_CLIENT_OPERATION_DURATION
        },
        name: `${type} publish`
      });
      try {
        connection.publish(type, codec.encode(JSON.stringify(envelope)));
        span?.finish({ ok: true });
      } catch (error) {
        span?.finish({ error, ok: false });
        throw error;
      }
    },
    async stop() {
      await closeEventConnection(connection);
    },
    subscribe(subject, handler) {
      const subscription = connection.subscribe(subject);
      void consumeEventMessages({
        closed: () => connection.isClosed(),
        decode: (data) => codec.decode(data),
        handler: (event) => handleEvent(subject, event, handler),
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
    trace: traceCarrier(),
    type
  };
}

function traceCarrier(): Record<string, string> {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  return carrier;
}

function handleEvent(
  subject: string,
  event: EventEnvelope,
  handler: (event: EventEnvelope) => void | Promise<void>
): Promise<void> {
  const activeContext = propagation.extract(context.active(), event.trace);
  const attributes = processAttributes(subject, event.type);
  return context.with(activeContext, () =>
    timeTelemetrySpan(
      {
        attributes: {
          ...attributes,
          [ATTR_MESSAGING_MESSAGE_ID]: event.id
        },
        kind: SpanKind.CONSUMER,
        metric: {
          attributes,
          name: METRIC_MESSAGING_PROCESS_DURATION
        },
        name: `${event.type} process`
      },
      () => Promise.resolve(handler(event))
    )
  );
}

function publishAttributes(type: string): TelemetryAttributes {
  return {
    [ATTR_MESSAGING_DESTINATION_NAME]: type,
    [ATTR_MESSAGING_OPERATION_TYPE]: MESSAGING_OPERATION_TYPE_VALUE_SEND,
    [ATTR_MESSAGING_SYSTEM]: 'nats'
  };
}

function processAttributes(subject: string, type: string): TelemetryAttributes {
  return {
    [ATTR_MESSAGING_DESTINATION_NAME]: type,
    [ATTR_MESSAGING_DESTINATION_SUBSCRIPTION_NAME]: subject,
    [ATTR_MESSAGING_OPERATION_TYPE]: MESSAGING_OPERATION_TYPE_VALUE_PROCESS,
    [ATTR_MESSAGING_SYSTEM]: 'nats'
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
