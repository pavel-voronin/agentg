import type { JsonValue } from '@agentg/framework';
import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import type { LlmRunPayload, TriggerProvenance } from '../schema.js';
import type { SourceSnapshot } from '../sources/types.js';

export const runStatuses = [
  'accepted',
  'resolvingSource',
  'waitingForSource',
  'processing',
  'storingArtifact',
  'completed',
  'failed',
  'cancelled'
] as const;

export type RunStatus = (typeof runStatuses)[number];

export const runs = pgTable(
  'llm_runner_runs',
  {
    artifactKey: text('artifact_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deduplicationKey: text('deduplication_key'),
    failureCode: text('failure_code'),
    failureMessage: text('failure_message'),
    payload: jsonb('payload').$type<LlmRunPayload>().notNull(),
    profile: text('profile').notNull(),
    runId: text('run_id').primaryKey(),
    sourceSnapshot: jsonb('source_snapshot').$type<SourceSnapshot>(),
    status: text('status').$type<RunStatus>().notNull(),
    trigger: jsonb('trigger').$type<TriggerProvenance>(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex('llm_runner_runs_deduplication_key_idx').on(table.deduplicationKey),
    index('llm_runner_runs_status_idx').on(table.status, table.updatedAt)
  ]
);

export const artifacts = pgTable(
  'llm_runner_artifacts',
  {
    artifactId: text('artifact_id').primaryKey(),
    artifactKey: text('artifact_key').notNull(),
    body: text('body').notNull(),
    contentRefs: jsonb('content_refs').$type<JsonValue>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    payload: jsonb('payload').$type<JsonValue>(),
    profile: text('profile').notNull(),
    runId: text('run_id').notNull(),
    sourceRefId: text('source_ref_id').notNull(),
    sourceRefModel: text('source_ref_model').notNull(),
    sourceRefs: jsonb('source_refs').$type<JsonValue>().notNull(),
    status: text('status').notNull(),
    title: text('title'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex('llm_runner_artifacts_current_idx').on(
      table.artifactKey,
      table.sourceRefModel,
      table.sourceRefId
    ),
    index('llm_runner_artifacts_run_idx').on(table.runId)
  ]
);
