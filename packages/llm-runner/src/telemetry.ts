import {
  incrementTelemetryCounter,
  setTelemetryGauge,
  timeTelemetrySpan,
  type TelemetryAttributes
} from '@agentg/framework';

import { runStatuses } from './database/schema.js';
import type { RuntimeStats } from './store.js';

type RequestSource = 'direct' | 'triggered';
type RequestStatus = 'created' | 'deduplicated' | 'rejected';
type Stage = 'artifact_storage' | 'profile_processing' | 'source_resolution';
type WorkerOperation = 'process_queued';

const METRIC_RUNS = 'llm_runner.runs';
const METRIC_PROCESSABLE_RUNS = 'llm_runner.processable_runs';
const METRIC_OLDEST_PROCESSABLE_AGE = 'llm_runner.oldest_processable_age';
const METRIC_ARTIFACTS = 'llm_runner.artifacts';
const METRIC_RUN_REQUESTS = 'llm_runner.run_requests';
const METRIC_ARTIFACTS_UPDATED = 'llm_runner.artifacts.updated';
const METRIC_WORKER_DURATION = 'llm_runner.worker.duration';
const METRIC_RUN_DURATION = 'llm_runner.run.duration';
const METRIC_STAGE_DURATION = 'llm_runner.stage.duration';

export function recordStats(stats: RuntimeStats): void {
  setTelemetryGauge(METRIC_PROCESSABLE_RUNS, stats.processableRunCount);
  setTelemetryGauge(METRIC_OLDEST_PROCESSABLE_AGE, stats.oldestProcessableRunAgeSeconds);
  setTelemetryGauge(METRIC_ARTIFACTS, stats.artifactCount);
  const counts = new Map(stats.runStatusCounts.map((item) => [item.status, item.count]));
  for (const status of runStatuses) {
    setTelemetryGauge(METRIC_RUNS, counts.get(status) ?? 0, {
      'llm.run.status': status
    });
  }
}

export function recordRunRequest(input: { source: RequestSource; status: RequestStatus }): void {
  incrementTelemetryCounter(METRIC_RUN_REQUESTS, 1, {
    'llm.run.request_source': input.source,
    'llm.run.request_status': input.status
  });
}

export function recordArtifactsUpdated(count: number): void {
  incrementTelemetryCounter(METRIC_ARTIFACTS_UPDATED, count);
}

export function timeWorker<T>(operation: WorkerOperation, work: () => Promise<T>): Promise<T> {
  const attributes: TelemetryAttributes = {
    'llm.runner.operation': operation
  };
  return timeTelemetrySpan(
    {
      attributes,
      metric: {
        attributes,
        name: METRIC_WORKER_DURATION
      },
      name: `llm_runner.${operation}`
    },
    work
  );
}

export function timeRun<T>(work: () => Promise<T>): Promise<T> {
  return timeTelemetrySpan(
    {
      metric: {
        name: METRIC_RUN_DURATION
      },
      name: 'llm_runner.process_run'
    },
    work
  );
}

export function timeStage<T>(stage: Stage, work: () => Promise<T>): Promise<T> {
  const attributes: TelemetryAttributes = {
    'llm.runner.stage': stage
  };
  return timeTelemetrySpan(
    {
      attributes,
      metric: {
        attributes,
        name: METRIC_STAGE_DURATION
      },
      name: `llm_runner.${stage}`
    },
    work
  );
}
