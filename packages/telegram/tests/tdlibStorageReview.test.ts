import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createStorageReviewStore,
  readStorageReviewState
} from '../src/tdlib-docs-server/storageReview.js';
import type { StorageReviewState } from '../src/tdlib-docs/storageReviewTypes.js';

describe('TDLib storage review store', () => {
  it('reads the storage review state from JSON', async () => {
    await withStorageReviewFile(async (filePath, initialState) => {
      await expect(readStorageReviewState(filePath)).resolves.toEqual(initialState);
    });
  });

  it('updates one entry and persists the result', async () => {
    await withStorageReviewFile(async (filePath) => {
      const store = createStorageReviewStore(filePath);

      const updatedState = await store.updateEntry('Chat', {
        storage: 'embedded',
        storageTarget: 'Message.chat'
      });
      const persistedFile = JSON.parse(await readFile(filePath, 'utf8')) as {
        entries: { reviewIssues?: string[] }[];
      };
      const persistedState = await readStorageReviewState(filePath);

      expect(updatedState.entries[0]).toEqual({
        maturity: 1,
        reviewIssues: [],
        reviews: [],
        storage: 'embedded',
        storageTarget: 'Message.chat',
        type: 'Chat'
      });
      expect(persistedFile.entries[0]?.reviewIssues).toBeUndefined();
      expect(persistedState).toEqual(updatedState);
    });
  });

  it('rejects storage values outside the configured dropdown', async () => {
    await withStorageReviewFile(async (filePath, initialState) => {
      const store = createStorageReviewStore(filePath);

      await expect(store.updateEntry('Chat', { storage: 'kv' })).rejects.toThrow(
        'Unknown storage kind: kv'
      );
      await expect(readStorageReviewState(filePath)).resolves.toEqual(initialState);
    });
  });

  it('rejects unknown persisted entry fields', async () => {
    await withStorageReviewFile(async (filePath) => {
      const rawState = JSON.parse(await readFile(filePath, 'utf8')) as {
        entries: Record<string, unknown>[];
      };
      const firstEntry = rawState.entries[0];
      if (firstEntry === undefined) {
        throw new Error('Missing first test entry');
      }
      firstEntry.extraField = false;
      await writeFile(filePath, `${JSON.stringify(rawState, null, 2)}\n`, 'utf8');

      await expect(readStorageReviewState(filePath)).rejects.toThrow(
        'entries[0].extraField is not allowed'
      );
    });
  });

  it('allows storage and target to be cleared', async () => {
    await withStorageReviewFile(async (filePath) => {
      const store = createStorageReviewStore(filePath);

      const updatedState = await store.updateEntry('Chat', {
        storage: '',
        storageTarget: ''
      });

      expect(updatedState.entries[0]).toEqual({
        maturity: 1,
        reviewIssues: [],
        reviews: [],
        storage: '',
        storageTarget: '',
        type: 'Chat'
      });
      await expect(readStorageReviewState(filePath)).resolves.toEqual(updatedState);
    });
  });

  it('keeps a malformed review object when updating editable fields', async () => {
    await withStorageReviewFile(async (filePath) => {
      const rawState = JSON.parse(await readFile(filePath, 'utf8')) as {
        entries: Record<string, unknown>[];
      };
      const firstEntry = rawState.entries[0];
      if (firstEntry === undefined) {
        throw new Error('Missing first test entry');
      }
      firstEntry.reviews = ['not an object'];
      await writeFile(filePath, `${JSON.stringify(rawState, null, 2)}\n`, 'utf8');

      const store = createStorageReviewStore(filePath);
      const updatedState = await store.updateEntry('Chat', { storageTarget: 'Chat.review' });
      const persistedFile = JSON.parse(await readFile(filePath, 'utf8')) as {
        entries: { reviewIssues?: string[]; reviews?: unknown[] }[];
      };

      expect(updatedState.entries[0]?.reviews[0]).toBe('not an object');
      expect(updatedState.entries[0]?.reviewIssues).toEqual([
        { index: 0, issues: ['review must be an object'] }
      ]);
      expect(persistedFile.entries[0]?.reviews?.[0]).toBe('not an object');
      expect(persistedFile.entries[0]?.reviewIssues).toBeUndefined();
    });
  });

  it('updates maturity and persists it to JSON', async () => {
    await withStorageReviewFile(async (filePath) => {
      const store = createStorageReviewStore(filePath);

      const updatedState = await store.updateEntry('Chat', { maturity: 2 });
      const persistedFile = JSON.parse(await readFile(filePath, 'utf8')) as {
        entries: { maturity?: number; reviewIssues?: string[] }[];
      };

      expect(updatedState.entries[0]?.maturity).toBe(2);
      expect(persistedFile.entries[0]?.maturity).toBe(2);
      expect(persistedFile.entries[0]?.reviewIssues).toBeUndefined();
    });
  });

  it('updates review notes', async () => {
    await withStorageReviewFile(async (filePath) => {
      const store = createStorageReviewStore(filePath);
      const review = {
        ...createTestReview('done'),
        notes: ['check owner fields', 'owner fields checked']
      };

      const updatedState = await store.updateEntry('Chat', { reviews: [review] });
      const persistedFile = JSON.parse(await readFile(filePath, 'utf8')) as {
        entries: { reviews?: unknown[] }[];
      };

      expect(updatedState.entries[0]?.reviews).toEqual([review]);
      expect(persistedFile.entries[0]?.reviews).toEqual([review]);
    });
  });

  it('preserves schema design data while updating storage fields', async () => {
    await withStorageReviewFile(async (filePath) => {
      const rawState = JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>;
      const entries = rawState.entries;
      if (!Array.isArray(entries) || entries[0] === undefined || typeof entries[0] !== 'object') {
        throw new Error('Missing first test entry');
      }
      const schemaDesign = createTestSchemaDesign();
      const tables = [createTestTable()];
      rawState.version = 2;
      rawState.tables = tables;
      (entries[0] as Record<string, unknown>).schemaDesign = schemaDesign;
      await writeFile(filePath, `${JSON.stringify(rawState, null, 2)}\n`, 'utf8');

      const store = createStorageReviewStore(filePath);
      const updatedState = await store.updateEntry('Chat', { storageTarget: 'telegram_chats.id' });

      expect(updatedState.version).toBe(2);
      expect(updatedState.tables).toEqual(tables);
      expect(updatedState.entries[0]?.schemaDesign).toEqual(schemaDesign);
      expect(updatedState.entries[0]?.storageTarget).toBe('telegram_chats.id');
      await expect(readStorageReviewState(filePath)).resolves.toEqual(updatedState);
    });
  });

  it('reads schema design constructor targets and constructor payload field targets', async () => {
    await withStorageReviewFile(async (filePath) => {
      const rawState = JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>;
      const entries = rawState.entries;
      if (!Array.isArray(entries) || entries[0] === undefined || typeof entries[0] !== 'object') {
        throw new Error('Missing first test entry');
      }
      const schemaDesign = createTestSchemaDesign();
      const constructor = firstRecord(schemaDesign.constructors, 'schemaDesign.constructors[0]');
      constructor.target = {
        kind: 'kv',
        key: 'chat_state',
        table: 'telegram_kv',
        valueColumn: 'value'
      };
      const field = firstRecord(constructor.fields, 'constructor.fields[0]');
      field.target = { kind: 'constructor-payload' };
      rawState.version = 2;
      rawState.tables = [createTestTable()];
      (entries[0] as Record<string, unknown>).schemaDesign = schemaDesign;
      await writeFile(filePath, `${JSON.stringify(rawState, null, 2)}\n`, 'utf8');

      const state = await readStorageReviewState(filePath);

      expect(state.entries[0]?.schemaDesign).toEqual(schemaDesign);
    });
  });

  it('reads event constructor targets', async () => {
    await withStorageReviewFile(async (filePath) => {
      const rawState = JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>;
      const entries = rawState.entries;
      if (!Array.isArray(entries) || entries[0] === undefined || typeof entries[0] !== 'object') {
        throw new Error('Missing first test entry');
      }
      const schemaDesign = createTestSchemaDesign();
      const constructor = firstRecord(schemaDesign.constructors, 'schemaDesign.constructors[0]');
      constructor.target = {
        event: 'chat_action_typing',
        kind: 'event'
      };
      rawState.version = 2;
      rawState.tables = [createTestTable()];
      (entries[0] as Record<string, unknown>).schemaDesign = schemaDesign;
      await writeFile(filePath, `${JSON.stringify(rawState, null, 2)}\n`, 'utf8');

      const state = await readStorageReviewState(filePath);

      expect(state.entries[0]?.schemaDesign).toEqual(schemaDesign);
    });
  });

  it('reads embedded payload field targets', async () => {
    await withStorageReviewFile(async (filePath) => {
      const rawState = JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>;
      const entries = rawState.entries;
      if (!Array.isArray(entries) || entries[0] === undefined || typeof entries[0] !== 'object') {
        throw new Error('Missing first test entry');
      }
      const schemaDesign = createTestSchemaDesign();
      const constructor = firstRecord(schemaDesign.constructors, 'schemaDesign.constructors[0]');
      const field = firstRecord(constructor.fields, 'constructor.fields[0]');
      field.target = { kind: 'embedded-payload' };
      rawState.version = 2;
      rawState.tables = [createTestTable()];
      (entries[0] as Record<string, unknown>).schemaDesign = schemaDesign;
      await writeFile(filePath, `${JSON.stringify(rawState, null, 2)}\n`, 'utf8');

      const state = await readStorageReviewState(filePath);

      expect(state.entries[0]?.schemaDesign).toEqual(schemaDesign);
    });
  });

  it('reads table column key rules', async () => {
    await withStorageReviewFile(async (filePath) => {
      const rawState = JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>;
      const table = createTestTable();
      const column = (table.columns as Record<string, unknown>[] | undefined)?.[0];
      if (column === undefined) {
        throw new Error('Missing test column');
      }
      column.keyRule = {
        cases: {
          chat: 'chat:<id>'
        },
        kind: 'constructor-discriminator',
        type: 'Chat'
      };
      rawState.version = 2;
      rawState.tables = [table];
      await writeFile(filePath, `${JSON.stringify(rawState, null, 2)}\n`, 'utf8');

      const state = await readStorageReviewState(filePath);

      expect(state.tables?.[0]?.columns[0]?.keyRule).toEqual(column.keyRule);
    });
  });

  it('updates table column layout and persists it to JSON', async () => {
    await withStorageReviewFile(async (filePath) => {
      const rawState = JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>;
      const tables = [createTestTable()];
      rawState.version = 2;
      rawState.tables = tables;
      await writeFile(filePath, `${JSON.stringify(rawState, null, 2)}\n`, 'utf8');

      const store = createStorageReviewStore(filePath);
      const updatedState = await store.updateTable('telegram_chats', { columnLayout: 'ddl' });
      const persistedFile = JSON.parse(await readFile(filePath, 'utf8')) as {
        tables?: { columnLayout?: string }[];
      };

      expect(updatedState.tables?.[0]?.columnLayout).toBe('ddl');
      expect(persistedFile.tables?.[0]?.columnLayout).toBe('ddl');
      await expect(readStorageReviewState(filePath)).resolves.toEqual(updatedState);
    });
  });

  it('rejects maturity values outside the configured levels', async () => {
    await withStorageReviewFile(async (filePath, initialState) => {
      const store = createStorageReviewStore(filePath);

      await expect(store.updateEntry('Chat', { maturity: 4 as 1 })).rejects.toThrow(
        'maturity must be 1, 2, or 3'
      );
      await expect(readStorageReviewState(filePath)).resolves.toEqual(initialState);
    });
  });

  it('reports malformed review notes', async () => {
    await withStorageReviewFile(async (filePath) => {
      const rawState = JSON.parse(await readFile(filePath, 'utf8')) as {
        entries: Record<string, unknown>[];
      };
      const firstEntry = rawState.entries[0];
      if (firstEntry === undefined) {
        throw new Error('Missing first test entry');
      }
      firstEntry.reviews = [
        {
          ...createTestReview('done'),
          notes: ['check owner fields', 42]
        }
      ];
      await writeFile(filePath, `${JSON.stringify(rawState, null, 2)}\n`, 'utf8');

      const state = await readStorageReviewState(filePath);

      expect(state.entries[0]?.reviewIssues[0]?.issues).toEqual(
        expect.arrayContaining(['review.notes[1] must be a non-empty string'])
      );
    });
  });

  it('validates review status independently from entry maturity', async () => {
    await withStorageReviewFile(async (filePath) => {
      const rawState = JSON.parse(await readFile(filePath, 'utf8')) as {
        entries: Record<string, unknown>[];
      };
      const doneEntry = rawState.entries[0];
      const blockedEntry = rawState.entries[1];
      if (doneEntry === undefined || blockedEntry === undefined) {
        throw new Error('Missing test entries');
      }

      doneEntry.reviews = [createTestReview('done')];
      blockedEntry.reviews = [
        {
          ...createTestReview('blocked'),
          rejectedStorage: { table: 'not a table in the test fixture' },
          openQuestions: ['choose storage target']
        }
      ];
      await writeFile(filePath, `${JSON.stringify(rawState, null, 2)}\n`, 'utf8');

      const state = await readStorageReviewState(filePath);

      expect(state.entries[0]?.reviewIssues).toEqual([]);
      expect(state.entries[1]?.reviewIssues).toEqual([]);
    });
  });

  it('reports a malformed review maturity', async () => {
    await withStorageReviewFile(async (filePath) => {
      const rawState = JSON.parse(await readFile(filePath, 'utf8')) as {
        entries: Record<string, unknown>[];
      };
      const firstEntry = rawState.entries[0];
      if (firstEntry === undefined) {
        throw new Error('Missing first test entry');
      }
      firstEntry.reviews = [
        {
          ...createTestReview('done'),
          maturity: 4
        }
      ];
      await writeFile(filePath, `${JSON.stringify(rawState, null, 2)}\n`, 'utf8');

      const state = await readStorageReviewState(filePath);

      expect(state.entries[0]?.reviewIssues[0]?.issues).toContain(
        'review.maturity must be 1, 2, or 3'
      );
    });
  });

  it('reports duplicate storage decision reviews for one maturity', async () => {
    await withStorageReviewFile(async (filePath) => {
      const rawState = JSON.parse(await readFile(filePath, 'utf8')) as {
        entries: Record<string, unknown>[];
      };
      const firstEntry = rawState.entries[0];
      if (firstEntry === undefined) {
        throw new Error('Missing first test entry');
      }
      firstEntry.reviews = [createTestReview('done'), createTestReview('done')];
      await writeFile(filePath, `${JSON.stringify(rawState, null, 2)}\n`, 'utf8');

      const state = await readStorageReviewState(filePath);

      expect(state.entries[0]?.reviewIssues[0]?.issues).toContain(
        'reviews[1] duplicates storage-decision maturity 1'
      );
    });
  });
});

