import { describe, expect, it } from 'vitest';

import {
  schemaCreateTableSql,
  schemaKvMappingsForTable,
  schemaProgressForEntry,
  schemaTableMatchesQuery,
  schemaUpdateProcessForUpdate
} from '../src/schemaDesignView.js';
import type {
  StorageReviewEntry,
  StorageSchemaTable,
  StorageSchemaUpdateDesign
} from '../src/storageReviewTypes.js';
import type { TdlibCallableEntity } from '../src/types.js';

describe('TDLib schema design view', () => {
  it('derives key-value table mappings from constructor targets', () => {
    const entry = createKvEntry();

    expect(schemaKvMappingsForTable([entry], 'telegram_kv')).toEqual([
      {
        key: 'accent_colors',
        keySourceFields: [],
        keySources: [],
        table: 'telegram_kv',
        valueColumn: 'value',
        valueSourceFields: [
          'Update.updateAccentColors.colors',
          'Update.updateAccentColors.available_accent_color_ids'
        ],
        valueSources: [
          {
            constructor: 'updateAccentColors',
            field: 'colors',
            raw: 'Update.updateAccentColors.colors',
            type: 'Update'
          },
          {
            constructor: 'updateAccentColors',
            field: 'available_accent_color_ids',
            raw: 'Update.updateAccentColors.available_accent_color_ids',
            type: 'Update'
          }
        ]
      }
    ]);
  });

  it('matches key-value tables by derived keys', () => {
    expect(schemaTableMatchesQuery(createKvTable(), 'accent_colors', [createKvEntry()])).toBe(true);
  });

  it('renders create table DDL from table schema', () => {
    expect(schemaCreateTableSql(createKvTable())).toBe(
      [
        'CREATE TABLE telegram_kv (',
        '  key text NOT NULL,',
        '  value jsonb NOT NULL,',
        '  PRIMARY KEY (key)',
        ');'
      ].join('\n')
    );
  });

  it('renders foreign key constraints in create table DDL', () => {
    expect(schemaCreateTableSql(createProfilePhotoTable())).toBe(
      [
        'CREATE TABLE telegram_profile_photos (',
        '  id bigint NOT NULL,',
        '  small_file_id integer NOT NULL,',
        '  PRIMARY KEY (id),',
        '  CONSTRAINT telegram_profile_photos_small_file_fk FOREIGN KEY (small_file_id) REFERENCES telegram_files (id)',
        ');'
      ].join('\n')
    );
  });

  it('deduplicates constructor variants that share one key-value source', () => {
    const entry = createKvEntry();
    const constructor = entry.schemaDesign?.constructors[0];
    if (constructor === undefined) {
      throw new Error('Missing test constructor');
    }
    entry.schemaDesign?.constructors.push({
      ...constructor,
      name: 'accentColorVariant'
    });

    expect(schemaKvMappingsForTable([entry], 'telegram_kv')).toHaveLength(1);
  });

  it('uses storage-specific progress for key-value payloads', () => {
    expect(schemaProgressForEntry(createKvEntry())).toMatchObject({
      covered: 1,
      kind: 'kv-payloads',
      ready: true,
      title: 'key-value constructor payloads 1 / 1',
      total: 1
    });
  });

  it('uses constructor progress for event payloads', () => {
    expect(schemaProgressForEntry(createEventEntry())).toMatchObject({
      covered: 1,
      kind: 'event-payloads',
      ready: false,
      title: 'event payload constructors 1 / 2',
      total: 2
    });
  });

  it('keeps field progress for table storage', () => {
    expect(schemaProgressForEntry(createTableEntry())).toMatchObject({
      covered: 1,
      kind: 'table-fields',
      ready: false,
      title: 'table fields 1 / 2',
      total: 2
    });
  });

  it('derives update process routes from tables and update designs', () => {
    const update = createUpdateNewMessage();
    const process = schemaUpdateProcessForUpdate(
      update,
      [createTableEntry(), createMessageEntry()],
      [createMessageTable()],
      createUpdateDesign()
    );

    expect(process).toMatchObject({
      dbWriteCount: 1,
      delegatedCount: 1,
      effectCount: 1,
      eventCount: 1,
      gapCount: 0,
      routedFieldCount: 3,
      totalFieldCount: 3
    });
    expect(process.fieldRoutes.map((route) => [route.field.name, route.status])).toEqual([
      ['message', 'used'],
      ['disable_notification', 'used'],
      ['contains_mention', 'used']
    ]);
    expect(
      process.fieldRoutes.map((route) => [
        route.field.name,
        route.handlerPlanSteps.map((step) => step.stepNumber)
      ])
    ).toEqual([
      ['message', [1]],
      ['disable_notification', [2]],
      ['contains_mention', [3]]
    ]);
    expect(process.fieldRoutes[0]?.delegatedTypes).toEqual(['Message']);
    expect(process.fieldRoutes[0]?.dbWrites).toMatchObject([
      {
        column: 'message_json',
        table: 'telegram_messages'
      }
    ]);
  });

  it('shows table-level handler writes when update payload is routed through a typed row', () => {
    const process = schemaUpdateProcessForUpdate(
      createUpdateUser(),
      [createUserEntry()],
      [createUserTable()],
      createUpdateUserDesign()
    );

    expect(process).toMatchObject({
      dbWriteCount: 1,
      gapCount: 0,
      routedFieldCount: 1,
      totalFieldCount: 1
    });
    expect(process.fieldRoutes[0]?.tableWrites).toMatchObject([
      {
        op: 'upsertTable',
        table: 'telegram_users'
      }
    ]);
    expect(process.fieldRoutes[0]?.dbWrites).toEqual([]);
  });
});

