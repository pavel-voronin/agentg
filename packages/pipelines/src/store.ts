import { randomUUID } from 'node:crypto';

import type { Dataset } from '@agentg/data';
import { toJsonValue } from '@agentg/framework';
import { and, eq, sql } from 'drizzle-orm';

import type { Database } from './database/client.js';
import {
  definitions,
  nodeRuns,
  runs,
  triggerBindings,
  type NodeStatus,
  type RunStatus
} from './database/schema.js';
import { executionContextSchema, type Document, type ExecutionContext } from './schema.js';

export type DefinitionRecord = Readonly<{
  document: Document;
  name: string;
  yaml: string;
}>;

export type RunRecord = Readonly<{
  definitionSnapshot: Document;
  context: ExecutionContext;
  failureCode?: string | undefined;
  failureMessage?: string | undefined;
  idempotencyKey?: string | undefined;
  name: string;
  runId: string;
  status: RunStatus;
  triggerName?: string | undefined;
}>;

export type NodeRecord = Readonly<{
  actionId: string;
  failureCode?: string | undefined;
  failureMessage?: string | undefined;
  inputDataset: Dataset;
  nodeId: string;
  outputDataset?: Dataset | undefined;
  providerRunId?: string | undefined;
  runId: string;
  status: NodeStatus;
}>;

export type Store = {
  createRun(input: {
    definition: Document;
    context: ExecutionContext;
    idempotencyKey?: string | undefined;
    name: string;
    now: Date;
    triggerName?: string | undefined;
  }): Promise<{ created: boolean; run: RunRecord }>;
  deleteDefinition(name: string): Promise<void>;
  findWaitingNode(input: {
    nodeId: string;
    providerRunId: string;
    runId: string;
  }): Promise<NodeRecord | null>;
  getDefinition(name: string): Promise<DefinitionRecord | null>;
  getRun(runId: string): Promise<RunRecord | null>;
  listDefinitions(): Promise<readonly DefinitionRecord[]>;
  listNodeRuns(runId: string): Promise<readonly NodeRecord[]>;
  listRuns(input: {
    pipelineName?: string | undefined;
    status?: RunStatus | undefined;
  }): Promise<readonly RunRecord[]>;
  listWaitingNodes(): Promise<readonly NodeRecord[]>;
  completeWaitingNode(input: {
    dataset: Dataset;
    nodeId: string;
    providerRunId: string;
    runId: string;
  }): Promise<boolean>;
  failWaitingNode(input: {
    code: string;
    message: string;
    nodeId: string;
    providerRunId: string;
    runId: string;
  }): Promise<boolean>;
  markNodeAccepted(input: { nodeId: string; providerRunId: string; runId: string }): Promise<void>;
  markNodeCompleted(input: {
    dataset: Dataset;
    nodeId: string;
    providerRunId?: string | undefined;
    runId: string;
  }): Promise<void>;
  markNodeFailed(input: {
    code: string;
    message: string;
    nodeId: string;
    runId: string;
  }): Promise<void>;
  markNodeRunning(input: {
    actionId: string;
    dataset: Dataset;
    nodeId: string;
    runId: string;
  }): Promise<void>;
  markRunFailed(input: { code: string; message: string; runId: string }): Promise<void>;
  markRunStatus(input: { runId: string; status: RunStatus }): Promise<void>;
  readStats(): Promise<Stats>;
  replaceDefinition(input: {
    bindings: readonly { key: string; registrationKey: string; triggerName: string }[];
    document: Document;
    now: Date;
    yaml: string;
  }): Promise<void>;
};

export type Stats = {
  definitionCount: number;
  nodeStatusCounts: readonly {
    count: number;
    status: NodeStatus;
  }[];
  runStatusCounts: readonly {
    count: number;
    status: RunStatus;
  }[];
};

type StoreDatabase = Pick<Database, 'delete' | 'insert' | 'select' | 'update'>;