function createTestReview(status: 'blocked' | 'done'): Record<string, unknown> {
  return {
    constructors: [{ fields: ['id:int64'], name: 'chat' }],
    decision: 'test decision',
    maturity: 1,
    notes: [],
    openQuestions: [],
    rejectedStorage: { embedded: 'not embedded in the test fixture' },
    schema: 'storage-decision',
    status,
    uses: {
      directTypeUse: ['Chat.id'],
      directUpdateUse: [],
      indirectTypeUse: [],
      indirectUpdateUse: [],
      procedureUse: []
    }
  };
}

function createTestSchemaDesign(): Record<string, unknown> {
  return {
    constructors: [
      {
        fields: [
          {
            name: 'id',
            notes: [],
            target: { fieldId: 'telegram_chats.id', kind: 'table-column' },
            tdlibType: 'int53'
          }
        ],
        name: 'chat',
        notes: []
      }
    ],
    notes: []
  };
}

function createTestTable(): Record<string, unknown> {
  return {
    columns: [
      {
        id: 'telegram_chats.id',
        name: 'id',
        notes: [],
        nullable: false,
        pgType: 'bigint',
        role: 'primary-key',
        sourceFields: ['Chat.chat.id']
      }
    ],
    foreignKeys: [],
    indexes: [],
    indirectSourceTypes: [],
    name: 'telegram_chats',
    notes: [],
    primaryKey: ['telegram_chats.id'],
    sourceTypes: ['Chat']
  };
}

function firstRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!Array.isArray(value) || value[0] === undefined || !isRecord(value[0])) {
    throw new Error(`Missing ${fieldName}`);
  }

  return value[0];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function withStorageReviewFile(
  callback: (filePath: string, initialState: StorageReviewState) => Promise<void>
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'tdlib-storage-review-'));
  const filePath = join(directory, 'storage-review.json');
  const initialState: StorageReviewState = {
    entries: [
      {
        maturity: 1,
        reviewIssues: [],
        reviews: [],
        storage: 'table',
        storageTarget: '',
        type: 'Chat'
      },
      {
        maturity: 1,
        reviewIssues: [],
        reviews: [],
        storage: 'embedded',
        storageTarget: 'Message.content',
        type: 'MessageContent'
      }
    ],
    storageOptions: ['table', 'embedded'],
    version: 1
  };

  try {
    await writeFile(
      filePath,
      `${JSON.stringify(
        {
          ...initialState,
          entries: initialState.entries.map((entry) => ({
            maturity: entry.maturity,
            storage: entry.storage,
            storageTarget: entry.storageTarget,
            type: entry.type
          }))
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    await callback(filePath, initialState);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}
