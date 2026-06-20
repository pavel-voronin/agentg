import { randomUUID } from 'node:crypto';

import type { Dataset } from '@agentg/data';
import { toJsonValue, type JsonValue } from '@agentg/framework';
import { and, eq, inArray, lte, or, sql } from 'drizzle-orm';

import type { Database } from './database/client.js';
import { runs, type RunStatus } from './database/schema.js';
import type { RunRecord } from './runs/types.js';

export type Store = {
  claimActiveRun(input: { now: Date; runId: string; staleBefore: Date }): Promise<RunRecord | null>;
  createRun(input: {
    inputDataset: Dataset;
    inputMetadata: JsonValue;
    nodeId: string;
    now: Date;
    pipelineRunId: string;
    profile: string;
    prompt: string;
    status: Extract<RunStatus, 'accepted' | 'processing'>;
  }): Promise<RunRecord>;
  getRun(runId: string): Promise<RunRecord | null>;
  listActiveRuns(): Promise<readonly RunRecord[]>;
  markCompleted(input: {
    dataset: Dataset;
    metadata: JsonValue;
    now: Date;
    runId: string;
  }): Promise<void>;
  markFailed(input: {
    code: string;
    message: string;
    metadata?: JsonValue | undefined;
    now: Date;
    runId: string;
  }): Promise<void>;
  refreshProcessingRun(input: { now: Date; runId: string }): Promise<void>;
  readStats(): Promise<Stats>;
};

export type Stats = {
  runStatusCounts: readonly {
    count: number;
    status: RunStatus;
  }[];
};

export function createPostgresStore(database: Database): Store {
  return {
    async claimActiveRun(input) {
      const [updated] = await database
        .update(runs)
        .set({
          status: 'processing',
          updatedAt: input.now
        })
        .where(
          and(
            eq(runs.runId, input.runId),
            or(
              eq(runs.status, 'accepted'),
              and(eq(runs.status, 'processing'), lte(runs.updatedAt, input.staleBefore))
            )
          )
        )
        .returning();
      return updated === undefined ? null : toRun(updated);
    },
    async createRun(input) {
      const row = {
        createdAt: input.now,
        inputDataset: input.inputDataset,
        inputMetadata: input.inputMetadata,
        nodeId: input.nodeId,
        pipelineRunId: input.pipelineRunId,
        profile: input.profile,
        prompt: input.prompt,
        runId: `run_${randomUUID()}`,
        status: input.status,
        updatedAt: input.now
      };
      const [inserted] = await database.insert(runs).values(row).returning();
      if (inserted === undefined) {
        throw new Error('LLM run insert returned no row');
      }
      return toRun(inserted);
    },
    async getRun(runId) {
      const [row] = await database.select().from(runs).where(eq(runs.runId, runId)).limit(1);
      return row === undefined ? null : toRun(row);
    },
    async listActiveRuns() {
      const rows = await database
        .select()
        .from(runs)
        .where(inArray(runs.status, ['accepted', 'processing']))
        .orderBy(runs.updatedAt, runs.runId);
      return rows.map(toRun);
    },
    async markCompleted(input) {
      await database
        .update(runs)
        .set({
          outputDataset: input.dataset,
          outputMetadata: input.metadata,
          status: 'completed',
          updatedAt: input.now
        })
        .where(eq(runs.runId, input.runId));
    },
    async markFailed(input) {
      await database
        .update(runs)
        .set({
          failureCode: input.code,
          failureMessage: input.message,
          outputMetadata: input.metadata ?? null,
          status: 'failed',
          updatedAt: input.now
        })
        .where(eq(runs.runId, input.runId));
    },
    async refreshProcessingRun(input) {
      await database
        .update(runs)
        .set({
          updatedAt: input.now
        })
        .where(and(eq(runs.runId, input.runId), eq(runs.status, 'processing')));
    },
    async readStats() {
      const rows = await database
        .select({
          count: sql<number>`count(*)::int`,
          status: runs.status
        })
        .from(runs)
        .groupBy(runs.status);
      return {
        runStatusCounts: rows.map((row) => ({
          count: row.count,
          status: row.status
        }))
      };
    }
  };
}

