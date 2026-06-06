import { telemetryEnabled, type EventBus } from '@agentg/framework';

type QueueSnapshot = {
  pendingCount: number;
  runningCount: number;
};

type QueueTelemetryOptions = {
  concurrency: number;
  events: Pick<EventBus, 'publish'>;
  intervalMs?: number | undefined;
  snapshot(): QueueSnapshot;
};

const INGESTION_QUEUE_EVENT_TYPE = 'telegram.ingestion-queue';
const DEFAULT_INTERVAL_MS = 1000;

export function startIngestionQueueTelemetry(options: QueueTelemetryOptions): () => undefined {
  if (!telemetryEnabled()) {
    return () => undefined;
  }

  const publish = (): void => {
    const snapshot = options.snapshot();
    options.events.publish(INGESTION_QUEUE_EVENT_TYPE, {
      pendingUpdateCount: snapshot.pendingCount,
      runningUpdateCount: snapshot.runningCount,
      updateConcurrency: options.concurrency
    });
  };

  publish();
  const interval = setInterval(publish, options.intervalMs ?? DEFAULT_INTERVAL_MS);
  interval.unref();

  return () => {
    clearInterval(interval);
    publish();
    return undefined;
  };
}

export { INGESTION_QUEUE_EVENT_TYPE };
