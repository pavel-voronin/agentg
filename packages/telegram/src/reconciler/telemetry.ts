import {
  incrementTelemetryCounter,
  recordTelemetryHistogram,
  setTelemetryGauge,
  timeTelemetrySpan,
  type TelemetryAttributes
} from '@agentg/framework';

import { ownerKindValues, type OwnerKind } from './owner.js';
import type { JobStatus, ReconcilerStats } from './jobs.js';

export type GetMessagesResult = 'pending_coalesced' | 'pending_enqueued' | 'ready';
export type Transition = 'completed' | 'deferred' | 'failed' | 'skipped_covered';
export type Stage = 'claim' | 'coverage_check' | 'persist' | 'publish' | 'tdlib_fetch';
export type ErrorType =
  | 'coverage_write_error'
  | 'invalid_job'
  | 'storage_error'
  | 'tdlib_error'
  | 'tdlib_unavailable'
  | 'timeout'
  | 'unexpected_error';

const METRIC_GET_MESSAGES_REQUESTS = 'telegram.get_messages.requests';
const METRIC_JOBS = 'telegram.history.reconciler.jobs';
const METRIC_OLDEST_JOB_AGE = 'telegram.history.reconciler.oldest_job_age';
const METRIC_LAST_TRANSITION_SECONDS = 'telegram.history.reconciler.last_transition.seconds';
const METRIC_JOB_DURATION = 'telegram.history.reconciler.job.duration';
const METRIC_STAGE_DURATION = 'telegram.history.reconciler.stage.duration';
const METRIC_MESSAGES = 'telegram.history.reconciler.messages';
const METRIC_PAGES = 'telegram.history.reconciler.pages';
const METRIC_COVERAGE_INTERVALS = 'telegram.history.reconciler.coverage_intervals';
const METRIC_FAILURES = 'telegram.history.reconciler.failures';

export function recordGetMessagesRequest(input: {
  ownerKind: OwnerKind;
  result: GetMessagesResult;
  selectorKind: 'page' | 'range';
}): void {
  incrementTelemetryCounter(METRIC_GET_MESSAGES_REQUESTS, 1, {
    'owner.kind': input.ownerKind,
    result: input.result,
    'selector.kind': input.selectorKind
  });
}

export function recordStats(stats: ReconcilerStats): void {
  const counts = new Map(
    stats.statusCounts.map((row) => [statsKey(row.status, row.ownerKind), row.count])
  );
  const ages = new Map(
    stats.oldestJobAgeSeconds.map((row) => [statsKey(row.status, row.ownerKind), row.value])
  );

  for (const ownerKind of ownerKindValues) {
    for (const status of jobStatusValues()) {
      const attributes = {
        'job.status': status,
        'owner.kind': ownerKind
      };
      setTelemetryGauge(METRIC_JOBS, counts.get(statsKey(status, ownerKind)) ?? 0, attributes);
      setTelemetryGauge(
        METRIC_OLDEST_JOB_AGE,
        ages.get(statsKey(status, ownerKind)) ?? 0,
        attributes
      );
    }
  }
}

export function recordTransition(transition: Transition): void {
  setTelemetryGauge(METRIC_LAST_TRANSITION_SECONDS, Date.now() / 1000, {
    transition
  });
}

export function recordJobDuration(input: {
  errorType?: ErrorType | undefined;
  ownerKind: string;
  result: 'completed' | 'failed';
  seconds: number;
}): void {
  recordTelemetryHistogram(
    METRIC_JOB_DURATION,
    input.seconds,
    {
      ...(input.errorType === undefined ? {} : { 'error.type': input.errorType }),
      'owner.kind': input.ownerKind,
      result: input.result
    },
    { unit: 's' }
  );
}

export function recordMessages(result: 'fetched' | 'stored', count: number): void {
  incrementTelemetryCounter(METRIC_MESSAGES, count, {
    'message.result': result
  });
}

export function recordPage(result: 'empty' | 'fetched'): void {
  incrementTelemetryCounter(METRIC_PAGES, 1, {
    'page.result': result
  });
}

export function recordCoverageIntervals(
  result: 'already_covered' | 'written',
  count: number
): void {
  incrementTelemetryCounter(METRIC_COVERAGE_INTERVALS, count, {
    'coverage.result': result
  });
}

export function recordFailure(stage: Stage, errorType: ErrorType): void {
  incrementTelemetryCounter(METRIC_FAILURES, 1, {
    'error.type': errorType,
    stage
  });
}

export async function timeReconcilerSpan<T>(
  name: `telegram.history.reconciler.${Stage}`,
  attributes: TelemetryAttributes & { stage: Stage },
  operation: () => Promise<T>
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await timeTelemetrySpan(
      {
        attributes,
        name
      },
      operation
    );
    recordStageDuration(attributes.stage, secondsSince(startedAt));
    return result;
  } catch (error) {
    recordStageDuration(attributes.stage, secondsSince(startedAt), errorType(error));
    throw error;
  }
}

export function timeReconcilerTick<T>(operation: () => Promise<T>): Promise<T> {
  return timeTelemetrySpan(
    {
      name: 'telegram.history.reconciler.tick'
    },
    operation
  );
}

export function errorType(error: unknown): ErrorType {
  if (error instanceof Error && error.message.includes('TDLib')) {
    return 'tdlib_error';
  }
  if (error instanceof Error && error.message.includes('coverage')) {
    return 'coverage_write_error';
  }
  if (error instanceof Error && error.message.includes('invalid')) {
    return 'invalid_job';
  }
  return 'unexpected_error';
}

export function jobStatusValues(): JobStatus[] {
  return ['deferred', 'failed', 'queued', 'running'];
}

function statsKey(status: JobStatus, ownerKind: string): string {
  return `${status}:${ownerKind}`;
}

function recordStageDuration(stage: Stage, seconds: number, errorType?: ErrorType): void {
  recordTelemetryHistogram(
    METRIC_STAGE_DURATION,
    seconds,
    {
      ...(errorType === undefined ? {} : { 'error.type': errorType }),
      stage
    },
    { unit: 's' }
  );
}

function secondsSince(startedAt: number): number {
  return Math.max(0, (Date.now() - startedAt) / 1000);
}
