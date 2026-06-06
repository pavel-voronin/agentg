import { describe, expect, it } from 'vitest';

import {
  reportPageView,
  type ReportSorts,
  type Report
} from '../control-plane/frontend/telemetry/report/reportView.js';

type Metric = Report['operations'][number];

const baseSorts: ReportSorts = {
  database: { direction: 'desc', key: 'total' },
  rpc: { direction: 'desc', key: 'p95' },
  update: { direction: 'desc', key: 'p95' }
};

describe('telemetry report view', () => {
  it('sorts metric rows before applying the row limit', () => {
    const operations = Array.from({ length: 13 }, (_value, index) =>
      metric({
        count: index + 1,
        kind: 'ingestion.update',
        name: `handler-${String(index + 1).padStart(2, '0')}`,
        p95Ms: 100 - index
      })
    );

    const view = reportPageView(report(operations), {
      ...baseSorts,
      update: { direction: 'desc', key: 'count' }
    });

    expect(view.updateRows).toHaveLength(12);
    expect(view.updateRows[0]?.name).toBe('handler-13');
    expect(view.updateRows.at(-1)?.name).toBe('handler-02');
  });

  it('sorts metric rows by visible string columns', () => {
    const view = reportPageView(
      report([
        metric({ kind: 'postgres.query', name: 'query-beta', totalMs: 10 }),
        metric({ kind: 'postgres.query', name: 'query-alpha', totalMs: 20 })
      ]),
      {
        ...baseSorts,
        database: { direction: 'asc', key: 'name' }
      }
    );

    expect(view.databaseRows.map((row) => row.name)).toEqual(['query-alpha', 'query-beta']);
  });

  it('shows telemetry storage footprint in the summary', () => {
    const view = reportPageView(report([]), baseSorts);

    expect(view.storageFootprint).toBe('4 KB');
    expect(view.summaryCards).toContainEqual({
      detail: 'db 4 KB / memory',
      label: 'Storage',
      value: '4 KB'
    });
  });
});

function report(operations: Metric[]): Report {
  return {
    byKind: [],
    droppedRecordCount: 0,
    enabled: true,
    errors: [],
    generatedAt: '2026-06-04T00:00:00.000Z',
    generatedInMs: 1,
    ignoredRecordCount: 0,
    maxReportRecordLimit: 250000,
    operations,
    recordCount: operations.length,
    slowest: [],
    slowestByKind: [],
    storage: 'memory',
    storageFootprintBytes: 4096,
    storageSizeBytes: 4096,
    reportRecordLimit: 250000,
    totals: {
      avgMs: 1,
      count: operations.reduce((sum, operation) => sum + operation.count, 0),
      errorCount: operations.reduce((sum, operation) => sum + operation.errorCount, 0),
      maxMs: 1,
      p50Ms: 1,
      p95Ms: 1,
      p99Ms: 1,
      totalMs: operations.reduce((sum, operation) => sum + operation.totalMs, 0)
    },
    totalRecordCount: operations.length,
    window: {
      firstAt: null,
      lastAt: null
    }
  };
}

function metric(overrides: Partial<Metric> & Pick<Metric, 'kind' | 'name'>): Metric {
  const { kind, name, ...values } = overrides;
  return {
    avgMs: 1,
    count: 1,
    errorCount: 0,
    kind,
    lastAt: null,
    maxMs: 1,
    name,
    p50Ms: 1,
    p95Ms: 1,
    p99Ms: 1,
    source: 'test',
    totalMs: 1,
    ...values
  };
}
