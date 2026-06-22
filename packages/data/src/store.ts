import { randomUUID } from 'node:crypto';

import { and, asc, desc, eq, gt, gte, lt, lte, sql, type SQL } from 'drizzle-orm';

import { toJsonValue, type JsonValue } from '@agentg/framework';

import type { Database } from './database/client.js';
import { annotations, collectionItems } from './database/schema.js';
import { annotationId, collectionItemId } from './ids.js';
import { summarizeDerivedStorage, type Overview } from './overview.js';
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

export type PageResult<T> = Readonly<{
  hasMore: boolean;
  rows: readonly T[];
  total?: number | undefined;
}>;

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

type BrowseInput = {
  key?: string | undefined;
  limit: number;
  offset: number;
  sort?: SortInput | undefined;
  subject?: ModelRef | undefined;
  subjectModel?: string | undefined;
  where?: BrowseWhere | undefined;
};

type BrowseWhere = Readonly<{
  itemIdNotQuery?: string | undefined;
  itemIdQuery?: string | undefined;
  subjectNotQuery?: string | undefined;
  subjectQuery?: string | undefined;
  updatedAtGt?: string | undefined;
  updatedAtGte?: string | undefined;
  updatedAtLt?: string | undefined;
  updatedAtLte?: string | undefined;
  valueNotQuery?: string | undefined;
  valueQuery?: string | undefined;
}>;

type SortInput = Readonly<{
  direction: 'asc' | 'desc';
  key: string;
}>;

export type Store = {
  browseAnnotations(input: BrowseInput): Promise<PageResult<Annotation>>;
  browseCollection(input: BrowseInput): Promise<PageResult<CollectionItem>>;
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
  overview(): Promise<Overview['derivedStorage']>;
  writeAnnotation(input: WriteAnnotationInput, now: Date): Promise<WriteResult>;
  writeCollectionItem(input: WriteCollectionItemInput, now: Date): Promise<WriteResult>;
};