export function createPostgresStore(database: Database): Store {
  return {
    async createRun(input) {
      const row = {
        context: toJsonValue(input.context),
        createdAt: input.now,
        definitionSnapshot: toJsonValue(input.definition),
        idempotencyKey: input.idempotencyKey ?? null,
        name: input.name,
        runId: `run_${randomUUID()}`,
        status: 'accepted' as const,
        triggerName: input.triggerName ?? null,
        updatedAt: input.now
      };
      const [inserted] = await database
        .insert(runs)
        .values(row)
        .onConflictDoNothing({
          target: runs.idempotencyKey
        })
        .returning();
      if (inserted === undefined && input.idempotencyKey !== undefined) {
        const existing = await readRunByIdempotencyKey(database, input.idempotencyKey);
        if (existing !== null) {
          return {
            created: false,
            run: existing
          };
        }
      }
      if (inserted === undefined) {
        throw new Error('Pipeline run insert returned no row');
      }
      return {
        created: true,
        run: toRun(inserted)
      };
    },
    async deleteDefinition(name) {
      await database.transaction(async (transaction) => {
        await transaction.delete(definitions).where(eq(definitions.name, name));
        await transaction.delete(triggerBindings).where(eq(triggerBindings.name, name));
      });
    },
    async findWaitingNode(input) {
      const [row] = await database
        .select()
        .from(nodeRuns)
        .where(
          and(
            eq(nodeRuns.runId, input.runId),
            eq(nodeRuns.nodeId, input.nodeId),
            eq(nodeRuns.providerRunId, input.providerRunId),
            eq(nodeRuns.status, 'waiting')
          )
        )
        .limit(1);
      return row === undefined ? null : toNodeRun(row);
    },
    async getDefinition(name) {
      const [row] = await database
        .select()
        .from(definitions)
        .where(eq(definitions.name, name))
        .limit(1);
      return row === undefined ? null : toDefinition(row);
    },
    async getRun(runId) {
      const [row] = await database.select().from(runs).where(eq(runs.runId, runId)).limit(1);
      return row === undefined ? null : toRun(row);
    },
    async listDefinitions() {
      const rows = await database.select().from(definitions).orderBy(definitions.name);
      return rows.map(toDefinition);
    },
    async listNodeRuns(runId) {
      const rows = await database
        .select()
        .from(nodeRuns)
        .where(eq(nodeRuns.runId, runId))
        .orderBy(nodeRuns.nodeId);
      return rows.map(toNodeRun);
    },
    async listRuns(input) {
      const rows = await database
        .select()
        .from(runs)
        .where(
          and(
            input.pipelineName === undefined ? undefined : eq(runs.name, input.pipelineName),
            input.status === undefined ? undefined : eq(runs.status, input.status)
          )
        )
        .orderBy(runs.createdAt);
      return rows.map(toRun);
    },
    async listWaitingNodes() {
      const rows = await database
        .select()
        .from(nodeRuns)
        .where(eq(nodeRuns.status, 'waiting'))
        .orderBy(nodeRuns.runId, nodeRuns.nodeId);
      return rows.map(toNodeRun);
    },
    async completeWaitingNode(input) {
      const [updated] = await database
        .update(nodeRuns)
        .set({
          failureCode: null,
          failureMessage: null,
          outputDataset: input.dataset,
          providerRunId: input.providerRunId,
          status: 'completed',
          updatedAt: new Date()
        })
        .where(
          and(
            eq(nodeRuns.runId, input.runId),
            eq(nodeRuns.nodeId, input.nodeId),
            eq(nodeRuns.providerRunId, input.providerRunId),
            eq(nodeRuns.status, 'waiting')
          )
        )
        .returning({ runId: nodeRuns.runId });
      return updated !== undefined;
    },
    async failWaitingNode(input) {
      const [updated] = await database
        .update(nodeRuns)
        .set({
          outputDataset: null,
          providerRunId: null,
          failureCode: input.code,
          failureMessage: input.message,
          status: 'failed',
          updatedAt: new Date()
        })
        .where(
          and(
            eq(nodeRuns.runId, input.runId),
            eq(nodeRuns.nodeId, input.nodeId),
            eq(nodeRuns.providerRunId, input.providerRunId),
            eq(nodeRuns.status, 'waiting')
          )
        )
        .returning({ runId: nodeRuns.runId });
      return updated !== undefined;
    },
    async markNodeAccepted(input) {
      await database
        .update(nodeRuns)
        .set({
          failureCode: null,
          failureMessage: null,
          outputDataset: null,
          providerRunId: input.providerRunId,
          status: 'waiting',
          updatedAt: new Date()
        })
        .where(and(eq(nodeRuns.runId, input.runId), eq(nodeRuns.nodeId, input.nodeId)));
    },
    async markNodeCompleted(input) {
      await database
        .update(nodeRuns)
        .set({
          failureCode: null,
          failureMessage: null,
          outputDataset: input.dataset,
          providerRunId: input.providerRunId,
          status: 'completed',
          updatedAt: new Date()
        })
        .where(and(eq(nodeRuns.runId, input.runId), eq(nodeRuns.nodeId, input.nodeId)));
    },
    async markNodeFailed(input) {
      await database
        .update(nodeRuns)
        .set({
          outputDataset: null,
          providerRunId: null,
          failureCode: input.code,
          failureMessage: input.message,
          status: 'failed',
          updatedAt: new Date()
        })
        .where(and(eq(nodeRuns.runId, input.runId), eq(nodeRuns.nodeId, input.nodeId)));
    },
    async markNodeRunning(input) {
      await database
        .insert(nodeRuns)
        .values({
          actionId: input.actionId,
          inputDataset: input.dataset,
          nodeId: input.nodeId,
          runId: input.runId,
          status: 'running',
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          set: {
            actionId: input.actionId,
            failureCode: null,
            failureMessage: null,
            inputDataset: input.dataset,
            outputDataset: null,
            providerRunId: null,
            status: 'running',
            updatedAt: new Date()
          },
          target: [nodeRuns.runId, nodeRuns.nodeId]
        });
    },
    async markRunFailed(input) {
      await database
        .update(runs)
        .set({
          failureCode: input.code,
          failureMessage: input.message,
          status: 'failed',
          updatedAt: new Date()
        })
        .where(eq(runs.runId, input.runId));
    },
    async markRunStatus(input) {
      await database
        .update(runs)
        .set({
          status: input.status,
          updatedAt: new Date()
        })
        .where(eq(runs.runId, input.runId));
    },
    async readStats() {
      const [definitionRow] = await database
        .select({
          count: sql<number>`count(*)::int`
        })
        .from(definitions);
      const runRows = await database
        .select({
          count: sql<number>`count(*)::int`,
          status: runs.status
        })
        .from(runs)
        .groupBy(runs.status);
      const nodeRows = await database
        .select({
          count: sql<number>`count(*)::int`,
          status: nodeRuns.status
        })
        .from(nodeRuns)
        .groupBy(nodeRuns.status);

      return {
        definitionCount: definitionRow?.count ?? 0,
        nodeStatusCounts: nodeRows.map((row) => ({
          count: row.count,
          status: row.status
        })),
        runStatusCounts: runRows.map((row) => ({
          count: row.count,
          status: row.status
        }))
      };
    },
    async replaceDefinition(input) {
      await database.transaction(async (transaction) => {
        await upsertDefinition(transaction, input);
        await replaceTriggerBindings(transaction, {
          bindings: input.bindings,
          name: input.document.metadata.name,
          now: input.now
        });
      });
    }
  };
}

