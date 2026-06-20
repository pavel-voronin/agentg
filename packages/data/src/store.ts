import { randomUUID } from 'node:crypto';

import { and, eq, sql } from 'drizzle-orm';

import { toJsonValue, type JsonValue } from '@agentg/framework';

import type { Database } from './database/client.js';
import { annotations, collectionItems } from './database/schema.js';
import { annotationId, collectionItemId } from './ids.js';
import type { ModelRef, WriteAnnotationInput, WriteCollectionItemInput } from './schema.js';

type Annotation = Readonly<{
  createdAt: string;
  key: string;
  lineage: readonly ModelRef[];
  subject: ModelRef;
  updatedAt: string;
  value: JsonValue;
}>;

type CollectionItem = Annotation & Readonly<{ itemId: string }>;

export type WriteResult = Readonly<{
  address: {
    itemId?: string | undefined;
    key: string;
    subject: ModelRef;
  };
  createdAt: string;
  mode: 'append' | 'merge' | 'replace';
  ref: ModelRef;
  updatedAt: string;
}>;

export type Store = {
  getAnnotation(input: { key: string; subject: ModelRef }): Promise<Annotation | null>;
  getCollectionItem(input: {
    itemId: string;
    key: string;
    subject: ModelRef;
  }): Promise<CollectionItem | null>;
  listAnnotations(input: {
    key?: string | undefined;
    subject: ModelRef;
  }): Promise<readonly Annotation[]>;
  listCollection(input: { key: string; subject: ModelRef }): Promise<readonly CollectionItem[]>;
  writeAnnotation(input: WriteAnnotationInput, now: Date): Promise<WriteResult>;
  writeCollectionItem(input: WriteCollectionItemInput, now: Date): Promise<WriteResult>;
};

export function createPostgresStore(database: Database): Store {
  return {
    async getAnnotation(input) {
      const [row] = await database
        .select()
        .from(annotations)
        .where(
          and(
            eq(annotations.subjectModel, input.subject._model),
            eq(annotations.subjectId, input.subject.id),
            eq(annotations.key, input.key)
          )
        )
        .limit(1);
      return row === undefined ? null : annotationFromRow(row);
    },
    async getCollectionItem(input) {
      const [row] = await database
        .select()
        .from(collectionItems)
        .where(
          and(
            eq(collectionItems.subjectModel, input.subject._model),
            eq(collectionItems.subjectId, input.subject.id),
            eq(collectionItems.key, input.key),
            eq(collectionItems.itemId, input.itemId)
          )
        )
        .limit(1);
      return row === undefined ? null : collectionItemFromRow(row);
    },
    async listAnnotations(input) {
      const rows = await database
        .select()
        .from(annotations)
        .where(
          and(
            eq(annotations.subjectModel, input.subject._model),
            eq(annotations.subjectId, input.subject.id),
            input.key === undefined ? undefined : eq(annotations.key, input.key)
          )
        );
      return rows.map(annotationFromRow);
    },
    async listCollection(input) {
      const rows = await database
        .select()
        .from(collectionItems)
        .where(
          and(
            eq(collectionItems.subjectModel, input.subject._model),
            eq(collectionItems.subjectId, input.subject.id),
            eq(collectionItems.key, input.key)
          )
        )
        .orderBy(collectionItems.createdAt, collectionItems.itemId);
      return rows.map(collectionItemFromRow);
    },
    async writeAnnotation(input, now) {
      if (input.mode === 'merge') {
        return mergeAnnotation(database, input, now);
      }
      const [row] = await database
        .insert(annotations)
        .values({
          createdAt: now,
          key: input.key,
          lineage: toJsonValue(input.lineage ?? []),
          subjectId: input.subject.id,
          subjectModel: input.subject._model,
          updatedAt: now,
          value: input.value
        })
        .onConflictDoUpdate({
          set: {
            lineage: toJsonValue(input.lineage ?? []),
            updatedAt: now,
            value: input.value
          },
          target: [annotations.subjectModel, annotations.subjectId, annotations.key]
        })
        .returning();
      if (row === undefined) {
        throw new Error('Annotation write returned no row');
      }
      return annotationWriteResult(annotationFromRow(row), input.mode);
    },
    async writeCollectionItem(input, now) {
      const itemId = input.mode === 'append' ? `item_${randomUUID()}` : input.itemId;
      if (input.mode === 'merge') {
        return mergeCollectionItem(database, input, now);
      }
      const [row] = await database
        .insert(collectionItems)
        .values({
          createdAt: now,
          itemId,
          key: input.key,
          lineage: toJsonValue(input.lineage ?? []),
          subjectId: input.subject.id,
          subjectModel: input.subject._model,
          updatedAt: now,
          value: input.value
        })
        .onConflictDoUpdate({
          set: {
            lineage: toJsonValue(input.lineage ?? []),
            updatedAt: now,
            value: input.value
          },
          target: [
            collectionItems.subjectModel,
            collectionItems.subjectId,
            collectionItems.key,
            collectionItems.itemId
          ]
        })
        .returning();
      if (row === undefined) {
        throw new Error('Collection item write returned no row');
      }
      return collectionWriteResult(collectionItemFromRow(row), input.mode);
    }
  };
}