export function createPostgresStore(database: Database): Store {
  return {
    async browseAnnotations(input) {
      const where = annotationBrowseWhere(input);
      const total = await countAnnotationRows(database, where);
      const rows = await database
        .select()
        .from(annotations)
        .where(where)
        .orderBy(...annotationOrderBy(input))
        .limit(input.limit)
        .offset(input.offset);
      return pageResult(rows.map(annotationFromRow), total, input);
    },
    async browseCollection(input) {
      const where = collectionBrowseWhere(input);
      const total = await countCollectionRows(database, where);
      const rows = await database
        .select()
        .from(collectionItems)
        .where(where)
        .orderBy(...collectionOrderBy(input))
        .limit(input.limit)
        .offset(input.offset);
      return pageResult(rows.map(collectionItemFromRow), total, input);
    },
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
    async overview() {
      const annotationRows = await database
        .select({
          key: annotations.key,
          subjectId: annotations.subjectId,
          subjectModel: annotations.subjectModel,
          updatedAt: annotations.updatedAt
        })
        .from(annotations);
      const collectionRows = await database
        .select({
          itemId: collectionItems.itemId,
          key: collectionItems.key,
          subjectId: collectionItems.subjectId,
          subjectModel: collectionItems.subjectModel,
          updatedAt: collectionItems.updatedAt
        })
        .from(collectionItems);

      return {
        annotations: summarizeDerivedStorage(
          'annotation',
          annotationRows.map((row) => ({
            key: row.key,
            subject: {
              _model: row.subjectModel,
              id: row.subjectId
            },
            updatedAt: row.updatedAt.toISOString()
          }))
        ),
        collectionItems: summarizeDerivedStorage(
          'collectionItem',
          collectionRows.map((row) => ({
            itemId: row.itemId,
            key: row.key,
            subject: {
              _model: row.subjectModel,
              id: row.subjectId
            },
            updatedAt: row.updatedAt.toISOString()
          }))
        )
      };
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

function annotationBrowseWhere(input: BrowseInput) {
  const where = input.where;
  return and(
    input.key === undefined ? undefined : eq(annotations.key, input.key),
    input.subject === undefined ? undefined : eq(annotations.subjectModel, input.subject._model),
    input.subject === undefined ? undefined : eq(annotations.subjectId, input.subject.id),
    input.subjectModel === undefined ? undefined : eq(annotations.subjectModel, input.subjectModel),
    textQueryWhere(
      sql`${annotations.subjectModel} || ':' || ${annotations.subjectId}`,
      where?.subjectQuery
    ),
    notTextQueryWhere(
      sql`${annotations.subjectModel} || ':' || ${annotations.subjectId}`,
      where?.subjectNotQuery
    ),
    textQueryWhere(sql`${annotations.value}::text`, where?.valueQuery),
    notTextQueryWhere(sql`${annotations.value}::text`, where?.valueNotQuery),
    where?.updatedAtGte === undefined
      ? undefined
      : gte(annotations.updatedAt, new Date(where.updatedAtGte)),
    where?.updatedAtGt === undefined
      ? undefined
      : gt(annotations.updatedAt, new Date(where.updatedAtGt)),
    where?.updatedAtLte === undefined
      ? undefined
      : lte(annotations.updatedAt, new Date(where.updatedAtLte)),
    where?.updatedAtLt === undefined
      ? undefined
      : lt(annotations.updatedAt, new Date(where.updatedAtLt))
  );
}

function collectionBrowseWhere(input: BrowseInput) {
  const where = input.where;
  return and(
    input.key === undefined ? undefined : eq(collectionItems.key, input.key),
    input.subject === undefined
      ? undefined
      : eq(collectionItems.subjectModel, input.subject._model),
    input.subject === undefined ? undefined : eq(collectionItems.subjectId, input.subject.id),
    input.subjectModel === undefined
      ? undefined
      : eq(collectionItems.subjectModel, input.subjectModel),
    textQueryWhere(
      sql`${collectionItems.subjectModel} || ':' || ${collectionItems.subjectId}`,
      where?.subjectQuery
    ),
    notTextQueryWhere(
      sql`${collectionItems.subjectModel} || ':' || ${collectionItems.subjectId}`,
      where?.subjectNotQuery
    ),
    textQueryWhere(sql`${collectionItems.itemId}`, where?.itemIdQuery),
    notTextQueryWhere(sql`${collectionItems.itemId}`, where?.itemIdNotQuery),
    textQueryWhere(sql`${collectionItems.value}::text`, where?.valueQuery),
    notTextQueryWhere(sql`${collectionItems.value}::text`, where?.valueNotQuery),
    where?.updatedAtGte === undefined
      ? undefined
      : gte(collectionItems.updatedAt, new Date(where.updatedAtGte)),
    where?.updatedAtGt === undefined
      ? undefined
      : gt(collectionItems.updatedAt, new Date(where.updatedAtGt)),
    where?.updatedAtLte === undefined
      ? undefined
      : lte(collectionItems.updatedAt, new Date(where.updatedAtLte)),
    where?.updatedAtLt === undefined
      ? undefined
      : lt(collectionItems.updatedAt, new Date(where.updatedAtLt))
  );
}

async function countAnnotationRows(
  database: Database,
  where: ReturnType<typeof annotationBrowseWhere>
): Promise<number> {
  const [row] = await database
    .select({
      total: sql<number>`count(*)::int`
    })
    .from(annotations)
    .where(where);
  return row?.total ?? 0;
}

async function countCollectionRows(
  database: Database,
  where: ReturnType<typeof collectionBrowseWhere>
): Promise<number> {
  const [row] = await database
    .select({
      total: sql<number>`count(*)::int`
    })
    .from(collectionItems)
    .where(where);
  return row?.total ?? 0;
}

function pageResult<T>(rows: readonly T[], total: number, input: BrowseInput): PageResult<T> {
  return {
    hasMore: input.offset + rows.length < total,
    rows,
    total
  };
}

function annotationOrderBy(input: BrowseInput): SQL[] {
  if (input.sort === undefined) {
    return defaultAnnotationOrderBy();
  }
  switch (input.sort.key) {
    case 'key':
      return [order(annotations.key, input.sort.direction), ...annotationTieOrderBy()];
    case 'subject':
      return [
        order(
          sql`${annotations.subjectModel} || ':' || ${annotations.subjectId}`,
          input.sort.direction
        ),
        ...annotationTieOrderBy()
      ];
    case 'updatedAt':
      return [order(annotations.updatedAt, input.sort.direction), ...annotationTieOrderBy()];
    case 'value':
      return [
        order(sql`${annotations.value}::text`, input.sort.direction),
        ...annotationTieOrderBy()
      ];
    default:
      throw new Error(`Annotation sort is not supported: ${input.sort.key}`);
  }
}

function collectionOrderBy(input: BrowseInput): SQL[] {
  if (input.sort === undefined) {
    return defaultCollectionOrderBy();
  }
  switch (input.sort.key) {
    case 'itemId':
      return [order(collectionItems.itemId, input.sort.direction), ...collectionTieOrderBy()];
    case 'key':
      return [order(collectionItems.key, input.sort.direction), ...collectionTieOrderBy()];
    case 'subject':
      return [
        order(
          sql`${collectionItems.subjectModel} || ':' || ${collectionItems.subjectId}`,
          input.sort.direction
        ),
        ...collectionTieOrderBy()
      ];
    case 'updatedAt':
      return [order(collectionItems.updatedAt, input.sort.direction), ...collectionTieOrderBy()];
    case 'value':
      return [
        order(sql`${collectionItems.value}::text`, input.sort.direction),
        ...collectionTieOrderBy()
      ];
    default:
      throw new Error(`Collection sort is not supported: ${input.sort.key}`);
  }
}

function defaultAnnotationOrderBy(): SQL[] {
  return [desc(annotations.updatedAt), ...annotationTieOrderBy()];
}

function defaultCollectionOrderBy(): SQL[] {
  return [desc(collectionItems.updatedAt), ...collectionTieOrderBy()];
}

function annotationTieOrderBy(): SQL[] {
  return [asc(annotations.key), asc(annotations.subjectModel), asc(annotations.subjectId)];
}

function collectionTieOrderBy(): SQL[] {
  return [
    asc(collectionItems.key),
    asc(collectionItems.subjectModel),
    asc(collectionItems.subjectId),
    asc(collectionItems.itemId)
  ];
}

function order(expression: Parameters<typeof asc>[0], direction: SortInput['direction']): SQL {
  return direction === 'asc' ? asc(expression) : desc(expression);
}

function textQueryWhere(expression: SQL, query: string | undefined): SQL | undefined {
  if (query === undefined) {
    return undefined;
  }
  const patterns = wildcardPatterns(query);
  return patterns.length === 0
    ? undefined
    : and(...patterns.map((pattern) => sql`${expression} ilike ${pattern} escape '\\'`));
}

function notTextQueryWhere(expression: SQL, query: string | undefined): SQL | undefined {
  const condition = textQueryWhere(expression, query);
  return condition === undefined ? undefined : sql`not (${condition})`;
}

function wildcardPatterns(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token) => `%${token.replace(/[\\%_]/g, '\\$&').replace(/\*/g, '%')}%`);
}

function matchesBrowseWhere(item: Annotation | CollectionItem, where: BrowseWhere | undefined) {
  if (where === undefined) {
    return true;
  }
  return (
    matchesTextQuery(refLabel(item.subject), where.subjectQuery) &&
    matchesNotTextQuery(refLabel(item.subject), where.subjectNotQuery) &&
    matchesTextQuery(JSON.stringify(item.value), where.valueQuery) &&
    matchesNotTextQuery(JSON.stringify(item.value), where.valueNotQuery) &&
    matchesTextQuery('itemId' in item ? item.itemId : '', where.itemIdQuery) &&
    matchesNotTextQuery('itemId' in item ? item.itemId : '', where.itemIdNotQuery) &&
    matchesDateQuery(item.updatedAt, where)
  );
}

function refLabel(ref: ModelRef): string {
  return `${ref._model}:${ref.id}`;
}

function matchesTextQuery(text: string, query: string | undefined): boolean {
  if (query === undefined) {
    return true;
  }
  const lowered = text.toLowerCase();
  return wildcardPatterns(query).every((pattern) => wildcardMatch(lowered, pattern.toLowerCase()));
}

function matchesNotTextQuery(text: string, query: string | undefined): boolean {
  return query === undefined || !matchesTextQuery(text, query);
}

function wildcardMatch(text: string, pattern: string): boolean {
  const expression = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/(?<!\\)%/g, '.*')
    .replace(/\\([%_])/g, '$1');
  return new RegExp(`^${expression}$`, 'u').test(text);
}

