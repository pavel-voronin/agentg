import { mkdirSync, statSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  telemetryEnabled,
  type TelemetryMetric,
  type TelemetryRecord,
  type TelemetryRecordBatch,
  type TelemetryReport,
  type TelemetrySlowRecord,
  type TelemetryTotals
} from '@agentg/framework';

export type Storage = {
  close(): void;
  readReport(options?: StorageReportOptions): TelemetryReport;
  reset(): void;
  writeBatch(value: unknown): void;
};

type StorageReportOptions = {
  recordLimit?: number | undefined;
};

type StorageOptions = {
  path: string;
};

type RecordRow = {
  at: string;
  detail_json: string | null;
  duration_ms: number;
  error: string | null;
  kind: string;
  name: string;
  ok: number;
  source: string;
};

type CounterRow = {
  value: number;
};

type MetricBucket = {
  durations: number[];
  errorCount: number;
  kind: string;
  lastAt: string | null;
  name: string;
  source: string;
  totalMs: number;
};

const DEFAULT_REPORT_RECORD_LIMIT = 250_000;
const ERROR_RECORD_LIMIT = 20;
const SLOWEST_RECORD_LIMIT = 20;
const DROPPED_COUNTER = 'dropped_records';
const IGNORED_COUNTER = 'ignored_records';

