export type EventEnvelope = {
  id: string;
  type: string;
  at: string;
  trace: Record<string, string>;
  data?: unknown;
};

export type EventSubscription = {
  unsubscribe(): void;
};

export type EventBus = {
  start(): Promise<void>;
  stop(): Promise<void>;
  publish(type: string, data?: unknown): void;
  subscribe(
    subject: string,
    handler: (event: EventEnvelope) => void | Promise<void>
  ): EventSubscription;
};

export type EventBusFactory = () => EventBus;
