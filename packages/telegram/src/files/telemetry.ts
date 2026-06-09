import { incrementTelemetryCounter, setTelemetryGauge, timeTelemetrySpan } from '@agentg/framework';

import type { FileDownloadBatchResult } from './runtime.js';

type QueueStatsTelemetry = {
  downloadingCount: number;
  failedCount: number;
  knownCount: number;
  knownDownloadedBytes: number;
  knownRemainingBytes: number;
  knownTotalBytes: number;
  queuedCount: number;
  readyCount: number;
  unknownRemainingCount: number;
};

export type WorkerWakeReason =
  | 'batch_continuation'
  | 'failure_backoff'
  | 'file_download_defer'
  | 'manual_enqueue'
  | 'queue_event'
  | 'slot_enqueue'
  | 'stale_watchdog'
  | 'startup'
  | 'update_file_completed';

type WorkerJobSource = 'batch' | 'completed' | 'stale';

type WorkerJobOutcome = 'claimed' | 'downloading' | 'failed' | 'ready';

type WorkerStage =
  | 'canonicalize_completed'
  | 'claim_batch'
  | 'dispatch_tdlib'
  | 'inspect_tdlib'
  | 'publish_changes'
  | 'reconcile_stale'
  | 'tick';

const METRIC_QUEUE_ASSETS = 'telegram.file.queue.assets';
const METRIC_QUEUE_BYTES = 'telegram.file.queue.bytes';
const METRIC_QUEUE_JOBS = 'telegram.file.queue.jobs';
const METRIC_QUEUE_UNKNOWN_REMAINING = 'telegram.file.queue.unknown_remaining';
const METRIC_WORKER_JOBS = 'telegram.file.worker.jobs';
const METRIC_WORKER_STAGE_DURATION = 'telegram.file.worker.stage.duration';
const METRIC_WORKER_WAKE = 'telegram.file.worker.wake';

export function recordQueueStatsTelemetry(stats: QueueStatsTelemetry): void {
  setTelemetryGauge(METRIC_QUEUE_ASSETS, stats.knownCount, {
    'telegram.file.asset.status': 'known'
  });
  setTelemetryGauge(METRIC_QUEUE_ASSETS, stats.readyCount, {
    'telegram.file.asset.status': 'ready'
  });
  setTelemetryGauge(METRIC_QUEUE_ASSETS, stats.failedCount, {
    'telegram.file.asset.status': 'failed'
  });
  setTelemetryGauge(METRIC_QUEUE_JOBS, stats.queuedCount, {
    'telegram.file.job.status': 'queued'
  });
  setTelemetryGauge(METRIC_QUEUE_JOBS, stats.downloadingCount, {
    'telegram.file.job.status': 'downloading'
  });
  setTelemetryGauge(METRIC_QUEUE_BYTES, stats.knownDownloadedBytes, {
    'telegram.file.queue.bytes.kind': 'downloaded'
  });
  setTelemetryGauge(METRIC_QUEUE_BYTES, stats.knownRemainingBytes, {
    'telegram.file.queue.bytes.kind': 'remaining'
  });
  setTelemetryGauge(METRIC_QUEUE_BYTES, stats.knownTotalBytes, {
    'telegram.file.queue.bytes.kind': 'total'
  });
  setTelemetryGauge(METRIC_QUEUE_UNKNOWN_REMAINING, stats.unknownRemainingCount);
}

export function recordWorkerWake(reason: WorkerWakeReason): void {
  incrementTelemetryCounter(METRIC_WORKER_WAKE, 1, {
    'telegram.file.worker.wake.reason': reason
  });
}

export function recordWorkerJobs(
  source: WorkerJobSource,
  outcome: WorkerJobOutcome,
  count: number
): void {
  if (count <= 0) {
    return;
  }
  incrementTelemetryCounter(METRIC_WORKER_JOBS, count, {
    'telegram.file.worker.job.outcome': outcome,
    'telegram.file.worker.job.source': source
  });
}

export function recordWorkerBatchResult(
  source: WorkerJobSource,
  result: FileDownloadBatchResult
): void {
  recordWorkerJobs(source, 'ready', result.readyCount);
  recordWorkerJobs(source, 'failed', result.failedCount);
  recordWorkerJobs(source, 'downloading', result.watchdogCount);
}

export function timeWorkerStage<T>(stage: WorkerStage, operation: () => Promise<T>) {
  const attributes = {
    'telegram.file.worker.stage': stage
  };
  return timeTelemetrySpan(
    {
      attributes,
      metric: {
        attributes,
        name: METRIC_WORKER_STAGE_DURATION
      },
      name: `telegram.file.worker.${stage}`
    },
    operation
  );
}
