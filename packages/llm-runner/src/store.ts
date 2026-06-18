import { randomUUID } from 'node:crypto';

import { and, eq, inArray } from 'drizzle-orm';
import { toJsonValue } from '@agentg/framework';

import type { ArtifactRecord } from './artifacts/types.js';
import type { Database } from './database/client.js';
import { artifacts, runs, type RunStatus } from './database/schema.js';
import type { ProcessingOutput } from './profiles/types.js';
import type {
  GetCurrentArtifactInput,
  ListArtifactsInput,
  LlmRunPayload,
  SourceRef,
  TriggerProvenance
} from './schema.js';
import type { RunRecord } from './runs/types.js';
import type { SourceSnapshot } from './sources/types.js';

export type Store = {
  createRun(input: {
    deduplicationKey?: string | undefined;
    now: Date;
    payload: LlmRunPayload;
    trigger?: TriggerProvenance | undefined;
  }): Promise<{ created: boolean; run: RunRecord }>;
  getCurrentArtifact(input: GetCurrentArtifactInput): Promise<ArtifactRecord | null>;
  listArtifacts(input: ListArtifactsInput): Promise<readonly ArtifactRecord[]>;
  listProcessableRuns(input: { limit: number }): Promise<readonly RunRecord[]>;
  markFailed(input: { code: string; message: string; now: Date; runId: string }): Promise<void>;
  markStatus(input: { now: Date; runId: string; status: RunStatus }): Promise<void>;
  recordSourceSnapshot(input: {
    now: Date;
    runId: string;
    snapshot: SourceSnapshot;
  }): Promise<void>;
  upsertArtifacts(input: {
    now: Date;
    output: ProcessingOutput;
    run: RunRecord;
    snapshot: SourceSnapshot;
  }): Promise<readonly ArtifactRecord[]>;
};

export function createPostgresStore(database: Database): Store {
  return {
    async createRun(input) {
      if (input.deduplicationKey !== undefined) {
        const existing = await readRunByDeduplicationKey(database, input.deduplicationKey);
        if (existing !== null) {
          return {
            created: false,
            run: existing
          };
        }
      }

      const row = {
        artifactKey: input.payload.artifactKey,
        createdAt: input.now,
        deduplicationKey: input.deduplicationKey ?? null,
        payload: input.payload,
        profile: input.payload.profile,
        runId: `run_${randomUUID()}`,
        status: 'accepted' as const,
        trigger: input.trigger ?? null,
        updatedAt: input.now
      };
      const [inserted] = await database.insert(runs).values(row).onConflictDoNothing().returning();
      if (inserted !== undefined) {
        return {
          created: true,
          run: toRun(inserted)
        };
      }
      if (input.deduplicationKey === undefined) {
        throw new Error('Run insert returned no row');
      }
      const existing = await readRunByDeduplicationKey(database, input.deduplicationKey);
      if (existing === null) {
        throw new Error(`Run was not found for deduplication key: ${input.deduplicationKey}`);
      }
      return {
        created: false,
        run: existing
      };
    },
    async getCurrentArtifact(input) {
      const [row] = await database
        .select()
        .from(artifacts)
        .where(
          and(
            eq(artifacts.artifactKey, input.artifactKey),
            eq(artifacts.sourceRefModel, input.sourceRef._model),
            eq(artifacts.sourceRefId, input.sourceRef.id)
          )
        )
        .limit(1);
      return row === undefined ? null : toArtifact(row);
    },
    async listArtifacts(input) {
      const rows = await database
        .select()
        .from(artifacts)
        .where(
          and(
            input.artifactKey === undefined
              ? undefined
              : eq(artifacts.artifactKey, input.artifactKey),
            eq(artifacts.sourceRefModel, input.sourceRef._model),
            eq(artifacts.sourceRefId, input.sourceRef.id)
          )
        );
      return rows.map(toArtifact);
    },
    async listProcessableRuns(input) {
      const rows = await database
        .select()
        .from(runs)
        .where(inArray(runs.status, ['accepted', 'waitingForSource']))
        .orderBy(runs.updatedAt, runs.runId)
        .limit(input.limit);
      return rows.map(toRun);
    },
    async markFailed(input) {
      await database
        .update(runs)
        .set({
          failureCode: input.code,
          failureMessage: input.message,
          status: 'failed',
          updatedAt: input.now
        })
        .where(eq(runs.runId, input.runId));
    },
    async markStatus(input) {
      await database
        .update(runs)
        .set({
          status: input.status,
          updatedAt: input.now
        })
        .where(eq(runs.runId, input.runId));
    },
    async recordSourceSnapshot(input) {
      await database
        .update(runs)
        .set({
          sourceSnapshot: input.snapshot,
          updatedAt: input.now
        })
        .where(eq(runs.runId, input.runId));
    },
    async upsertArtifacts(input) {
      const records = artifactRecords(input);
      for (const record of records) {
        await database
          .insert(artifacts)
          .values({
            artifactId: record.artifactId,
            artifactKey: record.artifactKey,
            body: record.body,
            contentRefs: toJsonValue(record.contentRefs),
            createdAt: record.createdAt,
            payload: record.payload ?? null,
            profile: record.profile,
            runId: record.runId,
            sourceRefId: record.sourceRef.id,
            sourceRefModel: record.sourceRef._model,
            sourceRefs: toJsonValue(record.sourceRefs),
            status: record.status,
            title: record.title ?? null,
            updatedAt: record.updatedAt
          })
          .onConflictDoUpdate({
            set: {
              body: record.body,
              contentRefs: toJsonValue(record.contentRefs),
              payload: record.payload ?? null,
              profile: record.profile,
              runId: record.runId,
              sourceRefs: toJsonValue(record.sourceRefs),
              status: record.status,
              title: record.title ?? null,
              updatedAt: record.updatedAt
            },
            target: [artifacts.artifactKey, artifacts.sourceRefModel, artifacts.sourceRefId]
          });
      }
      return records;
    }
  };
}