function createKvEntry(): StorageReviewEntry {
  return {
    maturity: 2,
    reviewIssues: [],
    reviews: [],
    schemaDesign: {
      constructors: [
        {
          fields: [],
          name: 'accentColor',
          notes: [],
          target: {
            key: 'accent_colors',
            kind: 'kv',
            sourceFields: [
              'Update.updateAccentColors.colors',
              'Update.updateAccentColors.available_accent_color_ids'
            ],
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
  };
}

function createKvTable(): StorageSchemaTable {
  return {
    columns: [
      {
        id: 'telegram_kv.key',
        name: 'key',
        notes: [],
        nullable: false,
        pgType: 'text',
        role: 'primary-key',
        sourceFields: []
      },
      {
        id: 'telegram_kv.value',
        name: 'value',
        notes: [],
        nullable: false,
        pgType: 'jsonb',
        role: 'data',
        sourceFields: [
          'Update.updateAccentColors.colors',
          'Update.updateAccentColors.available_accent_color_ids'
        ]
      }
    ],
    foreignKeys: [],
    indexes: [],
    indirectSourceTypes: [],
    name: 'telegram_kv',
    notes: [],
    primaryKey: ['telegram_kv.key'],
    sourceTypes: ['AccentColor']
  };
}

function createProfilePhotoTable(): StorageSchemaTable {
  return {
    columns: [
      {
        id: 'telegram_profile_photos.id',
        name: 'id',
        notes: [],
        nullable: false,
        pgType: 'bigint',
        role: 'primary-key',
        sourceFields: ['ProfilePhoto.profilePhoto.id']
      },
      {
        id: 'telegram_profile_photos.small_file_id',
        name: 'small_file_id',
        notes: [],
        nullable: false,
        pgType: 'integer',
        role: 'foreign-key',
        sourceFields: ['ProfilePhoto.profilePhoto.small']
      }
    ],
    foreignKeys: [
      {
        columns: ['telegram_profile_photos.small_file_id'],
        id: 'telegram_profile_photos.small_file_fk',
        notes: [],
        referencedColumns: ['telegram_files.id'],
        referencedTable: 'telegram_files',
        sourceFields: ['ProfilePhoto.profilePhoto.small']
      }
    ],
    indexes: [],
    indirectSourceTypes: ['File'],
    name: 'telegram_profile_photos',
    notes: [],
    primaryKey: ['telegram_profile_photos.id'],
    sourceTypes: ['ProfilePhoto']
  };
}

function createEventEntry(): StorageReviewEntry {
  return {
    maturity: 2,
    reviewIssues: [],
    reviews: [],
    schemaDesign: {
      constructors: [
        {
          fields: [],
          name: 'connectionStateReady',
          notes: [],
          target: {
            event: 'connection_state_ready',
            kind: 'event'
          }
        },
        {
          fields: [
            {
              name: 'progress',
              notes: [],
              target: { kind: 'pending' },
              tdlibType: 'int32'
            }
          ],
          name: 'chatActionUploadingVideo',
          notes: []
        }
      ],
      notes: []
    },
    storage: 'event',
    storageTarget: 'Chat.action',
    type: 'ChatAction'
  };
}

function createTableEntry(): StorageReviewEntry {
  return {
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
              target: { fieldId: 'telegram_chats.id', kind: 'table-column' },
              tdlibType: 'int53'
            },
            {
              name: 'title',
              notes: [],
              target: { kind: 'pending' },
              tdlibType: 'string'
            }
          ],
          name: 'chat',
          notes: []
        }
      ],
      notes: []
    },
    storage: 'table',
    storageTarget: 'id',
    type: 'Chat'
  };
}