export function createStorage(options: StorageOptions): Storage {
  const path = resolve(options.path);
  mkdirSync(dirname(path), { recursive: true });
  const database = new DatabaseSync(path);
  prepareDatabase(database);

  const insertRecord = database.prepare(`
    insert into records (
      at,
      detail_json,
      duration_ms,
      error,
      kind,
      name,
      ok,
      source
    ) values (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const incrementCounter = database.prepare(`
    insert into counters (name, value)
    values (?, ?)
    on conflict(name) do update set value = value + excluded.value
  `);
  const readCounter = database.prepare('select value from counters where name = ?');
  const readRecordCount = database.prepare('select count(*) as value from records');
  const readRecords = database.prepare(`
    select
      at,
      detail_json,
      duration_ms,
      error,
      kind,
      name,
      ok,
      source
    from (
      select
        id,
        at,
        detail_json,
        duration_ms,
        error,
        kind,
        name,
        ok,
        source
      from records
      order by id desc
      limit ?
    )
    order by id asc
  `);

  return {
    close() {
      database.close();
    },
    readReport(options = {}) {
      const startedAt = performance.now();
      const maxLimit = maxReportRecordLimit();
      const totalRecordCount = counterValue(readRecordCount.get());
      const limit = reportRecordLimit(options.recordLimit, { maxLimit });
      const records = (readRecords.all(limit) as RecordRow[]).map(recordFromRow);
      const report = reportFromRecords({
        droppedRecordCount: counterValue(readCounter.get(DROPPED_COUNTER)),
        ignoredRecordCount: counterValue(readCounter.get(IGNORED_COUNTER)),
        maxReportRecordLimit: maxLimit,
        records,
        reportRecordLimit: limit,
        storageFootprintBytes: storageFootprintBytes(path),
        storageSizeBytes: storageSizeBytes(path),
        totalRecordCount,
        storage: path
      });
      return {
        ...report,
        generatedInMs: roundMilliseconds(performance.now() - startedAt)
      };
    },
    reset() {
      database.exec(`
        delete from records;
        delete from sqlite_sequence where name = 'records';
        delete from counters;
        pragma wal_checkpoint(TRUNCATE);
        vacuum;
        pragma wal_checkpoint(TRUNCATE);
      `);
    },
    writeBatch(value) {
      const batch = parseBatch(value);
      const ignoredRecordCount = batch.ignoredRecordCount;
      const droppedRecordCount = batch.batch?.droppedRecordCount ?? 0;
      const records = batch.batch?.records ?? [];

      database.exec('BEGIN IMMEDIATE');
      try {
        if (ignoredRecordCount > 0) {
          incrementCounter.run(IGNORED_COUNTER, ignoredRecordCount);
        }
        if (droppedRecordCount > 0) {
          incrementCounter.run(DROPPED_COUNTER, droppedRecordCount);
        }
        for (const record of records) {
          insertRecord.run(
            record.at,
            detailJson(record),
            record.durationMs,
            record.error ?? null,
            record.kind,
            record.name,
            record.ok ? 1 : 0,
            record.source
          );
        }
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    }
  };
}

function prepareDatabase(database: DatabaseSync): void {
  database.exec(`
    pragma journal_mode = WAL;
    pragma synchronous = NORMAL;

    create table if not exists records (
      id integer primary key autoincrement,
      at text not null,
      detail_json text,
      duration_ms real not null,
      error text,
      kind text not null,
      name text not null,
      ok integer not null,
      source text not null
    );

    create index if not exists records_at_idx on records(at);
    create index if not exists records_kind_source_name_idx on records(kind, source, name);
    create index if not exists records_duration_idx on records(duration_ms);

    create table if not exists counters (
      name text primary key not null,
      value integer not null
    );
  `);
}

function parseBatch(value: unknown): {
  batch: TelemetryRecordBatch | null;
  ignoredRecordCount: number;
} {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.records)) {
    return {
      batch: null,
      ignoredRecordCount: 1
    };
  }

  const records: TelemetryRecord[] = [];
  let ignoredRecordCount = 0;
  for (const record of value.records) {
    const parsed = parseRecord(record);
    if (parsed === null) {
      ignoredRecordCount += 1;
    } else {
      records.push(parsed);
    }
  }

  return {
    batch: {
      droppedRecordCount:
        typeof value.droppedRecordCount === 'number' && Number.isFinite(value.droppedRecordCount)
          ? Math.max(0, Math.round(value.droppedRecordCount))
          : 0,
      records,
      source: typeof value.source === 'string' ? value.source : 'unknown',
      version: 1
    },
    ignoredRecordCount
  };
}

function parseRecord(value: unknown): TelemetryRecord | null {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.at !== 'string' ||
    typeof value.durationMs !== 'number' ||
    typeof value.kind !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.ok !== 'boolean' ||
    typeof value.source !== 'string'
  ) {
    return null;
  }

  return {
    at: value.at,
    durationMs: value.durationMs,
    kind: value.kind,
    name: value.name,
    ok: value.ok,
    source: value.source,
    version: 1,
    ...(isRecord(value.detail) ? { detail: value.detail } : {}),
    ...(typeof value.error === 'string' ? { error: value.error } : {})
  };
}

function recordFromRow(row: RecordRow): TelemetryRecord {
  const detail = detailFromJson(row.detail_json);
  return {
    at: row.at,
    durationMs: row.duration_ms,
    kind: row.kind,
    name: row.name,
    ok: row.ok === 1,
    source: row.source,
    version: 1,
    ...(detail === null ? {} : { detail }),
    ...(row.error === null ? {} : { error: row.error })
  };
}

function reportFromRecords(input: {
  droppedRecordCount: number;
  ignoredRecordCount: number;
  maxReportRecordLimit: number;
  records: readonly TelemetryRecord[];
  reportRecordLimit: number;
  storage: string;
  storageFootprintBytes: number;
  storageSizeBytes: number;
  totalRecordCount: number;
}): Omit<TelemetryReport, 'generatedInMs'> {
  return {
    byKind: metricsFor(input.records, (record) => ({
      kind: record.kind,
      name: record.kind,
      source: 'all'
    })).sort(compareMetricsByTotal),
    droppedRecordCount: input.droppedRecordCount,
    enabled: telemetryEnabled(),
    errors: errorRecords(input.records),
    generatedAt: new Date().toISOString(),
    ignoredRecordCount: input.ignoredRecordCount,
    maxReportRecordLimit: input.maxReportRecordLimit,
    operations: metricsFor(input.records, (record) => ({
      kind: record.kind,
      name: record.name,
      source: record.source
    })).sort(compareMetricsByLatency),
    recordCount: input.records.length,
    reportRecordLimit: input.reportRecordLimit,
    slowest: slowRecords(input.records),
    slowestByKind: slowRecordGroups(input.records),
    storage: input.storage,
    storageFootprintBytes: input.storageFootprintBytes,
    storageSizeBytes: input.storageSizeBytes,
    totals: totals(input.records),
    totalRecordCount: input.totalRecordCount,
    window: {
      firstAt: input.records[0]?.at ?? null,
      lastAt: input.records.at(-1)?.at ?? null
    }
  };
}

function metricsFor(
  records: readonly TelemetryRecord[],
  keyForRecord: (record: TelemetryRecord) => { kind: string; name: string; source: string }
): TelemetryMetric[] {
  const buckets = new Map<string, MetricBucket>();
  for (const record of records) {
    const key = keyForRecord(record);
    const bucketKey = `${key.kind}\u0000${key.source}\u0000${key.name}`;
    const bucket =
      buckets.get(bucketKey) ??
      createMetricBucket({ kind: key.kind, name: key.name, source: key.source });
    bucket.durations.push(record.durationMs);
    bucket.errorCount += record.ok ? 0 : 1;
    bucket.lastAt = record.at;
    bucket.totalMs += record.durationMs;
    buckets.set(bucketKey, bucket);
  }

  return [...buckets.values()].map(metricFromBucket);
}

function totals(records: readonly TelemetryRecord[]): TelemetryTotals {
  return totalsFromDurations(
    records.map((record) => record.durationMs),
    records.filter((record) => !record.ok).length
  );
}

function createMetricBucket(input: { kind: string; name: string; source: string }): MetricBucket {
  return {
    durations: [],
    errorCount: 0,
    kind: input.kind,
    lastAt: null,
    name: input.name,
    source: input.source,
    totalMs: 0
  };
}

function metricFromBucket(bucket: MetricBucket): TelemetryMetric {
  return {
    ...totalsFromDurations(bucket.durations, bucket.errorCount),
    kind: bucket.kind,
    lastAt: bucket.lastAt,
    name: bucket.name,
    source: bucket.source
  };
}

function totalsFromDurations(durations: readonly number[], errorCount: number): TelemetryTotals {
  const sorted = durations.toSorted((left, right) => left - right);
  const totalMs = sorted.reduce((total, duration) => total + duration, 0);
  const count = sorted.length;
  return {
    avgMs: roundMilliseconds(count === 0 ? 0 : totalMs / count),
    count,
    errorCount,
    maxMs: roundMilliseconds(sorted.at(-1) ?? 0),
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    p99Ms: percentile(sorted, 0.99),
    totalMs: roundMilliseconds(totalMs)
  };
}

function percentile(sortedDurations: readonly number[], ratio: number): number {
  if (sortedDurations.length === 0) {
    return 0;
  }
  const index = Math.min(
    sortedDurations.length - 1,
    Math.max(0, Math.ceil(sortedDurations.length * ratio) - 1)
  );
  return roundMilliseconds(sortedDurations[index] ?? 0);
}

function slowRecord(record: TelemetryRecord): TelemetrySlowRecord {
  return {
    at: record.at,
    durationMs: record.durationMs,
    kind: record.kind,
    name: record.name,
    ok: record.ok,
    source: record.source,
    ...(record.detail === undefined ? {} : { detail: record.detail }),
    ...(record.error === undefined ? {} : { error: record.error })
  };
}

function slowRecords(records: readonly TelemetryRecord[]): TelemetrySlowRecord[] {
  return records
    .toSorted((left, right) => right.durationMs - left.durationMs)
    .slice(0, SLOWEST_RECORD_LIMIT)
    .map(slowRecord);
}

function errorRecords(records: readonly TelemetryRecord[]): TelemetrySlowRecord[] {
  return records
    .toReversed()
    .filter((record) => !record.ok)
    .slice(0, ERROR_RECORD_LIMIT)
    .map(slowRecord);
}

function slowRecordGroups(records: readonly TelemetryRecord[]): TelemetryReport['slowestByKind'] {
  const groups = new Map<string, TelemetryRecord[]>();
  for (const record of records) {
    const group = groups.get(record.kind) ?? [];
    group.push(record);
    groups.set(record.kind, group);
  }

  return [...groups.entries()]
    .map(([kind, group]) => ({
      kind,
      records: slowRecords(group)
    }))
    .sort((left, right) => left.kind.localeCompare(right.kind));
}

function compareMetricsByLatency(left: TelemetryMetric, right: TelemetryMetric): number {
  return (
    right.p95Ms - left.p95Ms ||
    right.maxMs - left.maxMs ||
    right.totalMs - left.totalMs ||
    left.kind.localeCompare(right.kind) ||
    left.name.localeCompare(right.name)
  );
}

function compareMetricsByTotal(left: TelemetryMetric, right: TelemetryMetric): number {
  return (
    right.totalMs - left.totalMs || right.count - left.count || left.kind.localeCompare(right.kind)
  );
}

function detailJson(record: TelemetryRecord): string | null {
  return record.detail === undefined ? null : JSON.stringify(record.detail);
}

function detailFromJson(value: string | null): Record<string, unknown> | null {
  if (value === null) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function counterValue(value: unknown): number {
  if (!isRecord(value)) {
    return 0;
  }
  const row = value as CounterRow;
  return Number.isFinite(row.value) ? row.value : 0;
}

function reportRecordLimit(
  requestedLimit: StorageReportOptions['recordLimit'],
  input: { maxLimit: number }
): number {
  if (typeof requestedLimit === 'number' && Number.isFinite(requestedLimit)) {
    return Math.min(Math.max(1, Math.round(requestedLimit)), input.maxLimit);
  }
  return input.maxLimit;
}

function storageFootprintBytes(path: string): number {
  return storageSizeBytes(path) + fileSizeBytes(`${path}-wal`) + fileSizeBytes(`${path}-shm`);
}

function storageSizeBytes(path: string): number {
  return fileSizeBytes(path);
}

function fileSizeBytes(path: string): number {
  try {
    return statSync(path).size;
  } catch (error) {
    if (isErrorWithCode(error) && error.code === 'ENOENT') {
      return 0;
    }
    throw error;
  }
}

function maxReportRecordLimit(): number {
  const configured = Number(process.env.AGENTG_TELEMETRY_REPORT_RECORD_LIMIT);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_REPORT_RECORD_LIMIT;
  }
  return Math.round(configured);
}

function roundMilliseconds(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isErrorWithCode(value: unknown): value is { code: string } {
  return isRecord(value) && typeof value.code === 'string';
}
