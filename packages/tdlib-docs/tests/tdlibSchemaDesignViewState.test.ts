import { describe, expect, it } from 'vitest';

import {
  persistSchemaDesignViewState,
  readSchemaDesignViewState,
  schemaDesignViewStateStorageKey
} from '../src/schemaDesignViewState.js';

describe('TDLib schema design view state', () => {
  it('uses default state when local storage is empty', () => {
    expect(readSchemaDesignViewState(createMemoryStorage())).toEqual({
      expandedReviewKeys: [],
      expandedTableNames: [],
      expandedTypeNames: [],
      expandedUpdateNames: [],
      filterText: '',
      leftPane: 'types',
      tableScrollTop: 0,
      typeScrollTop: 0,
      updateFieldLayout: 'grid',
      updateScrollTop: 0,
      version: 1
    });
  });

  it('reads the saved filters and expansion state', () => {
    const storage = createMemoryStorage();
    storage.setItem(
      schemaDesignViewStateStorageKey,
      JSON.stringify({
        expandedReviewKeys: ['Chat:0', 'MessageContent:1'],
        expandedTableNames: ['telegram_chats'],
        expandedTypeNames: ['Chat', 'MessageContent'],
        expandedUpdateNames: ['updateNewMessage'],
        filterText: 'chat',
        leftPane: 'updates',
        tableScrollTop: 456.7,
        typeScrollTop: 123.2,
        updateFieldLayout: 'stacked',
        updateScrollTop: 222.9,
        version: 1
      })
    );

    expect(readSchemaDesignViewState(storage)).toEqual({
      expandedReviewKeys: ['Chat:0', 'MessageContent:1'],
      expandedTableNames: ['telegram_chats'],
      expandedTypeNames: ['Chat', 'MessageContent'],
      expandedUpdateNames: ['updateNewMessage'],
      filterText: 'chat',
      leftPane: 'updates',
      tableScrollTop: 457,
      typeScrollTop: 123,
      updateFieldLayout: 'stacked',
      updateScrollTop: 223,
      version: 1
    });
  });

  it('normalizes malformed saved state', () => {
    const storage = createMemoryStorage();
    storage.setItem(
      schemaDesignViewStateStorageKey,
      JSON.stringify({
        expandedReviewKeys: ['Chat:0', 42, 'Chat:0'],
        expandedTableNames: ['telegram_chats', null, 'telegram_chats'],
        expandedTypeNames: ['Chat', false, 'MessageContent'],
        expandedUpdateNames: ['updateFile', false, 'updateFile'],
        filterText: 42,
        leftPane: 'procedures',
        tableScrollTop: -1,
        typeScrollTop: Number.NaN,
        updateFieldLayout: 'columns',
        updateScrollTop: 12.5,
        version: 1
      })
    );

    expect(readSchemaDesignViewState(storage)).toEqual({
      expandedReviewKeys: ['Chat:0'],
      expandedTableNames: ['telegram_chats'],
      expandedTypeNames: ['Chat', 'MessageContent'],
      expandedUpdateNames: ['updateFile'],
      filterText: '',
      leftPane: 'types',
      tableScrollTop: 0,
      typeScrollTop: 0,
      updateFieldLayout: 'grid',
      updateScrollTop: 13,
      version: 1
    });
  });

  it('persists the current schema design state', () => {
    const storage = createMemoryStorage();

    persistSchemaDesignViewState(
      {
        expandedReviewKeys: ['Chat:0'],
        expandedTableNames: ['telegram_chats'],
        expandedTypeNames: ['Chat'],
        expandedUpdateNames: ['updateNewMessage'],
        filterText: 'message',
        leftPane: 'updates',
        tableScrollTop: 50,
        typeScrollTop: 25,
        updateFieldLayout: 'stacked',
        updateScrollTop: 75,
        version: 1
      },
      storage
    );

    expect(JSON.parse(storage.getItem(schemaDesignViewStateStorageKey) ?? '')).toEqual({
      expandedReviewKeys: ['Chat:0'],
      expandedTableNames: ['telegram_chats'],
      expandedTypeNames: ['Chat'],
      expandedUpdateNames: ['updateNewMessage'],
      filterText: 'message',
      leftPane: 'updates',
      tableScrollTop: 50,
      typeScrollTop: 25,
      updateFieldLayout: 'stacked',
      updateScrollTop: 75,
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
