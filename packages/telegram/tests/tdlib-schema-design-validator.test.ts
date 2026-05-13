import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';

import rawSchema from '../src/tdlib-docs/data/tdlib-schema.json' with { type: 'json' };
import rawStorageReview from '../src/tdlib-docs/data/tdlib-storage-review.json' with { type: 'json' };
import { readStorageReviewState } from '../src/tdlib-docs-server/storageReview.js';
import {
  validateSchemaDesignState as validateSchemaDesignStateStrict,
  type SchemaDesignValidationIssue
} from '../src/tdlib-docs/schemaDesignValidator.js';
import type { StorageReviewState } from '../src/tdlib-docs/storageReviewTypes.js';
import type { TdlibExplorerSchema } from '../src/tdlib-docs/types.js';

const schema = rawSchema as TdlibExplorerSchema;
const committedStorageReviewFilePath = fileURLToPath(
  new URL('../src/tdlib-docs/data/tdlib-storage-review.json', import.meta.url)
);

describe('TDLib schema design validator', () => {
  it('accepts the committed storage review through the dev-server parser', async () => {
    const parsedState = await readStorageReviewState(committedStorageReviewFilePath);
    const rawState = rawStorageReview as unknown as StorageReviewState;

    expect(parsedState.entries).toHaveLength(rawState.entries.length);
    expect(parsedState.tables).toHaveLength(rawState.tables?.length ?? 0);
    expect(Object.keys(parsedState.updateDesigns ?? {})).toHaveLength(
      Object.keys(rawState.updateDesigns ?? {}).length
    );
  });

  it('accepts the committed storage review schema design', () => {
    expect(
      validateSchemaDesignStateStrict(rawStorageReview as unknown as StorageReviewState, schema)
    ).toEqual([]);
  });

  it('rejects committed-like state without update designs for every TDLib update', () => {
    const state = rawStorageReview as unknown as StorageReviewState;
    const copiedState = structuredClone(state);
    if (copiedState.updateDesigns === undefined) {
      throw new Error('Missing update designs');
    }
    delete copiedState.updateDesigns.updateAccentColors;

    expect(issueMessages(validateSchemaDesignStateStrict(copiedState, schema))).toContain(
      'missing update design updateAccentColors'
    );
  });

  it('rejects committed-like state without a handler plan for a TDLib update', () => {
    const state = rawStorageReview as unknown as StorageReviewState;
    const copiedState = structuredClone(state);
    const updateDesign = copiedState.updateDesigns?.updateAccentColors;
    if (updateDesign === undefined) {
      throw new Error('Missing update design');
    }
    delete updateDesign.handlerPlan;

    expect(issueMessages(validateSchemaDesignStateStrict(copiedState, schema))).toContain(
      'missing handler plan for update updateAccentColors'
    );
  });

  it('rejects key-value field targets outside constructor payload', () => {
    const state = createState();
    const field = state.entries[0]?.schemaDesign?.constructors[0]?.fields[0];
    if (field === undefined) {
      throw new Error('Missing test field');
    }
    field.target = { fieldId: 'telegram_kv.value', kind: 'table-column' };

    expect(issueMessages(validateSchemaDesignState(state, schema))).toContain(
      'AccentColor is kv, so fields must stay inside constructor payload'
    );
  });

  it('rejects embedded field targets outside embedded payload', () => {
    const state = createState();
    const entry = state.entries[0];
    if (entry === undefined) {
      throw new Error('Missing test entry');
    }
    entry.storage = 'embedded';

    expect(issueMessages(validateSchemaDesignState(state, schema))).toContain(
      'embedded storage fields must stay inside embedded payload'
    );
  });

  it('rejects embedded payload targets outside embedded storage', () => {
    const state = createState();
    const field = state.entries[0]?.schemaDesign?.constructors[0]?.fields[0];
    if (field === undefined) {
      throw new Error('Missing test field');
    }
    field.target = { kind: 'embedded-payload' };

    expect(issueMessages(validateSchemaDesignState(state, schema))).toContain(
      'embedded-payload target is only valid for embedded storage'
    );
  });

  it('rejects event field targets outside event payload', () => {
    const state = createState();
    const entry = state.entries[0];
    if (entry === undefined) {
      throw new Error('Missing test entry');
    }
    entry.storage = 'event';

    expect(issueMessages(validateSchemaDesignState(state, schema))).toContain(
      'event storage fields must stay inside event payload'
    );
  });

  it('rejects event payload fields that do not match constructor event target', () => {
    const state = createState();
    const entry = state.entries[0];
    const constructor = entry?.schemaDesign?.constructors[0];
    const field = constructor?.fields[0];
    if (entry === undefined || constructor === undefined || field === undefined) {
      throw new Error('Missing test entry');
    }
    entry.storage = 'event';
    constructor.target = { event: 'accent_color', kind: 'event' };
    field.target = { event: 'wrong_event', kind: 'event-payload' };

    expect(issueMessages(validateSchemaDesignState(state, schema))).toContain(
      'AccentColor.accentColor event field must target accent_color'
    );
  });

  it('rejects event payload targets outside event storage', () => {
    const state = createState();
    const field = state.entries[0]?.schemaDesign?.constructors[0]?.fields[0];
    if (field === undefined) {
      throw new Error('Missing test field');
    }
    field.target = { event: 'test_event', kind: 'event-payload' };

    expect(issueMessages(validateSchemaDesignState(state, schema))).toContain(
      'event-payload target is only valid for event storage'
    );
  });

  it('rejects extend field targets outside owner table columns', () => {
    const state = createState();
    const entry = state.entries[0];
    if (entry === undefined) {
      throw new Error('Missing test entry');
    }
    entry.storage = 'extend';
    entry.storageTarget = 'AccentColor';

    expect(issueMessages(validateSchemaDesignState(state, schema))).toContain(
      'AccentColor is extend, so fields must target owner table columns'
    );
  });

  it('rejects facet field targets outside facet table columns', () => {
    const state = createState();
    const entry = state.entries[0];
    if (entry === undefined) {
      throw new Error('Missing test entry');
    }
    entry.storage = 'facet';

    expect(issueMessages(validateSchemaDesignState(state, schema))).toContain(
      'AccentColor is facet, so fields must target facet table columns'
    );
  });

  it('rejects dynamic key placeholders that point at non-scalar fields', () => {
    const state = createState();
    const target = state.entries[0]?.schemaDesign?.constructors[0]?.target;
    if (target?.kind !== 'kv') {
      throw new Error('Missing test target');
    }
    target.key = 'trending_sticker_sets_by_type:<updateTrendingStickerSets.sticker_type>';
    target.keySourceFields = ['Update.updateTrendingStickerSets.sticker_type'];
    target.sourceFields = ['Update.updateTrendingStickerSets.sticker_sets'];

    expect(issueMessages(validateSchemaDesignState(state, schema))).toContain(
      'dynamic key placeholder updateTrendingStickerSets.sticker_type must resolve to a scalar field'
    );
  });

  it('rejects source fields that do not exist in TDLib schema', () => {
    const state = createState();
    const target = state.entries[0]?.schemaDesign?.constructors[0]?.target;
    if (target?.kind !== 'kv') {
      throw new Error('Missing test target');
    }
    target.sourceFields = ['Update.updateAccentColors.missing_field'];

    expect(issueMessages(validateSchemaDesignState(state, schema))).toContain(
      'unknown source field Update.updateAccentColors.missing_field'
    );
  });

  it('accepts constructor-level source references', () => {
    const state = createState();
    const keyColumn = state.tables?.[0]?.columns[0];
    if (keyColumn === undefined) {
      throw new Error('Missing test key column');
    }
    keyColumn.sourceFields = ['AccentColor.accentColor'];

    expect(validateSchemaDesignState(state, schema)).toEqual([]);
  });

  it('accepts function input source references', () => {
    const state = createState();
    const keyColumn = state.tables?.[0]?.columns[0];
    if (keyColumn === undefined) {
      throw new Error('Missing test key column');
    }
    keyColumn.sourceFields = ['Function.getChatBoosts.chat_id'];

    expect(validateSchemaDesignState(state, schema)).toEqual([]);
  });

  it('rejects table-column targets missing the reverse column source field', () => {
    const state = createState();
    const field = state.entries[0]?.schemaDesign?.constructors[0]?.fields[0];
    const valueColumn = state.tables?.[0]?.columns[1];
    if (field === undefined || valueColumn === undefined) {
      throw new Error('Missing test field');
    }
    field.target = { fieldId: 'telegram_kv.value', kind: 'table-column' };
    valueColumn.sourceFields = ['Update.updateOption.value'];

    expect(issueMessages(validateSchemaDesignState(state, schema))).toContain(
      'table column telegram_kv.value must include source field AccentColor.accentColor.id'
    );
  });

  it('rejects table source fields whose owner type is not listed by the table', () => {
    const state = createState();
    const keyColumn = state.tables?.[0]?.columns[0];
    if (keyColumn === undefined) {
      throw new Error('Missing test key column');
    }
    keyColumn.sourceFields = ['AccentColor.accentColor.id'];
    const table = state.tables?.[0];
    if (table === undefined) {
      throw new Error('Missing test table');
    }
    table.sourceTypes = [];

    expect(issueMessages(validateSchemaDesignState(state, schema))).toContain(
      'source field AccentColor.accentColor.id requires AccentColor in telegram_kv.sourceTypes or indirectSourceTypes'
    );
  });

  it('rejects table columns without source fields', () => {
    const state = createState();
    const keyColumn = state.tables?.[0]?.columns[0];
    if (keyColumn === undefined) {
      throw new Error('Missing test key column');
    }
    keyColumn.sourceFields = [];
    keyColumn.notes = ['Seeded from storageTarget because no direct scalar TDLib field exists.'];

    expect(issueMessages(validateSchemaDesignState(state, schema))).toContain(
      'table columns must declare sourceFields'
    );
  });

  it('rejects table source types without storage review entries', () => {
    const state = createState();
    const table = state.tables?.[0];
    if (table === undefined) {
      throw new Error('Missing test table');
    }
    table.sourceTypes = ['Message'];

    expect(issueMessages(validateSchemaDesignState(state, schema))).toContain(
      'source type Message has no storage review entry'
    );
  });

  it('rejects primary key columns without primary-key role', () => {
    const state = createState();
    const keyColumn = state.tables?.[0]?.columns[0];
    if (keyColumn === undefined) {
      throw new Error('Missing test key column');
    }
    keyColumn.role = 'data';

    expect(issueMessages(validateSchemaDesignState(state, schema))).toContain(
      'primary key column telegram_kv.key must have primary-key role'
    );
  });

  it('rejects key-value constructor sources missing from the value column', () => {
    const state = createState();
    const target = state.entries[0]?.schemaDesign?.constructors[0]?.target;
    const valueColumn = state.tables?.[0]?.columns[1];
    if (target?.kind !== 'kv' || valueColumn === undefined) {
      throw new Error('Missing test target');
    }
    valueColumn.sourceFields = ['Update.updateOption.value'];

    expect(issueMessages(validateSchemaDesignState(state, schema))).toContain(
      'kv value column telegram_kv.value must include source field Update.updateAccentColors.colors'
    );
  });

  it('rejects key rules that do not cover every constructor', () => {
    const state = createState();
    const keyColumn = state.tables?.[0]?.columns[0];
    if (keyColumn === undefined) {
      throw new Error('Missing test key column');
    }
    keyColumn.keyRule = {
      cases: {},
      kind: 'constructor-discriminator',
      type: 'AccentColor'
    };

    expect(issueMessages(validateSchemaDesignState(state, schema))).toContain(
      'missing key rule case accentColor'
    );
  });

  it('rejects key rule placeholders that are not constructor fields', () => {
    const state = createState();
    const keyColumn = state.tables?.[0]?.columns[0];
    if (keyColumn === undefined) {
      throw new Error('Missing test key column');
    }
    keyColumn.keyRule = {
      cases: {
        accentColor: 'accent:<missing>'
      },
      kind: 'constructor-discriminator',
      type: 'AccentColor'
    };

    expect(issueMessages(validateSchemaDesignState(state, schema))).toContain(
      'unknown key rule placeholder accentColor.missing'
    );
  });

  it('rejects foreign-key columns without table foreign keys', () => {
    const state = createState();
    const valueColumn = state.tables?.[0]?.columns[1];
    if (valueColumn === undefined) {
      throw new Error('Missing test value column');
    }
    valueColumn.role = 'foreign-key';

    expect(issueMessages(validateSchemaDesignState(state, schema))).toContain(
      'foreign-key column telegram_kv.value lacks foreign key'
    );
  });

  it('rejects table-ref targets without matching table foreign keys', () => {
    const state = createState();
    const field = state.entries[0]?.schemaDesign?.constructors[0]?.fields[0];
    const valueColumn = state.tables?.[0]?.columns[1];
    if (field === undefined || valueColumn === undefined) {
      throw new Error('Missing test field');
    }
    field.target = {
      fieldId: 'telegram_kv.value',
      kind: 'table-ref',
      referencedTable: 'telegram_files'
    };
    valueColumn.role = 'foreign-key';
    state.tables?.push({
      columns: [
        {
          id: 'telegram_files.id',
          name: 'id',
          notes: [],
          nullable: false,
          pgType: 'integer',
          role: 'primary-key',
          sourceFields: ['File.file.id']
        }
      ],
      foreignKeys: [],
      indexes: [],
      indirectSourceTypes: [],
      name: 'telegram_files',
      notes: [],
      primaryKey: ['telegram_files.id'],
      sourceTypes: ['File']
    });

    expect(issueMessages(validateSchemaDesignState(state, schema))).toContain(
      'table-ref telegram_kv.value lacks foreign key to telegram_files'
    );
  });

  it('rejects file-bearing jsonb columns without canonical file reference notes', () => {
    const state = structuredClone(rawStorageReview as unknown as StorageReviewState);
    const table = state.tables?.find((candidate) => candidate.name === 'telegram_chat_photos');
    const sizesColumn = table?.columns.find((column) => column.name === 'sizes');
    if (sizesColumn === undefined) {
      throw new Error('Missing telegram_chat_photos.sizes column');
    }
    sizesColumn.notes = [];

    expect(issueMessages(validateSchemaDesignState(state, schema))).toContain(
      'jsonb column telegram_chat_photos.sizes stores file-bearing field ChatPhoto.chatPhoto.sizes and must document canonical file_id/File.id references'
    );
  });

  it('accepts update event and effect routes with matching update source fields', () => {
    const state = createState();
    state.updateDesigns = {
      updateAccentColors: {
        fields: {
          colors: {
            events: [
              {
                name: 'accent_colors_updated',
                notes: [],
                sourceFields: ['Update.updateAccentColors.colors']
              }
            ],
            effects: [
              {
                kind: 'cache-invalidation',
                name: 'accent_color_cache_refresh',
                notes: [],
                sourceFields: ['Update.updateAccentColors.colors']
              }
            ]
          }
        },
        notes: []
      }
    };

    expect(validateSchemaDesignState(state, schema)).toEqual([]);
  });

  it('rejects update routes wired to a different update field', () => {
    const state = createState();
    state.updateDesigns = {
      updateAccentColors: {
        fields: {
          colors: {
            events: [
              {
                name: 'accent_colors_updated',
                notes: [],
                sourceFields: ['Update.updateAccentColors.available_accent_color_ids']
              }
            ]
          }
        },
        notes: []
      }
    };

    expect(issueMessages(validateSchemaDesignState(state, schema))).toContain(
      'update route source field Update.updateAccentColors.available_accent_color_ids must be Update.updateAccentColors.colors'
    );
  });

  it('accepts update handler plans that cover every update field', () => {
    const state = createState();
    state.updateDesigns = {
      updateAccentColors: {
        fields: {},
        handlerPlan: {
          maturity: 1,
          notes: [],
          status: 'draft',
          summary: 'Persist accent color kv payloads.',
          steps: [
            {
              description: 'Upsert accent colors.',
              id: 'upsert-accent-colors',
              op: 'upsertTable',
              sourceFields: ['Update.updateAccentColors.colors'],
              table: 'telegram_kv'
            },
            {
              description: 'Upsert available accent color ids.',
              id: 'upsert-available-accent-color-ids',
              op: 'upsertTable',
              sourceFields: ['Update.updateAccentColors.available_accent_color_ids'],
              table: 'telegram_kv'
            }
          ]
        },
        notes: []
      }
    };

    expect(validateSchemaDesignState(state, schema)).toEqual([]);
  });

  it('rejects update handler plans that miss update fields', () => {
    const state = createState();
    state.updateDesigns = {
      updateAccentColors: {
        fields: {},
        handlerPlan: {
          maturity: 1,
          notes: [],
          status: 'draft',
          summary: 'Persist accent colors.',
          steps: [
            {
              description: 'Upsert accent colors.',
              id: 'upsert-accent-colors',
              op: 'upsertTable',
              sourceFields: ['Update.updateAccentColors.colors'],
              table: 'telegram_kv'
            }
          ]
        },
        notes: []
      }
    };

    expect(issueMessages(validateSchemaDesignState(state, schema))).toContain(
      'handler plan must cover update field Update.updateAccentColors.available_accent_color_ids'
    );
  });

  it('rejects update handler plans with unknown tables', () => {
    const state = createState();
    state.updateDesigns = {
      updateAccentColors: {
        fields: {},
        handlerPlan: {
          maturity: 1,
          notes: [],
          status: 'draft',
          summary: 'Persist accent colors.',
          steps: [
            {
              description: 'Upsert accent colors.',
              id: 'upsert-accent-colors',
              op: 'upsertTable',
              sourceFields: ['Update.updateAccentColors.colors'],
              table: 'missing_table'
            },
            {
              description: 'Upsert available accent color ids.',
              id: 'upsert-available-accent-color-ids',
              op: 'upsertTable',
              sourceFields: ['Update.updateAccentColors.available_accent_color_ids'],
              table: 'telegram_kv'
            }
          ]
        },
        notes: []
      }
    };

    expect(issueMessages(validateSchemaDesignState(state, schema))).toContain(
      'unknown handler plan table missing_table'
    );
  });
});

