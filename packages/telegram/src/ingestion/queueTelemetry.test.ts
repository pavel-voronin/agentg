import { afterEach, describe, expect, it } from 'vitest';

import { INGESTION_QUEUE_EVENT_TYPE, startIngestionQueueTelemetry } from './queueTelemetry.js';

const originalTelemetry = process.env.AGENTG_TELEMETRY;

describe('ingestion queue telemetry', () => {
  afterEach(() => {
    if (originalTelemetry === undefined) {
      delete process.env.AGENTG_TELEMETRY;
      return;
    }
    process.env.AGENTG_TELEMETRY = originalTelemetry;
  });

  it('publishes queue snapshots when telemetry is enabled', () => {
    process.env.AGENTG_TELEMETRY = '1';
    const published: unknown[] = [];
    const stop = startIngestionQueueTelemetry({
      concurrency: 4,
      events: {
        publish(type, data) {
          published.push({ data, type });
        }
      },
      intervalMs: 60_000,
      snapshot() {
        return {
          pendingCount: 3,
          runningCount: 2
        };
      }
    });

    stop();

    expect(published).toEqual([
      {
        data: {
          pendingUpdateCount: 3,
          runningUpdateCount: 2,
          updateConcurrency: 4
        },
        type: INGESTION_QUEUE_EVENT_TYPE
      },
      {
        data: {
          pendingUpdateCount: 3,
          runningUpdateCount: 2,
          updateConcurrency: 4
        },
        type: INGESTION_QUEUE_EVENT_TYPE
      }
    ]);
  });

  it('does not publish when telemetry is disabled', () => {
    process.env.AGENTG_TELEMETRY = '0';
    const published: unknown[] = [];
    const stop = startIngestionQueueTelemetry({
      concurrency: 4,
      events: {
        publish(type, data) {
          published.push({ data, type });
        }
      },
      snapshot() {
        return {
          pendingCount: 3,
          runningCount: 2
        };
      }
    });

    stop();

    expect(published).toEqual([]);
  });
});