async function mergeAnnotation(
  database: Database,
  input: WriteAnnotationInput,
  now: Date
): Promise<WriteResult> {
  assertMergeInput(input.value);
  const [row] = await database
    .update(annotations)
    .set({
      lineage: toJsonValue(input.lineage ?? []),
      updatedAt: now,
      value: sql<JsonValue>`${annotations.value} || ${JSON.stringify(input.value)}::jsonb`
    })
    .where(
      and(
        eq(annotations.subjectModel, input.subject._model),
        eq(annotations.subjectId, input.subject.id),
        eq(annotations.key, input.key),
        sql`jsonb_typeof(${annotations.value}) = 'object'`
      )
    )
    .returning();
  if (row === undefined) {
    throw new Error('Data merge mode requires existing and incoming JSON object values');
  }
  return annotationWriteResult(annotationFromRow(row), input.mode);
}

async function mergeCollectionItem(
  database: Database,
  input: WriteCollectionItemInput & { mode: 'merge' },
  now: Date
): Promise<WriteResult> {
  assertMergeInput(input.value);
  const [row] = await database
    .update(collectionItems)
    .set({
      lineage: toJsonValue(input.lineage ?? []),
      updatedAt: now,
      value: sql<JsonValue>`${collectionItems.value} || ${JSON.stringify(input.value)}::jsonb`
    })
    .where(
      and(
        eq(collectionItems.subjectModel, input.subject._model),
        eq(collectionItems.subjectId, input.subject.id),
        eq(collectionItems.key, input.key),
        eq(collectionItems.itemId, input.itemId),
        sql`jsonb_typeof(${collectionItems.value}) = 'object'`
      )
    )
    .returning();
  if (row === undefined) {
    throw new Error('Data merge mode requires existing and incoming JSON object values');
  }
  return collectionWriteResult(collectionItemFromRow(row), input.mode);
}

export function createMemoryStore(): Store {
  const annotationRows = new Map<string, Annotation>();
  const itemRows = new Map<string, CollectionItem>();
  const store: Store = {
    getAnnotation(input) {
      return Promise.resolve(annotationRows.get(annotationKey(input.subject, input.key)) ?? null);
    },
    getCollectionItem(input) {
      return Promise.resolve(
        itemRows.get(collectionKey(input.subject, input.key, input.itemId)) ?? null
      );
    },
    listAnnotations(input) {
      return Promise.resolve(
        [...annotationRows.values()].filter(
          (item) =>
            sameRef(item.subject, input.subject) &&
            (input.key === undefined || item.key === input.key)
        )
      );
    },
    listCollection(input) {
      return Promise.resolve(
        [...itemRows.values()].filter(
          (item) => sameRef(item.subject, input.subject) && item.key === input.key
        )
      );
    },
    writeAnnotation(input, now) {
      return Promise.resolve().then(() => {
        const key = annotationKey(input.subject, input.key);
        const existing = annotationRows.get(key);
        const value = mergeValue({
          existing: existing?.value,
          incoming: input.value,
          mode: input.mode
        });
        const row: Annotation = {
          createdAt: existing?.createdAt ?? now.toISOString(),
          key: input.key,
          lineage: input.lineage ?? [],
          subject: input.subject,
          updatedAt: now.toISOString(),
          value
        };
        annotationRows.set(key, row);
        return annotationWriteResult(row, input.mode);
      });
    },
    writeCollectionItem(input, now) {
      return Promise.resolve().then(() => {
        const itemId = input.mode === 'append' ? `item_${randomUUID()}` : input.itemId;
        const key = collectionKey(input.subject, input.key, itemId);
        const existing = itemRows.get(key);
        const value = mergeValue({
          existing: existing?.value,
          incoming: input.value,
          mode: input.mode
        });
        const row: CollectionItem = {
          createdAt: existing?.createdAt ?? now.toISOString(),
          itemId,
          key: input.key,
          lineage: input.lineage ?? [],
          subject: input.subject,
          updatedAt: now.toISOString(),
          value
        };
        itemRows.set(key, row);
        return collectionWriteResult(row, input.mode);
      });
    }
  };
  return store;
}

