import type { JsonValue } from '@agentg/framework';

import type { Overview } from '../src/overview.js';
import type { Dataset, ModelRef } from '../src/schema.js';

export const METHODS = {
  browseAnnotations: 'data.dashboard.browseAnnotations',
  browseCollection: 'data.dashboard.browseCollection',
  overview: 'data.dashboard.overview',
  selectPage: 'data.dashboard.selectPage'
} as const;

export type PageResult<T> = Readonly<{
  hasMore: boolean;
  rows: readonly T[];
  total?: number | undefined;
}>;

export type AnnotationRecord = Readonly<{
  createdAt: string;
  key: string;
  lineage: readonly ModelRef[];
  subject: ModelRef;
  updatedAt: string;
  value: JsonValue;
}>;

export type CollectionRecord = AnnotationRecord &
  Readonly<{
    itemId: string;
  }>;

export type AnnotationPage = PageResult<AnnotationRecord>;
export type CollectionPage = PageResult<CollectionRecord>;
export type DatasetPage = PageResult<Dataset['rows'][number]>;

export type { Dataset, ModelRef, Overview };