export function createMemoryStore(): Store {
  const runRows = new Map<string, RunRecord>();
  const artifactsByKey = new Map<string, ArtifactRecord>();

  return {
    async createRun(input) {
      if (input.deduplicationKey !== undefined) {
        const existing = [...runRows.values()].find(
          (run) => run.deduplicationKey === input.deduplicationKey
        );
        if (existing !== undefined) {
          return {
            created: false,
            run: existing
          };
        }
      }
      const run: RunRecord = {
        artifactKey: input.payload.artifactKey,
        createdAt: input.now,
        ...(input.deduplicationKey === undefined
          ? {}
          : { deduplicationKey: input.deduplicationKey }),
        payload: input.payload,
        profile: input.payload.profile,
        runId: `run_${String(runRows.size + 1)}`,
        status: 'accepted',
        ...(input.trigger === undefined ? {} : { trigger: input.trigger }),
        updatedAt: input.now
      };
      runRows.set(run.runId, run);
      return Promise.resolve({
        created: true,
        run
      });
    },
    getCurrentArtifact(input) {
      return Promise.resolve(
        artifactsByKey.get(artifactStorageKey(input.artifactKey, input.sourceRef)) ?? null
      );
    },
    listArtifacts(input) {
      return Promise.resolve(
        [...artifactsByKey.values()].filter(
          (artifact) =>
            artifact.sourceRef._model === input.sourceRef._model &&
            artifact.sourceRef.id === input.sourceRef.id &&
            (input.artifactKey === undefined || artifact.artifactKey === input.artifactKey)
        )
      );
    },
    listProcessableRuns(input) {
      return Promise.resolve(
        [...runRows.values()]
          .filter((run) => run.status === 'accepted' || run.status === 'waitingForSource')
          .sort((left, right) => left.updatedAt.getTime() - right.updatedAt.getTime())
          .slice(0, input.limit)
      );
    },
    markFailed(input) {
      updateRun(input.runId, {
        failureCode: input.code,
        failureMessage: input.message,
        status: 'failed',
        updatedAt: input.now
      });
      return Promise.resolve();
    },
    markStatus(input) {
      updateRun(input.runId, {
        status: input.status,
        updatedAt: input.now
      });
      return Promise.resolve();
    },
    recordSourceSnapshot(input) {
      updateRun(input.runId, {
        sourceSnapshot: input.snapshot,
        updatedAt: input.now
      });
      return Promise.resolve();
    },
    upsertArtifacts(input) {
      const records = artifactRecords(input);
      for (const record of records) {
        artifactsByKey.set(artifactStorageKey(record.artifactKey, record.sourceRef), record);
      }
      return Promise.resolve(records);
    }
  };

  function updateRun(runId: string, patch: Partial<RunRecord>): void {
    const run = runRows.get(runId);
    if (run === undefined) {
      throw new Error(`Run is not found: ${runId}`);
    }
    runRows.set(runId, {
      ...run,
      ...patch
    });
  }
}

