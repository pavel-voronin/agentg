import type { StorageReviewMaturity } from './storageReviewTypes.js';

export const storageReviewViewStateStorageKey = 'tdlib-docs:storage-review:v1';

export type StorageReviewMaturityFilter = 'all' | StorageReviewMaturity;

export type StorageReviewViewState = {
  expandedReviewKeys: string[];
  filterText: string;
  maturityFilter: StorageReviewMaturityFilter;
  version: 1;
};

export type StorageReviewViewStateStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function createDefaultStorageReviewViewState(): StorageReviewViewState {
  return {
    expandedReviewKeys: [],
    filterText: '',
    maturityFilter: 'all',
    version: 1
  };
}

export function readStorageReviewViewState(
  storage: StorageReviewViewStateStorage | null = browserStorage()
): StorageReviewViewState {
  if (storage === null) {
    return createDefaultStorageReviewViewState();
  }

  try {
    const rawValue = storage.getItem(storageReviewViewStateStorageKey);
    if (rawValue === null) {
      return createDefaultStorageReviewViewState();
    }

    return normalizeStorageReviewViewState(JSON.parse(rawValue));
  } catch {
    return createDefaultStorageReviewViewState();
  }
}

export function persistStorageReviewViewState(
  state: StorageReviewViewState,
  storage: StorageReviewViewStateStorage | null = browserStorage()
): void {
  if (storage === null) {
    return;
  }

  try {
    storage.setItem(storageReviewViewStateStorageKey, JSON.stringify(state));
  } catch {
    // Browser storage can be unavailable in private or restricted file contexts.
  }
}

function normalizeStorageReviewViewState(value: unknown): StorageReviewViewState {
  if (!isRecord(value) || value.version !== 1) {
    return createDefaultStorageReviewViewState();
  }

  return {
    expandedReviewKeys: normalizeExpandedReviewKeys(value.expandedReviewKeys),
    filterText: typeof value.filterText === 'string' ? value.filterText : '',
    maturityFilter: normalizeMaturityFilter(value.maturityFilter),
    version: 1
  };
}

function normalizeMaturityFilter(value: unknown): StorageReviewMaturityFilter {
  return value === 'all' || value === 1 || value === 2 || value === 3 ? value : 'all';
}

function normalizeExpandedReviewKeys(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((item): item is string => typeof item === 'string'))];
}

function browserStorage(): StorageReviewViewStateStorage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
