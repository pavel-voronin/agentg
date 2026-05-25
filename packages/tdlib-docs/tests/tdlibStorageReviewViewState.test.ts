import { describe, expect, it } from 'vitest';

import {
  persistStorageReviewViewState,
  readStorageReviewViewState,
  storageReviewViewStateStorageKey
} from '../src/storageReviewViewState.js';

describe('TDLib storage review view state', () => {
  it('uses default filters when local storage is empty', () => {
    expect(readStorageReviewViewState(createMemoryStorage())).toEqual({
      expandedReviewKeys: [],
      filterText: '',
      maturityFilter: 'all',
      version: 1
    });
  });

  it('reads the saved text and maturity filters', () => {
    const storage = createMemoryStorage();
    storage.setItem(
      storageReviewViewStateStorageKey,
      JSON.stringify({
        expandedReviewKeys: ['Chat:0', 'MessageContent:1'],
        filterText: 'chat photo',
        maturityFilter: 2,
        version: 1
      })
    );

    expect(readStorageReviewViewState(storage)).toEqual({
      expandedReviewKeys: ['Chat:0', 'MessageContent:1'],
      filterText: 'chat photo',
      maturityFilter: 2,
      version: 1
    });
  });

  it('normalizes malformed stored filters', () => {
    const storage = createMemoryStorage();
    storage.setItem(
      storageReviewViewStateStorageKey,
      JSON.stringify({
        expandedReviewKeys: ['Chat:0', 42, 'Chat:0', 'MessageContent:1'],
        filterText: 42,
        maturityFilter: 4,
        version: 1
      })
    );

    expect(readStorageReviewViewState(storage)).toEqual({
      expandedReviewKeys: ['Chat:0', 'MessageContent:1'],
      filterText: '',
      maturityFilter: 'all',
      version: 1
    });
  });

  it('persists the current text and maturity filters', () => {
    const storage = createMemoryStorage();

    persistStorageReviewViewState(
      {
        expandedReviewKeys: ['Chat:0'],
        filterText: 'message',
        maturityFilter: 3,
        version: 1
      },
      storage
    );

    expect(JSON.parse(storage.getItem(storageReviewViewStateStorageKey) ?? '')).toEqual({
      expandedReviewKeys: ['Chat:0'],
      filterText: 'message',
      maturityFilter: 3,
      version: 1
    });
  });
});

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    get length() {
      return values.size;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    }
  };
}