async function readRunByDeduplicationKey(
  database: Database,
  deduplicationKey: string
): Promise<RunRecord | null> {
  const [row] = await database
    .select()
    .from(runs)
    .where(eq(runs.deduplicationKey, deduplicationKey))
    .limit(1);
  return row === undefined ? null : toRun(row);
}

function artifactRecords(input: {
  now: Date;
  output: ProcessingOutput;
  run: RunRecord;
  snapshot: SourceSnapshot;
}): ArtifactRecord[] {
  if (input.snapshot.sourceRefs.length === 0) {
    throw new Error('Source resolution returned no source refs');
  }
  return input.snapshot.sourceRefs.map((sourceRef) => ({
    artifactId: artifactStorageKey(input.run.artifactKey, sourceRef),
    artifactKey: input.run.artifactKey,
    body: input.output.body,
    contentRefs: input.snapshot.contentRefs,
    createdAt: input.now,
    ...(input.output.payload === undefined ? {} : { payload: input.output.payload }),
    profile: input.run.profile,
    runId: input.run.runId,
    sourceRef,
    sourceRefs: input.snapshot.sourceRefs,
    status: 'current' as const,
    ...(input.output.title === undefined ? {} : { title: input.output.title }),
    updatedAt: input.now
  }));
}

function artifactStorageKey(artifactKey: string, sourceRef: SourceRef): string {
  return `${artifactKey}:${sourceRef._model}:${sourceRef.id}`;
}

function toRun(row: typeof runs.$inferSelect): RunRecord {
  return {
    artifactKey: row.artifactKey,
    createdAt: row.createdAt,
    ...(row.deduplicationKey === null ? {} : { deduplicationKey: row.deduplicationKey }),
    ...(row.failureCode === null ? {} : { failureCode: row.failureCode }),
    ...(row.failureMessage === null ? {} : { failureMessage: row.failureMessage }),
    payload: row.payload,
    profile: row.profile,
    runId: row.runId,
    ...(row.sourceSnapshot === null ? {} : { sourceSnapshot: row.sourceSnapshot }),
    status: row.status,
    ...(row.trigger === null ? {} : { trigger: row.trigger }),
    updatedAt: row.updatedAt
  };
}

function toArtifact(row: typeof artifacts.$inferSelect): ArtifactRecord {
  return {
    artifactId: row.artifactId,
    artifactKey: row.artifactKey,
    body: row.body,
    contentRefs: row.contentRefs as unknown as ArtifactRecord['contentRefs'],
    createdAt: row.createdAt,
    ...(row.payload === null ? {} : { payload: row.payload }),
    profile: row.profile,
    runId: row.runId,
    sourceRef: {
      _model: row.sourceRefModel,
      id: row.sourceRefId
    },
    sourceRefs: row.sourceRefs as unknown as ArtifactRecord['sourceRefs'],
    status: 'current',
    ...(row.title === null ? {} : { title: row.title }),
    updatedAt: row.updatedAt
  };
}