export function createMemoryStore(): Store {
  const definitionRows = new Map<string, DefinitionRecord>();
  const runRows = new Map<string, RunRecord>();
  const nodes = new Map<string, NodeRecord>();
  return {
    createRun(input) {
      if (input.idempotencyKey !== undefined) {
        const existing = [...runRows.values()].find(
          (run) => run.idempotencyKey === input.idempotencyKey
        );
        if (existing !== undefined) {
          return Promise.resolve({ created: false, run: existing });
        }
      }
      const run: RunRecord = {
        context: input.context,
        definitionSnapshot: input.definition,
        ...(input.idempotencyKey === undefined ? {} : { idempotencyKey: input.idempotencyKey }),
        name: input.name,
        runId: `run_${randomUUID()}`,
        status: 'accepted',
        ...(input.triggerName === undefined ? {} : { triggerName: input.triggerName })
      };
      runRows.set(run.runId, run);
      return Promise.resolve({ created: true, run });
    },
    deleteDefinition(name) {
      definitionRows.delete(name);
      return Promise.resolve();
    },
    findWaitingNode(input) {
      const node = nodes.get(nodeKey(input.runId, input.nodeId));
      if (node?.providerRunId === input.providerRunId && node.status === 'waiting') {
        return Promise.resolve(node);
      }
      return Promise.resolve(null);
    },
    getDefinition(name) {
      return Promise.resolve(definitionRows.get(name) ?? null);
    },
    getRun(runId) {
      return Promise.resolve(runRows.get(runId) ?? null);
    },
    listDefinitions() {
      return Promise.resolve([...definitionRows.values()]);
    },
    listNodeRuns(runId) {
      return Promise.resolve([...nodes.values()].filter((node) => node.runId === runId));
    },
    listRuns(input) {
      return Promise.resolve(
        [...runRows.values()].filter(
          (run) =>
            (input.pipelineName === undefined || run.name === input.pipelineName) &&
            (input.status === undefined || run.status === input.status)
        )
      );
    },
    listWaitingNodes() {
      return Promise.resolve([...nodes.values()].filter((node) => node.status === 'waiting'));
    },
    completeWaitingNode(input) {
      const node = nodes.get(nodeKey(input.runId, input.nodeId));
      if (node?.status !== 'waiting' || node.providerRunId !== input.providerRunId) {
        return Promise.resolve(false);
      }
      patchNode(nodes, input.runId, input.nodeId, {
        failureCode: undefined,
        failureMessage: undefined,
        outputDataset: input.dataset,
        providerRunId: input.providerRunId,
        status: 'completed'
      });
      return Promise.resolve(true);
    },
    failWaitingNode(input) {
      const node = nodes.get(nodeKey(input.runId, input.nodeId));
      if (node?.status !== 'waiting' || node.providerRunId !== input.providerRunId) {
        return Promise.resolve(false);
      }
      patchNode(nodes, input.runId, input.nodeId, {
        failureCode: input.code,
        failureMessage: input.message,
        outputDataset: undefined,
        providerRunId: undefined,
        status: 'failed'
      });
      return Promise.resolve(true);
    },
    markNodeAccepted(input) {
      patchNode(nodes, input.runId, input.nodeId, {
        failureCode: undefined,
        failureMessage: undefined,
        outputDataset: undefined,
        providerRunId: input.providerRunId,
        status: 'waiting'
      });
      return Promise.resolve();
    },
    markNodeCompleted(input) {
      patchNode(nodes, input.runId, input.nodeId, {
        failureCode: undefined,
        failureMessage: undefined,
        outputDataset: input.dataset,
        ...(input.providerRunId === undefined ? {} : { providerRunId: input.providerRunId }),
        status: 'completed'
      });
      return Promise.resolve();
    },
    markNodeFailed(input) {
      patchNode(nodes, input.runId, input.nodeId, {
        failureCode: input.code,
        failureMessage: input.message,
        outputDataset: undefined,
        providerRunId: undefined,
        status: 'failed'
      });
      return Promise.resolve();
    },
    markNodeRunning(input) {
      nodes.set(nodeKey(input.runId, input.nodeId), {
        actionId: input.actionId,
        inputDataset: input.dataset,
        nodeId: input.nodeId,
        runId: input.runId,
        status: 'running'
      });
      return Promise.resolve();
    },
    markRunFailed(input) {
      patchRun(runRows, input.runId, {
        failureCode: input.code,
        failureMessage: input.message,
        status: 'failed'
      });
      return Promise.resolve();
    },
    markRunStatus(input) {
      patchRun(runRows, input.runId, {
        status: input.status
      });
      return Promise.resolve();
    },
    readStats() {
      return Promise.resolve({
        definitionCount: definitionRows.size,
        nodeStatusCounts: countsByStatus([...nodes.values()].map((node) => node.status)),
        runStatusCounts: countsByStatus([...runRows.values()].map((run) => run.status))
      });
    },
    replaceDefinition(input) {
      definitionRows.set(input.document.metadata.name, {
        document: input.document,
        name: input.document.metadata.name,
        yaml: input.yaml
      });
      return Promise.resolve();
    }
  };
}

