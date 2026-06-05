import type { EventBus } from '../events/eventBus.js';
import { TELEMETRY_RECORDS_EVENT_TYPE } from './contracts.js';
import { drainTelemetryBatch, telemetryEnabled } from './recorder.js';

export type TelemetryPublisherOptions = {
  batchSize?: number | undefined;
  intervalMs?: number | undefined;
};

const DEFAULT_BATCH_SIZE = 500;
const DEFAULT_INTERVAL_MS = 250;
let publishErrorReported = false;

export function startTelemetryPublisher(
  events: Pick<EventBus, 'publish'>,
  options: TelemetryPublisherOptions = {}
): () => undefined {
  if (!telemetryEnabled()) {
    return () => undefined;
  }

  const batchSize = options.batchSize ?? telemetryBatchSize();
  const flush = (): void => {
    const batch = drainTelemetryBatch(batchSize);
    if (batch === null) {
      return;
    }
    try {
      events.publish(TELEMETRY_RECORDS_EVENT_TYPE, batch);
    } catch (error) {
      reportPublishError(error);
    }
  };

  const interval = setInterval(flush, options.intervalMs ?? DEFAULT_INTERVAL_MS);
  interval.unref();

  return () => {
    clearInterval(interval);
    flush();
    return undefined;
  };
}

function telemetryBatchSize(): number {
  const configured = Number(process.env.AGENTG_TELEMETRY_BATCH_SIZE);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_BATCH_SIZE;
  }
  return Math.round(configured);
}

function reportPublishError(error: unknown): void {
  if (publishErrorReported) {
    return;
  }
  publishErrorReported = true;
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      event: 'telemetry.publish_failed'
    })
  );
}
