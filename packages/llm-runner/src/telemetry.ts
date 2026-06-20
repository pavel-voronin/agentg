import { performance } from 'node:perf_hooks';

import {
  incrementTelemetryCounter,
  recordTelemetryHistogram,
  setTelemetryGauge,
  telemetryEnabled,
  type TelemetryAttributes
} from '@agentg/framework';

import { runStatuses, type RunStatus } from './database/schema.js';
import type { ProcessingOutput } from './profiles/types.js';
import type { Stats } from './store.js';

type OutputFormat = 'json' | 'text';
type ProviderResult = 'completed' | 'failed';
type RunResult = 'completed' | 'failed';

const METRIC_PROVIDER_DURATION = 'llm_runner.provider.duration';
const METRIC_ROWS_PROCESSED = 'llm_runner.rows.processed';
const METRIC_RUN_DURATION = 'llm_runner.run.duration';
const METRIC_RUNS = 'llm_runner.runs';
const METRIC_RUNS_STARTED = 'llm_runner.runs.started';

export function recordRunStarted(profile: string): void {
  incrementTelemetryCounter(METRIC_RUNS_STARTED, 1, {
    'llm.profile': profile
  });
}

export function recordRowsProcessed(profile: string, result: RunResult, count: number): void {
  incrementTelemetryCounter(METRIC_ROWS_PROCESSED, count, {
    'llm.profile': profile,
    'llm.run.result': result
  });
}

export function recordStats(stats: Stats): void {
  const counts = new Map(stats.runStatusCounts.map((row) => [row.status, row.count]));
  for (const status of runStatuses) {
    setTelemetryGauge(METRIC_RUNS, counts.get(status) ?? 0, {
      'llm.run.status': status
    });
  }
}

export async function recordCurrentStats(read: () => Promise<Stats>): Promise<void> {
  if (!telemetryEnabled()) {
    return;
  }
  recordStats(await read());
}

export function recordRunDuration(
  profile: string,
  result: RunResult,
  startedAt: number,
  error?: unknown
): void {
  recordTelemetryHistogram(
    METRIC_RUN_DURATION,
    Math.max(0, performance.now() - startedAt) / 1000,
    {
      'llm.profile': profile,
      'llm.run.result': result,
      ...errorAttributes(error)
    },
    {
      description: 'LLM action run processing duration by profile and terminal result.',
      unit: 's'
    }
  );
}

export async function timeProviderCall(
  profile: string,
  format: OutputFormat,
  work: () => Promise<ProcessingOutput>
): Promise<ProcessingOutput> {
  const startedAt = performance.now();
  try {
    const result = await work();
    recordProviderDuration(profile, format, 'completed', startedAt);
    return result;
  } catch (error) {
    recordProviderDuration(profile, format, 'failed', startedAt, error);
    throw error;
  }
}

function recordProviderDuration(
  profile: string,
  format: OutputFormat,
  result: ProviderResult,
  startedAt: number,
  error?: unknown
): void {
  recordTelemetryHistogram(
    METRIC_PROVIDER_DURATION,
    Math.max(0, performance.now() - startedAt) / 1000,
    {
      'llm.output.format': format,
      'llm.profile': profile,
      'llm.provider.result': result,
      ...errorAttributes(error)
    },
    {
      description: 'LLM provider call duration by profile, output format, and result.',
      unit: 's'
    }
  );
}

function errorAttributes(error: unknown): TelemetryAttributes {
  if (error === undefined) {
    return {};
  }
  return {
    'error.type': error instanceof Error && error.name.length > 0 ? error.name : typeof error
  };
}

export type { RunStatus };
