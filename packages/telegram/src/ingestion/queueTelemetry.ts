import { setTelemetryGauge, telemetryEnabled } from '@agentg/framework';

type QueueSnapshot = {
  pendingCount: number;
  runningCount: number;
};

type QueueTelemetryOptions = {
  concurrency: number;
  intervalMs?: number | undefined;
  snapshot(): QueueSnapshot;
};

const DEFAULT_INTERVAL_MS = 1000;
const METRIC_PENDING = 'agentg.telegram.ingestion_queue.pending';
const METRIC_RUNNING = 'agentg.telegram.ingestion_queue.running';
const METRIC_CONCURRENCY = 'agentg.telegram.ingestion_queue.concurrency';

export function startIngestionQueueTelemetry(options: QueueTelemetryOptions): () => undefined {
  if (!telemetryEnabled()) {
    return () => undefined;
  }

  const publish = (): void => {
    const snapshot = options.snapshot();
    setTelemetryGauge(METRIC_PENDING, snapshot.pendingCount);
    setTelemetryGauge(METRIC_RUNNING, snapshot.runningCount);
    setTelemetryGauge(METRIC_CONCURRENCY, options.concurrency);
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
