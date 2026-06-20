import { index, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

import type { JsonValue } from '@agentg/framework';

export const annotations = pgTable(
  'data_annotations',
  {
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    key: text('key').notNull(),
    lineage: jsonb('lineage').$type<JsonValue>().notNull(),
    subjectId: text('subject_id').notNull(),
    subjectModel: text('subject_model').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    value: jsonb('value').$type<JsonValue>().notNull()
  },
  (table) => [
    primaryKey({
      columns: [table.subjectModel, table.subjectId, table.key],
      name: 'data_annotations_pk'
    }),
    index('data_annotations_subject_idx').on(table.subjectModel, table.subjectId),
    index('data_annotations_subject_key_idx').on(table.subjectModel, table.subjectId, table.key)
  ]
);

export const collectionItems = pgTable(
  'data_collection_items',
  {
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    itemId: text('item_id').notNull(),
    key: text('key').notNull(),
    lineage: jsonb('lineage').$type<JsonValue>().notNull(),
    subjectId: text('subject_id').notNull(),
    subjectModel: text('subject_model').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    value: jsonb('value').$type<JsonValue>().notNull()
  },
  (table) => [
    primaryKey({
      columns: [table.subjectModel, table.subjectId, table.key, table.itemId],
      name: 'data_collection_items_pk'
    }),
    index('data_collection_items_subject_idx').on(table.subjectModel, table.subjectId),
    index('data_collection_items_subject_key_idx').on(
      table.subjectModel,
      table.subjectId,
      table.key
    )
  ]
);