function mergeValue(input: {
  existing: JsonValue | undefined;
  incoming: JsonValue;
  mode: 'append' | 'merge' | 'replace';
}): JsonValue {
  if (input.mode !== 'merge') {
    return input.incoming;
  }
  if (!isPlainObject(input.incoming) || !isPlainObject(input.existing)) {
    throw new Error('Data merge mode requires existing and incoming JSON object values');
  }
  return {
    ...input.existing,
    ...input.incoming
  };
}

function assertMergeInput(value: JsonValue): asserts value is Record<string, JsonValue> {
  if (!isPlainObject(value)) {
    throw new Error('Data merge mode requires existing and incoming JSON object values');
  }
}

function annotationFromRow(row: typeof annotations.$inferSelect): Annotation {
  return {
    createdAt: row.createdAt.toISOString(),
    key: row.key,
    lineage: modelRefs(row.lineage),
    subject: {
      _model: row.subjectModel,
      id: row.subjectId
    },
    updatedAt: row.updatedAt.toISOString(),
    value: row.value
  };
}

function collectionItemFromRow(row: typeof collectionItems.$inferSelect): CollectionItem {
  return {
    createdAt: row.createdAt.toISOString(),
    itemId: row.itemId,
    key: row.key,
    lineage: modelRefs(row.lineage),
    subject: {
      _model: row.subjectModel,
      id: row.subjectId
    },
    updatedAt: row.updatedAt.toISOString(),
    value: row.value
  };
}

function modelRefs(value: JsonValue): readonly ModelRef[] {
  return Array.isArray(value)
    ? value
        .filter(
          (item): item is ModelRef =>
            typeof item === 'object' &&
            item !== null &&
            !Array.isArray(item) &&
            typeof item._model === 'string' &&
            typeof item.id === 'string'
        )
        .map((item) => ({ _model: item._model, id: item.id }))
    : [];
}

function annotationWriteResult(annotation: Annotation, mode: 'merge' | 'replace'): WriteResult {
  return {
    address: {
      key: annotation.key,
      subject: annotation.subject
    },
    createdAt: annotation.createdAt,
    mode,
    ref: {
      _model: 'data.annotation',
      id: annotationId({
        key: annotation.key,
        subjectId: annotation.subject.id,
        subjectModel: annotation.subject._model
      })
    },
    updatedAt: annotation.updatedAt
  };
}

function collectionWriteResult(
  item: CollectionItem,
  mode: 'append' | 'merge' | 'replace'
): WriteResult {
  return {
    address: {
      itemId: item.itemId,
      key: item.key,
      subject: item.subject
    },
    createdAt: item.createdAt,
    mode,
    ref: {
      _model: 'data.collectionItem',
      id: collectionItemId({
        itemId: item.itemId,
        key: item.key,
        subjectId: item.subject.id,
        subjectModel: item.subject._model
      })
    },
    updatedAt: item.updatedAt
  };
}

function annotationKey(subject: ModelRef, key: string): string {
  return annotationId({
    key,
    subjectId: subject.id,
    subjectModel: subject._model
  });
}

function collectionKey(subject: ModelRef, key: string, itemId: string): string {
  return collectionItemId({
    itemId,
    key,
    subjectId: subject.id,
    subjectModel: subject._model
  });
}

function sameRef(left: ModelRef, right: ModelRef): boolean {
  return left._model === right._model && left.id === right.id;
}

function isPlainObject(value: unknown): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
