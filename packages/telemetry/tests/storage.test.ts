import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { createStorage } from '../src/storage.js';

describe('telemetry storage', () => {
  it('stores batches and builds reports from SQLite', () => {
    const directory = mkdtempSync(join(tmpdir(), 'agentg-telemetry-'));
    const storage = createStorage({
      path: join(directory, 'events.sqlite')
    });

    try {
      storage.writeBatch({
        droppedRecordCount: 2,
        records: [
          {
            at: '2026-06-04T00:00:00.000Z',
            durationMs: 100,
            kind: 'ingestion.update',
            name: 'updateNewChat',
            ok: true,
            source: 'telegram',
            version: 1
          },
          {
            at: '2026-06-04T00:00:01.000Z',
            durationMs: 300,
            kind: 'ingestion.update',
            name: 'updateNewChat',
            ok: false,
            source: 'telegram',
            version: 1,
            error: 'boom'
          }
        ],
        source: 'telegram',
        version: 1
      });
      storage.writeBatch({
        records: [{ broken: true }],
        source: 'bad',
        version: 1
      });

      const report = storage.readReport();

      expect(report.droppedRecordCount).toBe(2);
      expect(report.errors).toEqual([
        {
          at: '2026-06-04T00:00:01.000Z',
          durationMs: 300,
          error: 'boom',
          kind: 'ingestion.update',
          name: 'updateNewChat',
          ok: false,
          source: 'telegram'
        }
      ]);
      expect(report.generatedInMs).toBeGreaterThanOrEqual(0);
      expect(report.ignoredRecordCount).toBe(1);
      expect(report.maxReportRecordLimit).toBeGreaterThanOrEqual(2);
      expect(report.recordCount).toBe(2);
      expect(report.reportRecordLimit).toBeGreaterThanOrEqual(2);
      expect(report.storageFootprintBytes).toBeGreaterThanOrEqual(report.storageSizeBytes);
      expect(report.storageSizeBytes).toBeGreaterThan(0);
      expect(report.totalRecordCount).toBe(2);
      expect(report.totals).toMatchObject({
        count: 2,
        errorCount: 1,
        maxMs: 300,
        p95Ms: 300,
        totalMs: 400
      });
      expect(report.operations[0]).toMatchObject({
        count: 2,
        errorCount: 1,
        kind: 'ingestion.update',
        name: 'updateNewChat',
        source: 'telegram'
      });
      expect(report.slowestByKind).toEqual([
        {
          kind: 'ingestion.update',
          records: [
            {
              at: '2026-06-04T00:00:01.000Z',
              durationMs: 300,
              error: 'boom',
              kind: 'ingestion.update',
              name: 'updateNewChat',
              ok: false,
              source: 'telegram'
            },
            {
              at: '2026-06-04T00:00:00.000Z',
              durationMs: 100,
              kind: 'ingestion.update',
              name: 'updateNewChat',
              ok: true,
              source: 'telegram'
            }
          ]
        }
      ]);
    } finally {
      storage.close();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it('limits report windows without changing the stored record count', () => {
    const directory = mkdtempSync(join(tmpdir(), 'agentg-telemetry-'));
    const storage = createStorage({
      path: join(directory, 'events.sqlite')
    });

    try {
      storage.writeBatch({
        droppedRecordCount: 0,
        records: [
          {
            at: '2026-06-04T00:00:00.000Z',
            durationMs: 100,
            kind: 'postgres.query',
            name: 'select first',
            ok: true,
            source: 'telegram',
            version: 1
          },
          {
            at: '2026-06-04T00:00:01.000Z',
            durationMs: 200,
            kind: 'postgres.query',
            name: 'select second',
            ok: true,
            source: 'telegram',
            version: 1
          },
          {
            at: '2026-06-04T00:00:02.000Z',
            durationMs: 300,
            kind: 'postgres.query',
            name: 'select third',
            ok: true,
            source: 'telegram',
            version: 1
          }
        ],
        source: 'telegram',
        version: 1
      });

      const report = storage.readReport({ recordLimit: 2 });

      expect(report.recordCount).toBe(2);
      expect(report.reportRecordLimit).toBe(2);
      expect(report.totalRecordCount).toBe(3);
      expect(report.window).toEqual({
        firstAt: '2026-06-04T00:00:01.000Z',
        lastAt: '2026-06-04T00:00:02.000Z'
      });
    } finally {
      storage.close();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it('resets stored telemetry records and counters', () => {
    const directory = mkdtempSync(join(tmpdir(), 'agentg-telemetry-'));
    const storage = createStorage({
      path: join(directory, 'events.sqlite')
    });

    try {
      storage.writeBatch({
        droppedRecordCount: 3,
        records: [
          {
            at: '2026-06-04T00:00:00.000Z',
            durationMs: 100,
            kind: 'ingestion.update',
            name: 'updateNewChat',
            ok: false,
            source: 'telegram',
            version: 1,
            error: 'boom'
          }
        ],
        source: 'telegram',
        version: 1
      });
      storage.writeBatch({
        records: [{ broken: true }],
        source: 'bad',
        version: 1
      });

      storage.reset();
      const report = storage.readReport();

      expect(report.droppedRecordCount).toBe(0);
      expect(report.errors).toEqual([]);
      expect(report.ignoredRecordCount).toBe(0);
      expect(report.recordCount).toBe(0);
      expect(report.slowest).toEqual([]);
      expect(report.storageFootprintBytes).toBeGreaterThanOrEqual(report.storageSizeBytes);
      expect(report.storageSizeBytes).toBeGreaterThan(0);
      expect(report.totalRecordCount).toBe(0);
      expect(report.totals.count).toBe(0);
      expect(report.window).toEqual({
        firstAt: null,
        lastAt: null
      });
    } finally {
      storage.close();
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