function countsByStatus<TStatus extends string>(
  statuses: readonly TStatus[]
): readonly { count: number; status: TStatus }[] {
  const counts = new Map<TStatus, number>();
  for (const status of statuses) {
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return [...counts.entries()].map(([status, count]) => ({
    count,
    status
  }));
}

async function upsertDefinition(
  database: StoreDatabase,
  input: { document: Document; now: Date; yaml: string }
): Promise<void> {
  await database
    .insert(definitions)
    .values({
      document: toJsonValue(input.document),
      name: input.document.metadata.name,
      updatedAt: input.now,
      yaml: input.yaml
    })
    .onConflictDoUpdate({
      set: {
        document: toJsonValue(input.document),
        updatedAt: input.now,
        yaml: input.yaml
      },
      target: definitions.name
    });
}

async function replaceTriggerBindings(
  database: StoreDatabase,
  input: {
    bindings: readonly { key: string; registrationKey: string; triggerName: string }[];
    name: string;
    now: Date;
  }
): Promise<void> {
  await database.delete(triggerBindings).where(eq(triggerBindings.name, input.name));
  if (input.bindings.length === 0) {
    return;
  }
  await database.insert(triggerBindings).values(
    input.bindings.map((binding) => ({
      key: binding.key,
      name: input.name,
      registrationKey: binding.registrationKey,
      triggerName: binding.triggerName,
      updatedAt: input.now
    }))
  );
}

async function readRunByIdempotencyKey(
  database: Database,
  idempotencyKey: string
): Promise<RunRecord | null> {
  const [row] = await database
    .select()
    .from(runs)
    .where(eq(runs.idempotencyKey, idempotencyKey))
    .limit(1);
  return row === undefined ? null : toRun(row);
}

function toDefinition(row: typeof definitions.$inferSelect): DefinitionRecord {
  return {
    document: row.document as unknown as Document,
    name: row.name,
    yaml: row.yaml
  };
}

function toRun(row: typeof runs.$inferSelect): RunRecord {
  return {
    context: executionContextSchema.parse(row.context),
    definitionSnapshot: row.definitionSnapshot as unknown as Document,
    ...(row.failureCode === null ? {} : { failureCode: row.failureCode }),
    ...(row.failureMessage === null ? {} : { failureMessage: row.failureMessage }),
    ...(row.idempotencyKey === null ? {} : { idempotencyKey: row.idempotencyKey }),
    name: row.name,
    runId: row.runId,
    status: row.status,
    ...(row.triggerName === null ? {} : { triggerName: row.triggerName })
  };
}

function toNodeRun(row: typeof nodeRuns.$inferSelect): NodeRecord {
  return {
    actionId: row.actionId,
    ...(row.failureCode === null ? {} : { failureCode: row.failureCode }),
    ...(row.failureMessage === null ? {} : { failureMessage: row.failureMessage }),
    inputDataset: row.inputDataset,
    nodeId: row.nodeId,
    ...(row.outputDataset === null ? {} : { outputDataset: row.outputDataset }),
    ...(row.providerRunId === null ? {} : { providerRunId: row.providerRunId }),
    runId: row.runId,
    status: row.status
  };
}

function nodeKey(runId: string, nodeId: string): string {
  return `${runId}:${nodeId}`;
}

function patchNode(
  rows: Map<string, NodeRecord>,
  runId: string,
  nodeId: string,
  patch: Partial<NodeRecord>
): void {
  const existing = rows.get(nodeKey(runId, nodeId));
  if (existing === undefined) {
    throw new Error(`Pipeline node run is not found: ${runId}/${nodeId}`);
  }
  rows.set(nodeKey(runId, nodeId), {
    ...existing,
    ...patch
  });
}

function patchRun(rows: Map<string, RunRecord>, runId: string, patch: Partial<RunRecord>): void {
  const existing = rows.get(runId);
  if (existing === undefined) {
    throw new Error(`Pipeline run is not found: ${runId}`);
  }
  rows.set(runId, {
    ...existing,
    ...patch
  });
}