function matchesDateQuery(value: string, where: BrowseWhere): boolean {
  const time = Date.parse(value);
  return (
    (where.updatedAtGte === undefined || time >= Date.parse(where.updatedAtGte)) &&
    (where.updatedAtGt === undefined || time > Date.parse(where.updatedAtGt)) &&
    (where.updatedAtLte === undefined || time <= Date.parse(where.updatedAtLte)) &&
    (where.updatedAtLt === undefined || time < Date.parse(where.updatedAtLt))
  );
}

export function createMemoryStore(): Store {
  const annotationRows = new Map<string, Annotation>();
  const itemRows = new Map<string, CollectionItem>();
  const store: Store = {
    browseAnnotations(input) {
      const rows = [...annotationRows.values()]
        .filter(
          (item) =>
            (input.key === undefined || item.key === input.key) &&
            (input.subject === undefined || sameRef(item.subject, input.subject)) &&
            (input.subjectModel === undefined || item.subject._model === input.subjectModel) &&
            matchesBrowseWhere(item, input.where)
        )
        .sort((left, right) => sortAnnotationRows(left, right, input.sort));
      return Promise.resolve(
        pageResult(rows.slice(input.offset, input.offset + input.limit), rows.length, input)
      );
    },
    browseCollection(input) {
      const rows = [...itemRows.values()]
        .filter(
          (item) =>
            (input.key === undefined || item.key === input.key) &&
            (input.subject === undefined || sameRef(item.subject, input.subject)) &&
            (input.subjectModel === undefined || item.subject._model === input.subjectModel) &&
            matchesBrowseWhere(item, input.where)
        )
        .sort((left, right) => sortCollectionRows(left, right, input.sort));
      return Promise.resolve(
        pageResult(rows.slice(input.offset, input.offset + input.limit), rows.length, input)
      );
    },
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
    overview() {
      return Promise.resolve({
        annotations: summarizeDerivedStorage('annotation', [...annotationRows.values()]),
        collectionItems: summarizeDerivedStorage('collectionItem', [...itemRows.values()])
      });
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

function sortAnnotationRows(
  left: Annotation,
  right: Annotation,
  sort: SortInput | undefined
): number {
  return (
    sortRowsBy(left, right, sort, annotationSortValue) || defaultAnnotationCompare(left, right)
  );
}

function sortCollectionRows(
  left: CollectionItem,
  right: CollectionItem,
  sort: SortInput | undefined
): number {
  return (
    sortRowsBy(left, right, sort, collectionSortValue) ||
    defaultAnnotationCompare(left, right) ||
    left.itemId.localeCompare(right.itemId)
  );
}

function defaultAnnotationCompare(left: Annotation, right: Annotation): number {
  return (
    right.updatedAt.localeCompare(left.updatedAt) ||
    left.key.localeCompare(right.key) ||
    left.subject._model.localeCompare(right.subject._model) ||
    left.subject.id.localeCompare(right.subject.id)
  );
}

function sortRowsBy<T>(
  left: T,
  right: T,
  sort: SortInput | undefined,
  value: (item: T, key: string) => number | string
): number {
  if (sort === undefined) {
    return 0;
  }
  const direction = sort.direction === 'asc' ? 1 : -1;
  return compareValues(value(left, sort.key), value(right, sort.key)) * direction;
}

function annotationSortValue(item: Annotation, key: string): number | string {
  switch (key) {
    case 'key':
      return item.key;
    case 'subject':
      return `${item.subject._model}:${item.subject.id}`;
    case 'updatedAt':
      return item.updatedAt;
    case 'value':
      return JSON.stringify(item.value);
    default:
      throw new Error(`Annotation sort is not supported: ${key}`);
  }
}

function collectionSortValue(item: CollectionItem, key: string): number | string {
  if (key === 'itemId') {
    return item.itemId;
  }
  return annotationSortValue(item, key);
}

function compareValues(left: number | string, right: number | string): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base'
  });
}

function isPlainObject(value: unknown): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
