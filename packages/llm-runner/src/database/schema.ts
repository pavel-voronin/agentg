import type { Dataset } from '@agentg/data';
import type { JsonValue } from '@agentg/framework';
import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const runStatuses = ['accepted', 'processing', 'completed', 'failed', 'cancelled'] as const;

export type RunStatus = (typeof runStatuses)[number];

export const runs = pgTable(
  'llm_runner_runs',
  {
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    failureCode: text('failure_code'),
    failureMessage: text('failure_message'),
    inputDataset: jsonb('input_dataset').$type<Dataset>().notNull(),
    inputMetadata: jsonb('input_metadata').$type<JsonValue>().notNull(),
    nodeId: text('pipeline_node_id').notNull(),
    outputDataset: jsonb('output_dataset').$type<Dataset>(),
    outputMetadata: jsonb('output_metadata').$type<JsonValue>(),
    pipelineRunId: text('pipeline_run_id').notNull(),
    profile: text('profile').notNull(),
    prompt: text('prompt').notNull(),
    runId: text('run_id').primaryKey(),
    status: text('status').$type<RunStatus>().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('llm_runner_runs_pipeline_node_idx').on(table.pipelineRunId, table.nodeId),
    index('llm_runner_runs_status_idx').on(table.status, table.updatedAt)
  ]
);
