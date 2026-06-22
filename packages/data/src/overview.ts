import type { ModelCatalogEntry } from './catalog.js';
import { annotationId, collectionItemId } from './ids.js';
import type { ModelRef } from './schema.js';

export type Overview = Readonly<{
  catalog: readonly ModelCatalogEntry[];
  derivedStorage: Readonly<{
    annotations: DerivedStorageOverview;
    collectionItems: DerivedStorageOverview;
  }>;
}>;

export type DerivedStorageOverview = Readonly<{
  byKey: readonly DerivedStorageKeyOverview[];
  bySubjectModel: readonly DerivedStorageSubjectModelOverview[];
  recent: readonly DerivedStorageRef[];
  totalItems: number;
}>;

export type DerivedStorageKeyOverview = Readonly<{
  count: number;
  key: string;
  latestUpdatedAt: string | null;
  subjectCount: number;
}>;

export type DerivedStorageSubjectModelOverview = Readonly<{
  count: number;
  subjectCount: number;
  subjectModel: string;
}>;

export type DerivedStorageRef = Readonly<{
  itemId?: string;
  key: string;
  ref: ModelRef;
  subject: ModelRef;
  updatedAt: string;
}>;

export type DerivedStorageRecord = Readonly<{
  itemId?: string;
  key: string;
  subject: ModelRef;
  updatedAt: string;
}>;

export function summarizeDerivedStorage(
  kind: 'annotation' | 'collectionItem',
  rows: readonly DerivedStorageRecord[]
): DerivedStorageOverview {
  const bySubjectModel = new Map<string, { count: number; subjects: Set<string> }>();
  const byKey = new Map<
    string,
    { count: number; latestUpdatedAt: string | null; subjects: Set<string> }
  >();

  for (const row of rows) {
    const subjectKey = modelRefKey(row.subject);
    const subjectBucket = bySubjectModel.get(row.subject._model) ?? {
      count: 0,
      subjects: new Set<string>()
    };
    subjectBucket.count += 1;
    subjectBucket.subjects.add(subjectKey);
    bySubjectModel.set(row.subject._model, subjectBucket);

    const keyBucket = byKey.get(row.key) ?? {
      count: 0,
      latestUpdatedAt: null,
      subjects: new Set<string>()
    };
    keyBucket.count += 1;
    keyBucket.subjects.add(subjectKey);
    keyBucket.latestUpdatedAt =
      keyBucket.latestUpdatedAt === null || row.updatedAt > keyBucket.latestUpdatedAt
        ? row.updatedAt
        : keyBucket.latestUpdatedAt;
    byKey.set(row.key, keyBucket);
  }

  return {
    byKey: [...byKey.entries()]
      .map(([key, value]) => ({
        count: value.count,
        key,
        latestUpdatedAt: value.latestUpdatedAt,
        subjectCount: value.subjects.size
      }))
      .sort(sortCountThenKey),
    bySubjectModel: [...bySubjectModel.entries()]
      .map(([subjectModel, value]) => ({
        count: value.count,
        subjectCount: value.subjects.size,
        subjectModel
      }))
      .sort(sortCountThenSubjectModel),
    recent: [...rows]
      .sort(sortRecent)
      .slice(0, 20)
      .map((row) => storageRef(kind, row)),
    totalItems: rows.length
  };
}

function storageRef(
  kind: 'annotation' | 'collectionItem',
  row: DerivedStorageRecord
): DerivedStorageRef {
  const ref =
    kind === 'annotation'
      ? {
          _model: 'data.annotation',
          id: annotationId({
            key: row.key,
            subjectId: row.subject.id,
            subjectModel: row.subject._model
          })
        }
      : {
          _model: 'data.collectionItem',
          id: collectionItemId({
            itemId: requireItemId(row),
            key: row.key,
            subjectId: row.subject.id,
            subjectModel: row.subject._model
          })
        };

  return row.itemId === undefined
    ? {
        key: row.key,
        ref,
        subject: row.subject,
        updatedAt: row.updatedAt
      }
    : {
        itemId: row.itemId,
        key: row.key,
        ref,
        subject: row.subject,
        updatedAt: row.updatedAt
      };
}

function requireItemId(row: DerivedStorageRecord): string {
  if (row.itemId === undefined) {
    throw new Error('Collection item overview row is missing itemId');
  }
  return row.itemId;
}

function modelRefKey(ref: ModelRef): string {
  return `${ref._model}\u0000${ref.id}`;
}

function sortCountThenKey(
  left: DerivedStorageKeyOverview,
  right: DerivedStorageKeyOverview
): number {
  return right.count - left.count || left.key.localeCompare(right.key);
}

function sortCountThenSubjectModel(
  left: DerivedStorageSubjectModelOverview,
  right: DerivedStorageSubjectModelOverview
): number {
  return right.count - left.count || left.subjectModel.localeCompare(right.subjectModel);
}

function sortRecent(left: DerivedStorageRecord, right: DerivedStorageRecord): number {
  return (
    right.updatedAt.localeCompare(left.updatedAt) ||
    left.key.localeCompare(right.key) ||
    left.subject._model.localeCompare(right.subject._model) ||
    left.subject.id.localeCompare(right.subject.id) ||
    (left.itemId ?? '').localeCompare(right.itemId ?? '')
  );
}
