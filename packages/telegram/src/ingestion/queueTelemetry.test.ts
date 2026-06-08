import { afterEach, describe, expect, it, vi } from 'vitest';

import { startIngestionQueueTelemetry } from './queueTelemetry.js';

const telemetry = vi.hoisted(() => ({
  setTelemetryGauge: vi.fn()
}));

vi.mock('@agentg/framework', async (importOriginal) => {
  const framework = await importOriginal<typeof import('@agentg/framework')>();
  return {
    ...framework,
    setTelemetryGauge: telemetry.setTelemetryGauge
  };
});

const originalTelemetry = process.env.AGENTG_TELEMETRY;

describe('ingestion queue telemetry', () => {
  afterEach(() => {
    telemetry.setTelemetryGauge.mockReset();
    if (originalTelemetry === undefined) {
      delete process.env.AGENTG_TELEMETRY;
      return;
    }
    process.env.AGENTG_TELEMETRY = originalTelemetry;
  });

  it('records queue gauges when telemetry is enabled', () => {
    process.env.AGENTG_TELEMETRY = '1';
    const stop = startIngestionQueueTelemetry({
      concurrency: 4,
      intervalMs: 60_000,
      snapshot() {
        return {
          pendingCount: 3,
          runningCount: 2
        };
      }
    });

    stop();

    expect(telemetry.setTelemetryGauge.mock.calls).toEqual([
      ['telegram.ingestion.queue.pending', 3],
      ['telegram.ingestion.queue.running', 2],
      ['telegram.ingestion.queue.concurrency', 4],
      ['telegram.ingestion.queue.pending', 3],
      ['telegram.ingestion.queue.running', 2],
      ['telegram.ingestion.queue.concurrency', 4]
    ]);
  });

  it('does not record gauges when telemetry is disabled', () => {
    process.env.AGENTG_TELEMETRY = '0';
    const stop = startIngestionQueueTelemetry({
      concurrency: 4,
      snapshot() {
        return {
          pendingCount: 3,
          runningCount: 2
        };
      }
    });

    stop();

    expect(telemetry.setTelemetryGauge).not.toHaveBeenCalled();
  });
});
