import { afterEach, describe, expect, it, vi } from 'vitest';

const layoutStorageKey = 'tdlib-docs:layout:v1';

describe('TDLib explorer state persistence', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('restores stable page-level inline cards', async () => {
    const storage = createMemoryStorage();
    storage.setItem(
      layoutStorageKey,
      JSON.stringify({
        activeColumnId: 'column-1',
        columnScrollTops: [],
        columns: [{ columnId: 'column-1' }],
        favoriteEntityIds: [],
        inlineCards: [
          [
            'schema-table-column:telegram_chat_join_requests:chat_id::schema-table-column-source:chat_id',
            [
              {
                entityId: 'update:updateNewChatJoinRequest',
                focusField: 'chat_id',
                instanceId: 'card-4'
              }
            ]
          ],
          [
            'card-4::field:request',
            [
              {
                entityId: 'constructor:chatJoinRequest',
                instanceId: 'card-5'
              }
            ]
          ],
          [
            'orphan-parent::slot',
            [
              {
                entityId: 'update:updateNewChatJoinRequest',
                instanceId: 'card-6'
              }
            ]
          ]
        ],
        searchQuery: '',
        version: 1,
        workspaceScrollLeft: 0
      })
    );
    vi.stubGlobal('window', {
      localStorage: storage
    });

    const { cardsForSlot } = await import('../src/tdlib-docs/explorerState.js');

    expect(
      cardsForSlot(
        'schema-table-column:telegram_chat_join_requests:chat_id',
        'schema-table-column-source:chat_id'
      )
    ).toEqual([
      {
        entityId: 'update:updateNewChatJoinRequest',
        focusField: 'chat_id',
        instanceId: 'card-4'
      }
    ]);
    expect(cardsForSlot('card-4', 'field:request')).toEqual([
      {
        entityId: 'constructor:chatJoinRequest',
        instanceId: 'card-5'
      }
    ]);
    expect(cardsForSlot('orphan-parent', 'slot')).toEqual([]);
  });
});

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    get length() {
      return values.size;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    }
  };
}