function issueMessages(issues: SchemaDesignValidationIssue[]): string[] {
  return issues.map((issue) => issue.message);
}

function validateSchemaDesignState(
  state: StorageReviewState,
  schema: TdlibExplorerSchema
): SchemaDesignValidationIssue[] {
  return validateSchemaDesignStateStrict(state, schema, { requireCompleteUpdateDesigns: false });
}

function createState(): StorageReviewState {
  return {
    entries: [
      {
        maturity: 2,
        reviewIssues: [],
        reviews: [],
        schemaDesign: {
          constructors: [
            {
              fields: [
                {
                  name: 'id',
                  notes: [],
                  target: { kind: 'constructor-payload' },
                  tdlibType: 'int32'
                },
                {
                  name: 'built_in_accent_color_id',
                  notes: [],
                  target: { kind: 'constructor-payload' },
                  tdlibType: 'int32'
                },
                {
                  name: 'light_theme_colors',
                  notes: [],
                  target: { kind: 'constructor-payload' },
                  tdlibType: 'vector<int32>'
                },
                {
                  name: 'dark_theme_colors',
                  notes: [],
                  target: { kind: 'constructor-payload' },
                  tdlibType: 'vector<int32>'
                },
                {
                  name: 'min_channel_chat_boost_level',
                  notes: [],
                  target: { kind: 'constructor-payload' },
                  tdlibType: 'int32'
                }
              ],
              name: 'accentColor',
              notes: [],
              target: {
                key: 'accent_colors',
                kind: 'kv',
                sourceFields: ['Update.updateAccentColors.colors'],
                table: 'telegram_kv',
                valueColumn: 'value'
              }
            }
          ],
          notes: []
        },
        storage: 'kv',
        storageTarget: 'accent_colors',
        type: 'AccentColor'
      }
    ],
    storageOptions: ['kv'],
    tables: [
      {
        columns: [
          {
            id: 'telegram_kv.key',
            name: 'key',
            notes: [],
            nullable: false,
            pgType: 'text',
            role: 'primary-key',
            sourceFields: ['Update.updateOption.name']
          },
          {
            id: 'telegram_kv.value',
            name: 'value',
            notes: [],
            nullable: false,
            pgType: 'jsonb',
            role: 'data',
            sourceFields: ['Update.updateAccentColors.colors']
          }
        ],
        foreignKeys: [],
        indexes: [],
        indirectSourceTypes: [],
        name: 'telegram_kv',
        notes: [],
        primaryKey: ['telegram_kv.key'],
        sourceTypes: ['AccentColor']
      }
    ],
    version: 2
  };
}