export function createMemoryStore(): Store {
  const rows = new Map<string, RunRecord>();
  return {
    claimActiveRun(input) {
      const row = rows.get(input.runId);
      if (
        row === undefined ||
        (row.status !== 'accepted' &&
          !(row.status === 'processing' && row.updatedAt <= input.staleBefore))
      ) {
        return Promise.resolve(null);
      }
      const updated: RunRecord = {
        ...row,
        status: 'processing',
        updatedAt: input.now
      };
      rows.set(input.runId, updated);
      return Promise.resolve(updated);
    },
    createRun(input) {
      const row: RunRecord = {
        createdAt: input.now,
        inputDataset: input.inputDataset,
        inputMetadata: input.inputMetadata,
        nodeId: input.nodeId,
        pipelineRunId: input.pipelineRunId,
        profile: input.profile,
        prompt: input.prompt,
        runId: `run_${randomUUID()}`,
        status: input.status,
        updatedAt: input.now
      };
      rows.set(row.runId, row);
      return Promise.resolve(row);
    },
    getRun(runId) {
      return Promise.resolve(rows.get(runId) ?? null);
    },
    listActiveRuns() {
      return Promise.resolve(
        [...rows.values()]
          .filter((row) => row.status === 'accepted' || row.status === 'processing')
          .sort((left, right) => left.updatedAt.getTime() - right.updatedAt.getTime())
      );
    },
    markCompleted(input) {
      const row = requireRun(rows, input.runId);
      rows.set(input.runId, {
        ...row,
        outputDataset: input.dataset,
        outputMetadata: input.metadata,
        status: 'completed',
        updatedAt: input.now
      });
      return Promise.resolve();
    },
    markFailed(input) {
      const row = requireRun(rows, input.runId);
      rows.set(input.runId, {
        ...row,
        failureCode: input.code,
        failureMessage: input.message,
        outputMetadata: input.metadata,
        status: 'failed',
        updatedAt: input.now
      });
      return Promise.resolve();
    },
    refreshProcessingRun(input) {
      const row = requireRun(rows, input.runId);
      if (row.status !== 'processing') {
        return Promise.resolve();
      }
      rows.set(input.runId, {
        ...row,
        updatedAt: input.now
      });
      return Promise.resolve();
    },
    readStats() {
      const counts = new Map<RunStatus, number>();
      for (const row of rows.values()) {
        counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
      }
      return Promise.resolve({
        runStatusCounts: [...counts.entries()].map(([status, count]) => ({
          count,
          status
        }))
      });
    }
  };
}

function toRun(row: typeof runs.$inferSelect): RunRecord {
  return {
    createdAt: row.createdAt,
    ...(row.failureCode === null ? {} : { failureCode: row.failureCode }),
    ...(row.failureMessage === null ? {} : { failureMessage: row.failureMessage }),
    inputDataset: row.inputDataset,
    inputMetadata: row.inputMetadata,
    nodeId: row.nodeId,
    ...(row.outputDataset === null ? {} : { outputDataset: row.outputDataset }),
    ...(row.outputMetadata === null ? {} : { outputMetadata: row.outputMetadata }),
    pipelineRunId: row.pipelineRunId,
    profile: row.profile,
    prompt: row.prompt,
    runId: row.runId,
    status: row.status,
    updatedAt: row.updatedAt
  };
}

function requireRun(rows: Map<string, RunRecord>, runId: string): RunRecord {
  const row = rows.get(runId);
  if (row === undefined) {
    throw new Error(`LLM run is not found: ${runId}`);
  }
  return row;
}

export function inputMetadata(rowCount: number, outputFormat: 'json' | 'text'): JsonValue {
  return toJsonValue({
    outputFormat,
    rowCount
  });
}
