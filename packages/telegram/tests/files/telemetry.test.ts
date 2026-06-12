import { afterEach, describe, expect, it, vi } from 'vitest';

const telemetry = vi.hoisted(() => ({
  incrementTelemetryCounter: vi.fn(),
  setTelemetryGauge: vi.fn(),
  timeTelemetrySpan: vi.fn(
    async (_input: unknown, operation: () => Promise<unknown>): Promise<unknown> => operation()
  )
}));

vi.mock('@agentg/framework', async (importOriginal) => {
  const framework = await importOriginal<typeof import('@agentg/framework')>();
  return {
    ...framework,
    incrementTelemetryCounter: telemetry.incrementTelemetryCounter,
    setTelemetryGauge: telemetry.setTelemetryGauge,
    timeTelemetrySpan: telemetry.timeTelemetrySpan
  };
});

import {
  recordFileGenerationOutcome,
  recordQueueStatsTelemetry,
  recordWorkerBatchResult,
  recordWorkerJobs,
  recordWorkerWake,
  timeFileGeneration,
  timeWorkerStage
} from '../../src/files/telemetry.js';

describe('Telegram file telemetry', () => {
  afterEach(() => {
    telemetry.incrementTelemetryCounter.mockReset();
    telemetry.setTelemetryGauge.mockReset();
    telemetry.timeTelemetrySpan.mockClear();
  });

  it('records file queue state gauges with bounded labels', () => {
    recordQueueStatsTelemetry({
      downloadingCount: 2,
      failedCount: 3,
      failureReasonCounts: [
        { count: 1, reason: 'missing_tdlib_file_id' },
        { count: 2, reason: 'not_found' },
        { count: 0, reason: 'stale_retry_limit' },
        { count: 0, reason: 'storage_io' },
        { count: 4, reason: 'tdlib_path_outside_source_roots' },
        { count: 0, reason: 'unknown' }
      ],
      knownCount: 5,
      knownDownloadedBytes: 100,
      knownRemainingBytes: 200,
      knownTotalBytes: 300,
      oldestDownloadingAgeSeconds: 17,
      queuedCount: 7,
      readyCount: 11,
      readyDownloadedBytes: 123456,
      staleDownloadingCount: 19,
      unknownRemainingCount: 13
    });

    expect(telemetry.setTelemetryGauge.mock.calls).toEqual([
      ['telegram.file.queue.assets', 5, { 'telegram.file.asset.status': 'known' }],
      ['telegram.file.queue.assets', 11, { 'telegram.file.asset.status': 'ready' }],
      ['telegram.file.queue.assets', 3, { 'telegram.file.asset.status': 'failed' }],
      ['telegram.file.assets.downloaded_bytes', 123456],
      [
        'telegram.file.queue.failures',
        1,
        { 'telegram.file.failure.reason': 'missing_tdlib_file_id' }
      ],
      ['telegram.file.queue.failures', 2, { 'telegram.file.failure.reason': 'not_found' }],
      ['telegram.file.queue.failures', 0, { 'telegram.file.failure.reason': 'stale_retry_limit' }],
      ['telegram.file.queue.failures', 0, { 'telegram.file.failure.reason': 'storage_io' }],
      [
        'telegram.file.queue.failures',
        4,
        { 'telegram.file.failure.reason': 'tdlib_path_outside_source_roots' }
      ],
      ['telegram.file.queue.failures', 0, { 'telegram.file.failure.reason': 'unknown' }],
      ['telegram.file.queue.jobs', 7, { 'telegram.file.job.status': 'queued' }],
      ['telegram.file.queue.jobs', 2, { 'telegram.file.job.status': 'downloading' }],
      ['telegram.file.queue.oldest_downloading_age', 17],
      ['telegram.file.queue.stale_downloading', 19],
      ['telegram.file.queue.bytes', 100, { 'telegram.file.queue.bytes.kind': 'downloaded' }],
      ['telegram.file.queue.bytes', 200, { 'telegram.file.queue.bytes.kind': 'remaining' }],
      ['telegram.file.queue.bytes', 300, { 'telegram.file.queue.bytes.kind': 'total' }],
      ['telegram.file.queue.unknown_remaining', 13]
    ]);
    expect(JSON.stringify(telemetry.setTelemetryGauge.mock.calls)).not.toContain('assetKey');
  });

  it('records worker wake and job counters with bounded labels', () => {
    recordWorkerWake('queue_event');
    recordWorkerJobs('batch', 'claimed', 4);
    recordWorkerBatchResult('stale', {
      delayedCount: 9,
      failedCount: 1,
      immediateCount: 0,
      processedCount: 3,
      readyCount: 2,
      watchdogCount: 0
    });

    expect(telemetry.incrementTelemetryCounter.mock.calls).toEqual([
      ['telegram.file.worker.wake', 1, { 'telegram.file.worker.wake.reason': 'queue_event' }],
      [
        'telegram.file.worker.jobs',
        4,
        {
          'telegram.file.worker.job.outcome': 'claimed',
          'telegram.file.worker.job.source': 'batch'
        }
      ],
      [
        'telegram.file.worker.jobs',
        2,
        {
          'telegram.file.worker.job.outcome': 'ready',
          'telegram.file.worker.job.source': 'stale'
        }
      ],
      [
        'telegram.file.worker.jobs',
        1,
        {
          'telegram.file.worker.job.outcome': 'failed',
          'telegram.file.worker.job.source': 'stale'
        }
      ]
    ]);
    expect(JSON.stringify(telemetry.incrementTelemetryCounter.mock.calls)).not.toContain('chatId');
    expect(JSON.stringify(telemetry.incrementTelemetryCounter.mock.calls)).not.toContain('delayed');
  });

  it('records file generation outcomes with bounded labels', async () => {
    recordFileGenerationOutcome('completed');
    recordFileGenerationOutcome('failed', 'blocked_url');
    await expect(timeFileGeneration(() => Promise.resolve('ok'))).resolves.toBe('ok');

    expect(telemetry.incrementTelemetryCounter.mock.calls).toEqual([
      [
        'telegram.file.generation.outcomes',
        1,
        {
          'telegram.file.generation.outcome': 'completed'
        }
      ],
      [
        'telegram.file.generation.outcomes',
        1,
        {
          'telegram.file.generation.failure.reason': 'blocked_url',
          'telegram.file.generation.outcome': 'failed'
        }
      ]
    ]);
    expect(telemetry.timeTelemetrySpan).toHaveBeenCalledWith(
      {
        metric: {
          name: 'telegram.file.generation.duration'
        },
        name: 'telegram.file.generation'
      },
      expect.any(Function)
    );
    expect(JSON.stringify(telemetry.incrementTelemetryCounter.mock.calls)).not.toContain('http');
  });

  it('wraps worker stages in stable spans and duration metrics', async () => {
    await expect(timeWorkerStage('claim_batch', () => Promise.resolve('ok'))).resolves.toBe('ok');

    expect(telemetry.timeTelemetrySpan).toHaveBeenCalledWith(
      {
        attributes: {
          'telegram.file.worker.stage': 'claim_batch'
        },
        metric: {
          attributes: {
            'telegram.file.worker.stage': 'claim_batch'
          },
          name: 'telegram.file.worker.stage.duration'
        },
        name: 'telegram.file.worker.claim_batch'
      },
      expect.any(Function)
    );
  });
});