function createMessageEntry(): StorageReviewEntry {
  return {
    maturity: 2,
    reviewIssues: [],
    reviews: [],
    schemaDesign: {
      constructors: [],
      notes: []
    },
    storage: 'table',
    storageTarget: 'id',
    type: 'Message'
  };
}

function createUpdateNewMessage(): TdlibCallableEntity {
  return {
    description: 'A new message was received',
    fields: [
      {
        description: 'New message',
        name: 'message',
        type: 'Message'
      },
      {
        description: 'Notification flag',
        name: 'disable_notification',
        type: 'Bool'
      },
      {
        description: 'Mention flag',
        name: 'contains_mention',
        type: 'Bool'
      }
    ],
    id: 'update:updateNewMessage',
    kind: 'update',
    name: 'updateNewMessage',
    resultType: 'Update'
  };
}

function createUpdateUser(): TdlibCallableEntity {
  return {
    description: 'A user was updated',
    fields: [
      {
        description: 'Updated user',
        name: 'user',
        type: 'user'
      }
    ],
    id: 'update:updateUser',
    kind: 'update',
    name: 'updateUser',
    resultType: 'Update'
  };
}

function createUserEntry(): StorageReviewEntry {
  return {
    maturity: 2,
    reviewIssues: [],
    reviews: [],
    schemaDesign: {
      constructors: [],
      notes: []
    },
    storage: 'table',
    storageTarget: 'id',
    type: 'User'
  };
}

function createMessageTable(): StorageSchemaTable {
  return {
    columns: [
      {
        id: 'telegram_messages.message_json',
        name: 'message_json',
        notes: [],
        nullable: false,
        pgType: 'jsonb',
        role: 'data',
        sourceFields: ['Update.updateNewMessage.message']
      }
    ],
    foreignKeys: [],
    indexes: [],
    indirectSourceTypes: [],
    name: 'telegram_messages',
    notes: [],
    primaryKey: [],
    sourceTypes: ['Message']
  };
}

function createUserTable(): StorageSchemaTable {
  return {
    columns: [
      {
        id: 'telegram_users.id',
        name: 'id',
        notes: [],
        nullable: false,
        pgType: 'bigint',
        role: 'primary-key',
        sourceFields: ['User.user.id']
      }
    ],
    foreignKeys: [],
    indexes: [],
    indirectSourceTypes: [],
    name: 'telegram_users',
    notes: [],
    primaryKey: ['telegram_users.id'],
    sourceTypes: ['User']
  };
}

function createUpdateDesign(): StorageSchemaUpdateDesign {
  return {
    fields: {
      contains_mention: {
        effects: [
          {
            kind: 'cache-invalidation',
            name: 'mention_badge_refresh',
            notes: [],
            sourceFields: ['Update.updateNewMessage.contains_mention']
          }
        ]
      },
      disable_notification: {
        events: [
          {
            name: 'message_notification_state_received',
            notes: [],
            sourceFields: ['Update.updateNewMessage.disable_notification']
          }
        ]
      }
    },
    handlerPlan: {
      maturity: 1,
      notes: [],
      status: 'draft',
      steps: [
        {
          description: 'Persist message payload.',
          id: 'persist-message',
          op: 'delegateType',
          sourceFields: ['Update.updateNewMessage.message'],
          type: 'Message'
        },
        {
          description: 'Publish notification flag.',
          event: 'message_notification_state_received',
          id: 'publish-notification-flag',
          op: 'publishEvent',
          sourceFields: ['Update.updateNewMessage.disable_notification']
        },
        {
          description: 'Refresh mention badge.',
          effect: 'mention_badge_refresh',
          effectKind: 'cache-invalidation',
          id: 'refresh-mention-badge',
          op: 'runEffect',
          sourceFields: ['Update.updateNewMessage.contains_mention']
        }
      ],
      summary: 'Handle updateNewMessage.'
    },
    notes: []
  };
}

function createUpdateUserDesign(): StorageSchemaUpdateDesign {
  return {
    fields: {},
    handlerPlan: {
      maturity: 1,
      notes: [],
      status: 'draft',
      steps: [
        {
          description: 'Upsert user row.',
          id: 'upsert-user',
          op: 'upsertTable',
          sourceFields: ['Update.updateUser.user'],
          table: 'telegram_users'
        }
      ],
      summary: 'Handle updateUser.'
    },
    notes: []
  };
}
