import { performance } from 'node:perf_hooks';

import type { TelemetryRecord, TelemetryRecordBatch } from './contracts.js';

type TelemetryRecordInput = {
  detail?: Record<string, unknown> | undefined;
  durationMs: number;
  error?: unknown;
  kind: string;
  name: string;
  ok: boolean;
  source?: string | undefined;
};

export type TelemetrySpanInput = {
  detail?: Record<string, unknown> | undefined;
  kind: string;
  name: string;
  source?: string | undefined;
};

export type TelemetrySpan = {
  finish(result: {
    detail?: Record<string, unknown> | undefined;
    error?: unknown;
    ok: boolean;
  }): void;
};

const DISABLED_VALUES = new Set(['0', 'false', 'no', 'off']);
const DEFAULT_QUEUE_LIMIT = 50_000;

let droppedRecordCount = 0;
const records: TelemetryRecord[] = [];

export function telemetryEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.AGENTG_TELEMETRY?.trim().toLowerCase();
  return value !== undefined && value.length > 0 && !DISABLED_VALUES.has(value);
}

function telemetrySource(env: NodeJS.ProcessEnv = process.env): string {
  const configuredSource = env.AGENTG_TELEMETRY_SOURCE?.trim();
  if (configuredSource !== undefined && configuredSource.length > 0) {
    return configuredSource;
  }

  return 'unknown';
}

export function startTelemetrySpan(input: TelemetrySpanInput): TelemetrySpan | null {
  if (!telemetryEnabled()) {
    return null;
  }

  const startedAt = performance.now();
  let finished = false;

  return {
    finish(result): void {
      if (finished) {
        return;
      }
      finished = true;
      recordTelemetryEvent({
        detail: result.detail ?? input.detail,
        durationMs: performance.now() - startedAt,
        error: result.error,
        kind: input.kind,
        name: input.name,
        ok: result.ok,
        source: input.source
      });
    }
  };
}

export async function timeTelemetryOperation<T>(
  input: TelemetrySpanInput,
  operation: () => Promise<T>
): Promise<T> {
  const span = startTelemetrySpan(input);
  if (span === null) {
    return operation();
  }

  try {
    const result = await operation();
    span.finish({ ok: true });
    return result;
  } catch (error) {
    span.finish({ error, ok: false });
    throw error;
  }
}

export function drainTelemetryBatch(maxRecords: number): TelemetryRecordBatch | null {
  if (!telemetryEnabled()) {
    records.length = 0;
    droppedRecordCount = 0;
    return null;
  }
  const count = Math.max(0, Math.min(records.length, Math.round(maxRecords)));
  const batchRecords = count === 0 ? [] : records.splice(0, count);
  const dropped = droppedRecordCount;
  droppedRecordCount = 0;
  if (batchRecords.length === 0 && dropped === 0) {
    return null;
  }

  return {
    droppedRecordCount: dropped,
    records: batchRecords,
    source: telemetrySource(),
    version: 1
  };
}

function recordTelemetryEvent(input: TelemetryRecordInput): void {
  if (!telemetryEnabled()) {
    return;
  }

  const detail = input.detail;
  const record: TelemetryRecord = {
    at: new Date().toISOString(),
    durationMs: roundMilliseconds(input.durationMs),
    kind: input.kind,
    name: input.name,
    ok: input.ok,
    source: input.source ?? telemetrySource(),
    version: 1,
    ...(detail === undefined ? {} : { detail }),
    ...(input.error === undefined ? {} : { error: errorMessage(input.error) })
  };

  if (records.length >= telemetryQueueLimit()) {
    droppedRecordCount += 1;
    return;
  }
  records.push(record);
}

function roundMilliseconds(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.round(value * 1000) / 1000;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (
    typeof error === 'string' ||
    typeof error === 'number' ||
    typeof error === 'boolean' ||
    typeof error === 'bigint'
  ) {
    return String(error);
  }
  if (typeof error === 'symbol') {
    return error.description ?? 'unknown error';
  }
  if (error === null || error === undefined) {
    return 'unknown error';
  }

  try {
    return JSON.stringify(error);
  } catch {
    return 'unknown error';
  }
}

function telemetryQueueLimit(): number {
  const configured = Number(process.env.AGENTG_TELEMETRY_QUEUE_LIMIT);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_QUEUE_LIMIT;
  }
  return Math.round(configured);
}
