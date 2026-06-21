import type { Dataset } from '@agentg/data';
import type { JsonValue } from '@agentg/framework';
import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex
} from 'drizzle-orm/pg-core';

export const runStatuses = [
  'accepted',
  'running',
  'waiting',
  'completed',
  'failed',
  'cancelled'
] as const;
export const nodeStatuses = [
  'pending',
  'running',
  'waiting',
  'completed',
  'failed',
  'skipped'
] as const;

export type RunStatus = (typeof runStatuses)[number];
export type NodeStatus = (typeof nodeStatuses)[number];

export const definitions = pgTable('pipelines_definitions', {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  document: jsonb('document').$type<JsonValue>().notNull(),
  name: text('name').primaryKey(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  yaml: text('yaml').notNull()
});

export const runs = pgTable(
  'pipelines_runs',
  {
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    definitionSnapshot: jsonb('definition_snapshot').$type<JsonValue>().notNull(),
    failureCode: text('failure_code'),
    failureMessage: text('failure_message'),
    idempotencyKey: text('idempotency_key'),
    name: text('pipeline_name').notNull(),
    runId: text('run_id').primaryKey(),
    status: text('status').$type<RunStatus>().notNull(),
    triggerName: text('trigger_name'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('pipelines_runs_name_idx').on(table.name, table.createdAt),
    uniqueIndex('pipelines_runs_idempotency_idx').on(table.idempotencyKey)
  ]
);

export const nodeRuns = pgTable(
  'pipelines_node_runs',
  {
    actionId: text('action_id').notNull(),
    failureCode: text('failure_code'),
    failureMessage: text('failure_message'),
    inputDataset: jsonb('input_dataset').$type<Dataset>().notNull(),
    nodeId: text('node_id').notNull(),
    outputDataset: jsonb('output_dataset').$type<Dataset>(),
    providerRunId: text('provider_run_id'),
    runId: text('run_id').notNull(),
    status: text('status').$type<NodeStatus>().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({
      columns: [table.runId, table.nodeId],
      name: 'pipelines_node_runs_pk'
    }),
    index('pipelines_node_runs_status_idx').on(table.status)
  ]
);

export const triggerBindings = pgTable(
  'pipelines_trigger_bindings',
  {
    key: text('key').primaryKey(),
    name: text('pipeline_name').notNull(),
    registrationKey: text('registration_key').notNull(),
    triggerName: text('trigger_name').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('pipelines_trigger_bindings_name_idx').on(table.name)]
);
