import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Plugin, ViteDevServer } from 'vite';

import type {
  StorageSchemaColumnLayout,
  StorageSchemaUpdateDesign,
  StorageSchemaUpdateEffectKind,
  StorageSchemaUpdateHandlerPlan,
  StorageSchemaUpdateHandlerPlanStatus,
  StorageSchemaUpdateHandlerPlanStep,
  StorageSchemaUpdateHandlerPlanStepOp,
  StorageSchemaFieldTarget,
  StorageSchemaTable,
  StorageReviewEntry,
  StorageReviewEntryPatch,
  StorageReviewState,
  StorageSchemaTablePatch
} from '../storageReviewTypes.js';

const storageReviewApiPath = '/api/tdlib-storage-review';
const storageReviewEntryApiPath = `${storageReviewApiPath}/entries/`;
const storageReviewTableApiPath = `${storageReviewApiPath}/tables/`;
const storageReviewUpdateEvent = 'tdlib-storage-review:update';
const storageDecisionReviewSchema = 'storage-decision';
const schemaColumnLayouts = new Set<StorageSchemaColumnLayout>(['ddl', 'grid', 'stacked']);
const schemaUpdateEffectKinds = new Set<StorageSchemaUpdateEffectKind>([
  'cache-invalidation',
  'file-download',
  'file-system',
  'other'
]);
const schemaUpdateHandlerPlanStatuses = new Set<StorageSchemaUpdateHandlerPlanStatus>([
  'draft',
  'ready'
]);
const schemaUpdateHandlerPlanStepOps = new Set<StorageSchemaUpdateHandlerPlanStepOp>([
  'delegateType',
  'deleteRows',
  'ignoreField',
  'publishEvent',
  'replaceRows',
  'replaceTable',
  'returnWhen',
  'runEffect',
  'upsertTable'
]);
const reviewUseFields = [
  'directUpdateUse',
  'indirectUpdateUse',
  'directTypeUse',
  'indirectTypeUse',
  'procedureUse'
];

export function tdlibStorageReviewPlugin(storageFilePath: string): Plugin {
  const resolvedStorageFilePath = resolve(storageFilePath);
  const store = createStorageReviewStore(resolvedStorageFilePath);

  return {
    apply: 'serve',
    configureServer(server) {
      server.watcher.add(resolvedStorageFilePath);
      server.watcher.on('change', (changedPath) => {
        if (resolve(changedPath) !== resolvedStorageFilePath) {
          return;
        }

        void store.read().then((state) => broadcastStorageReviewState(server, state));
      });

      server.middlewares.use((request, response, next) => {
        void handleStorageReviewRequest(request, response, store, server).catch(
          (error: unknown) => {
            writeJson(response, 500, {
              error: error instanceof Error ? error.message : 'Storage review request failed'
            });
          }
        );
        if (isStorageReviewRequest(request)) {
          return;
        }
        next();
      });
    },
    name: 'tdlib-storage-review'
  };
}

export function createStorageReviewStore(filePath: string): {
  read: () => Promise<StorageReviewState>;
  updateEntry: (typeName: string, patch: StorageReviewEntryPatch) => Promise<StorageReviewState>;
  updateTable: (tableName: string, patch: StorageSchemaTablePatch) => Promise<StorageReviewState>;
} {
  let writeQueue = Promise.resolve();

  return {
    read: () => readStorageReviewState(filePath),
    updateEntry(typeName, patch) {
      const update = writeQueue.then(() => updateStorageReviewEntryFile(filePath, typeName, patch));
      writeQueue = update.then(
        () => undefined,
        () => undefined
      );
      return update;
    },
    updateTable(tableName, patch) {
      const update = writeQueue.then(() =>
        updateStorageSchemaTableFile(filePath, tableName, patch)
      );
      writeQueue = update.then(
        () => undefined,
        () => undefined
      );
      return update;
    }
  };
}

export async function readStorageReviewState(filePath: string): Promise<StorageReviewState> {
  return parseStorageReviewState(JSON.parse(await readFile(filePath, 'utf8')));
}

async function handleStorageReviewRequest(
  request: IncomingMessage,
  response: ServerResponse,
  store: ReturnType<typeof createStorageReviewStore>,
  server: ViteDevServer
): Promise<void> {
  if (!isStorageReviewRequest(request)) {
    return;
  }

  const url = new URL(request.url ?? '/', 'http://tdlib-docs.local');
  if (request.method === 'GET' && url.pathname === storageReviewApiPath) {
    writeJson(response, 200, await store.read());
    return;
  }

  if (request.method === 'PUT' && url.pathname.startsWith(storageReviewEntryApiPath)) {
    const typeName = decodeURIComponent(url.pathname.slice(storageReviewEntryApiPath.length));
    const state = await store.updateEntry(
      typeName,
      parseStorageReviewEntryPatch(await readBody(request))
    );
    broadcastStorageReviewState(server, state);
    writeJson(response, 200, state);
    return;
  }

  if (request.method === 'PUT' && url.pathname.startsWith(storageReviewTableApiPath)) {
    const tableName = decodeURIComponent(url.pathname.slice(storageReviewTableApiPath.length));
    const state = await store.updateTable(
      tableName,
      parseStorageSchemaTablePatch(await readBody(request))
    );
    broadcastStorageReviewState(server, state);
    writeJson(response, 200, state);
    return;
  }

  writeJson(response, 404, { error: 'Unknown storage review endpoint' });
}

async function updateStorageReviewEntryFile(
  filePath: string,
  typeName: string,
  patch: StorageReviewEntryPatch
): Promise<StorageReviewState> {
  const state = await readStorageReviewState(filePath);
  const targetIndex = state.entries.findIndex((entry) => entry.type === typeName);
  if (targetIndex < 0) {
    throw new Error(`Unknown TDLib type: ${typeName}`);
  }

  if (patch.maturity !== undefined) {
    parseMaturity(patch.maturity, 'maturity');
  }
  if (
    patch.storage !== undefined &&
    patch.storage.length > 0 &&
    !state.storageOptions.includes(patch.storage)
  ) {
    throw new Error(`Unknown storage kind: ${patch.storage}`);
  }

  const current = state.entries[targetIndex];
  if (current === undefined) {
    throw new Error(`Unknown TDLib type: ${typeName}`);
  }

  const nextEntry: StorageReviewEntry = {
    maturity: patch.maturity ?? current.maturity,
    reviewIssues: [],
    reviews: patch.reviews ?? current.reviews,
    ...(current.schemaDesign === undefined ? {} : { schemaDesign: current.schemaDesign }),
    storage: patch.storage ?? current.storage,
    storageTarget: patch.storageTarget ?? current.storageTarget,
    type: current.type
  };
  nextEntry.reviewIssues = validateStorageReview(nextEntry, state.storageOptions);
  const nextState: StorageReviewState = {
    ...state,
    entries: state.entries.map((entry, index) => (index === targetIndex ? nextEntry : entry))
  };

  await writeStorageReviewState(filePath, nextState);
  return nextState;
}

async function updateStorageSchemaTableFile(
  filePath: string,
  tableName: string,
  patch: StorageSchemaTablePatch
): Promise<StorageReviewState> {
  const state = await readStorageReviewState(filePath);
  const tables = state.tables ?? [];
  const targetIndex = tables.findIndex((table) => table.name === tableName);
  if (targetIndex < 0) {
    throw new Error(`Unknown storage schema table: ${tableName}`);
  }

  const current = tables[targetIndex];
  if (current === undefined) {
    throw new Error(`Unknown storage schema table: ${tableName}`);
  }

  const nextTable: StorageSchemaTable = {
    ...current,
    ...(patch.columnLayout === undefined ? {} : { columnLayout: patch.columnLayout })
  };
  const nextState: StorageReviewState = {
    ...state,
    tables: tables.map((table, index) => (index === targetIndex ? nextTable : table))
  };

  await writeStorageReviewState(filePath, nextState);
  return nextState;
}

async function writeStorageReviewState(filePath: string, state: StorageReviewState): Promise<void> {
  const directory = dirname(filePath);
  const temporaryPath = resolve(directory, `.${basename(filePath)}.tmp`);
  await mkdir(directory, { recursive: true });
  await writeFile(
    temporaryPath,
    `${JSON.stringify(toStorageReviewFile(state), null, 2)}\n`,
    'utf8'
  );
  await rename(temporaryPath, filePath);
}

function parseStorageReviewState(value: unknown): StorageReviewState {
  if (!isRecord(value) || (value.version !== 1 && value.version !== 2)) {
    throw new Error('Storage review file has an unsupported version');
  }

  const storageOptions = parseStringList(value.storageOptions, 'storageOptions');
  const entries = parseStorageReviewEntries(value.entries, storageOptions);
  return {
    entries,
    storageOptions,
    ...(value.tables === undefined ? {} : { tables: parseStorageSchemaTables(value.tables) }),
    ...(value.updateDesigns === undefined
      ? {}
      : { updateDesigns: parseStorageSchemaUpdateDesigns(value.updateDesigns) }),
    version: value.version
  };
}

function parseStorageReviewEntries(value: unknown, storageOptions: string[]): StorageReviewEntry[] {
  if (!Array.isArray(value)) {
    throw new Error('Storage review entries must be an array');
  }

  const seenTypes = new Set<string>();
  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Storage review entry ${String(index)} must be an object`);
    }

    assertKnownKeys(
      entry,
      ['type', 'maturity', 'storage', 'storageTarget', 'reviews', 'schemaDesign'],
      `entries[${String(index)}]`
    );
    const typeName = parseRequiredString(entry.type, `entries[${String(index)}].type`);
    const storage = parseString(entry.storage, `entries[${String(index)}].storage`).trim();
    const storageTarget = parseString(
      entry.storageTarget,
      `entries[${String(index)}].storageTarget`
    );
    const maturity = parseMaturity(entry.maturity, `entries[${String(index)}].maturity`);
    const reviews = parseStorageReviews(entry.reviews, `entries[${String(index)}].reviews`);
    const schemaDesign = parseStorageTypeSchemaDesign(
      entry.schemaDesign,
      `entries[${String(index)}].schemaDesign`
    );
    if (seenTypes.has(typeName)) {
      throw new Error(`Duplicate TDLib type in storage review file: ${typeName}`);
    }
    if (storage.length > 0 && !storageOptions.includes(storage)) {
      throw new Error(`Storage kind ${storage} is not listed in storageOptions`);
    }

    seenTypes.add(typeName);
    const parsedEntry: StorageReviewEntry = {
      maturity,
      reviewIssues: [],
      reviews,
      ...(schemaDesign === undefined ? {} : { schemaDesign }),
      storage,
      storageTarget,
      type: typeName
    };
    parsedEntry.reviewIssues = validateStorageReview(parsedEntry, storageOptions);
    return parsedEntry;
  });
}

function toStorageReviewFile(state: StorageReviewState): unknown {
  return {
    version: state.version,
    storageOptions: state.storageOptions,
    ...(state.tables === undefined || state.tables.length === 0 ? {} : { tables: state.tables }),
    ...(state.updateDesigns === undefined ? {} : { updateDesigns: state.updateDesigns }),
    entries: state.entries.map((entry) => ({
      type: entry.type,
      maturity: entry.maturity,
      storage: entry.storage,
      storageTarget: entry.storageTarget,
      ...(entry.schemaDesign === undefined ? {} : { schemaDesign: entry.schemaDesign }),
      ...(entry.reviews.length === 0 ? {} : { reviews: entry.reviews })
    }))
  };
}

function parseStorageTypeSchemaDesign(
  value: unknown,
  fieldName: string
): StorageReviewEntry['schemaDesign'] {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new Error(`${fieldName} must be an object`);
  }
  assertKnownKeys(value, ['constructors', 'notes'], fieldName);
  return {
    constructors: parseStorageSchemaConstructors(value.constructors, `${fieldName}.constructors`),
    notes: parseStringList(value.notes, `${fieldName}.notes`)
  };
}

function parseStorageSchemaConstructors(
  value: unknown,
  fieldName: string
): NonNullable<StorageReviewEntry['schemaDesign']>['constructors'] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }

  const seenNames = new Set<string>();
  return value.map((constructor, index) => {
    const itemFieldName = `${fieldName}[${String(index)}]`;
    if (!isRecord(constructor)) {
      throw new Error(`${itemFieldName} must be an object`);
    }
    assertKnownKeys(constructor, ['name', 'fields', 'notes', 'target'], itemFieldName);
    const name = parseRequiredString(constructor.name, `${itemFieldName}.name`);
    if (seenNames.has(name)) {
      throw new Error(`${fieldName} must not contain duplicate constructor ${name}`);
    }
    seenNames.add(name);

    return {
      fields: parseStorageSchemaFields(constructor.fields, `${itemFieldName}.fields`),
      name,
      notes: parseStringList(constructor.notes, `${itemFieldName}.notes`),
      ...(constructor.target === undefined
        ? {}
        : {
            target: parseStorageSchemaConstructorTarget(
              constructor.target,
              `${itemFieldName}.target`
            )
          })
    };
  });
}

function parseStorageSchemaFields(
  value: unknown,
  fieldName: string
): NonNullable<StorageReviewEntry['schemaDesign']>['constructors'][number]['fields'] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }

  const seenNames = new Set<string>();
  return value.map((field, index) => {
    const itemFieldName = `${fieldName}[${String(index)}]`;
    if (!isRecord(field)) {
      throw new Error(`${itemFieldName} must be an object`);
    }
    assertKnownKeys(field, ['name', 'tdlibType', 'target', 'notes'], itemFieldName);
    const name = parseRequiredString(field.name, `${itemFieldName}.name`);
    if (seenNames.has(name)) {
      throw new Error(`${fieldName} must not contain duplicate field ${name}`);
    }
    seenNames.add(name);

    return {
      name,
      notes: parseStringList(field.notes, `${itemFieldName}.notes`),
      target: parseStorageSchemaFieldTarget(field.target, `${itemFieldName}.target`),
      tdlibType: parseRequiredString(field.tdlibType, `${itemFieldName}.tdlibType`)
    };
  });
}

function parseStorageSchemaConstructorTarget(
  value: unknown,
  fieldName: string
): NonNullable<NonNullable<StorageReviewEntry['schemaDesign']>['constructors'][number]['target']> {
  if (!isRecord(value)) {
    throw new Error(`${fieldName} must be an object`);
  }
  const kind = parseRequiredString(value.kind, `${fieldName}.kind`);
  if (kind === 'event') {
    assertKnownKeys(value, ['kind', 'event'], fieldName);
    return { event: parseRequiredString(value.event, `${fieldName}.event`), kind };
  }
  if (kind === 'kv') {
    assertKnownKeys(
      value,
      ['kind', 'table', 'key', 'keySourceFields', 'sourceFields', 'valueColumn'],
      fieldName
    );
    return {
      key: parseRequiredString(value.key, `${fieldName}.key`),
      ...(value.keySourceFields === undefined
        ? {}
        : {
            keySourceFields: parseStringList(value.keySourceFields, `${fieldName}.keySourceFields`)
          }),
      kind,
      ...(value.sourceFields === undefined
        ? {}
        : {
            sourceFields: parseStringList(value.sourceFields, `${fieldName}.sourceFields`)
          }),
      table: parseRequiredString(value.table, `${fieldName}.table`),
      valueColumn: parseRequiredString(value.valueColumn, `${fieldName}.valueColumn`)
    };
  }

  throw new Error(`${fieldName}.kind is not supported`);
}

function parseStorageSchemaFieldTarget(
  value: unknown,
  fieldName: string
): StorageSchemaFieldTarget {
  if (!isRecord(value)) {
    throw new Error(`${fieldName} must be an object`);
  }
  const kind = parseRequiredString(value.kind, `${fieldName}.kind`);
  if (kind === 'pending') {
    assertKnownKeys(value, ['kind'], fieldName);
    return { kind };
  }
  if (kind === 'constructor-payload') {
    assertKnownKeys(value, ['kind'], fieldName);
    return { kind };
  }
  if (kind === 'embedded-payload') {
    assertKnownKeys(value, ['kind'], fieldName);
    return { kind };
  }
  if (kind === 'table-column') {
    assertKnownKeys(value, ['kind', 'fieldId'], fieldName);
    return { fieldId: parseRequiredString(value.fieldId, `${fieldName}.fieldId`), kind };
  }
  if (kind === 'table-ref') {
    assertKnownKeys(value, ['kind', 'fieldId', 'referencedTable'], fieldName);
    return {
      fieldId: parseRequiredString(value.fieldId, `${fieldName}.fieldId`),
      kind,
      ...(value.referencedTable === undefined
        ? {}
        : {
            referencedTable: parseRequiredString(
              value.referencedTable,
              `${fieldName}.referencedTable`
            )
          })
    };
  }
  if (kind === 'embedded') {
    assertKnownKeys(value, ['kind', 'table', 'column', 'path'], fieldName);
    return {
      column: parseRequiredString(value.column, `${fieldName}.column`),
      kind,
      ...(value.path === undefined
        ? {}
        : { path: parseRequiredString(value.path, `${fieldName}.path`) }),
      table: parseRequiredString(value.table, `${fieldName}.table`)
    };
  }
  if (kind === 'dynamic') {
    assertKnownKeys(value, ['kind', 'ruleId'], fieldName);
    return { kind, ruleId: parseRequiredString(value.ruleId, `${fieldName}.ruleId`) };
  }
  if (kind === 'event-payload') {
    assertKnownKeys(value, ['kind', 'event'], fieldName);
    return { event: parseRequiredString(value.event, `${fieldName}.event`), kind };
  }
  if (kind === 'not-stored') {
    assertKnownKeys(value, ['kind', 'reason'], fieldName);
    return { kind, reason: parseRequiredString(value.reason, `${fieldName}.reason`) };
  }

  throw new Error(`${fieldName}.kind is not supported`);
}

function parseStorageSchemaTables(value: unknown): StorageSchemaTable[] {
  if (!Array.isArray(value)) {
    throw new Error('tables must be an array');
  }

  const seenNames = new Set<string>();
  return value.map((table, index) => {
    const fieldName = `tables[${String(index)}]`;
    if (!isRecord(table)) {
      throw new Error(`${fieldName} must be an object`);
    }
    assertKnownKeys(
      table,
      [
        'name',
        'columnLayout',
        'sourceTypes',
        'indirectSourceTypes',
        'columns',
        'primaryKey',
        'foreignKeys',
        'indexes',
        'notes'
      ],
      fieldName
    );
    const name = parseRequiredString(table.name, `${fieldName}.name`);
    if (seenNames.has(name)) {
      throw new Error(`tables must not contain duplicate table ${name}`);
    }
    seenNames.add(name);

    return {
      ...(table.columnLayout === undefined
        ? {}
        : {
            columnLayout: parseSchemaColumnLayout(table.columnLayout, `${fieldName}.columnLayout`)
          }),
      columns: parseStorageSchemaTableColumns(table.columns, `${fieldName}.columns`),
      foreignKeys: parseStorageSchemaForeignKeys(table.foreignKeys, `${fieldName}.foreignKeys`),
      indexes: parseUnknownArray(table.indexes, `${fieldName}.indexes`),
      indirectSourceTypes: parseStringList(
        table.indirectSourceTypes,
        `${fieldName}.indirectSourceTypes`
      ),
      name,
      notes: parseStringList(table.notes, `${fieldName}.notes`),
      primaryKey: parseStringList(table.primaryKey, `${fieldName}.primaryKey`),
      sourceTypes: parseStringList(table.sourceTypes, `${fieldName}.sourceTypes`)
    };
  });
}

function parseStorageSchemaForeignKeys(
  value: unknown,
  fieldName: string
): StorageSchemaTable['foreignKeys'] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }

  const seenIds = new Set<string>();
  return value.map((foreignKey, index) => {
    const itemFieldName = `${fieldName}[${String(index)}]`;
    if (!isRecord(foreignKey)) {
      throw new Error(`${itemFieldName} must be an object`);
    }
    assertKnownKeys(
      foreignKey,
      ['id', 'columns', 'referencedTable', 'referencedColumns', 'sourceFields', 'notes'],
      itemFieldName
    );
    const id = parseRequiredString(foreignKey.id, `${itemFieldName}.id`);
    if (seenIds.has(id)) {
      throw new Error(`${fieldName} must not contain duplicate foreign key ${id}`);
    }
    seenIds.add(id);

    return {
      columns: parseStringList(foreignKey.columns, `${itemFieldName}.columns`),
      id,
      notes: parseStringList(foreignKey.notes, `${itemFieldName}.notes`),
      referencedColumns: parseStringList(
        foreignKey.referencedColumns,
        `${itemFieldName}.referencedColumns`
      ),
      referencedTable: parseRequiredString(
        foreignKey.referencedTable,
        `${itemFieldName}.referencedTable`
      ),
      sourceFields: parseStringList(foreignKey.sourceFields, `${itemFieldName}.sourceFields`)
    };
  });
}

function parseStorageSchemaTableColumns(
  value: unknown,
  fieldName: string
): StorageSchemaTable['columns'] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }

  const seenIds = new Set<string>();
  return value.map((column, index) => {
    const itemFieldName = `${fieldName}[${String(index)}]`;
    if (!isRecord(column)) {
      throw new Error(`${itemFieldName} must be an object`);
    }
    assertKnownKeys(
      column,
      ['id', 'name', 'pgType', 'nullable', 'role', 'sourceFields', 'keyRule', 'notes'],
      itemFieldName
    );
    const id = parseRequiredString(column.id, `${itemFieldName}.id`);
    if (seenIds.has(id)) {
      throw new Error(`${fieldName} must not contain duplicate column ${id}`);
    }
    seenIds.add(id);

    return {
      id,
      ...(column.keyRule === undefined
        ? {}
        : { keyRule: parseStorageSchemaColumnKeyRule(column.keyRule, `${itemFieldName}.keyRule`) }),
      name: parseRequiredString(column.name, `${itemFieldName}.name`),
      notes: parseStringList(column.notes, `${itemFieldName}.notes`),
      nullable: parseBoolean(column.nullable, `${itemFieldName}.nullable`),
      pgType: parseRequiredString(column.pgType, `${itemFieldName}.pgType`),
      role: parseTableColumnRole(column.role, `${itemFieldName}.role`),
      sourceFields: parseStringList(column.sourceFields, `${itemFieldName}.sourceFields`)
    };
  });
}

function parseStorageSchemaColumnKeyRule(
  value: unknown,
  fieldName: string
): NonNullable<StorageSchemaTable['columns'][number]['keyRule']> {
  if (!isRecord(value)) {
    throw new Error(`${fieldName} must be an object`);
  }
  const kind = parseRequiredString(value.kind, `${fieldName}.kind`);
  if (kind === 'constructor-discriminator') {
    assertKnownKeys(value, ['kind', 'type', 'cases'], fieldName);
    return {
      cases: parseStringMap(value.cases, `${fieldName}.cases`),
      kind,
      type: parseRequiredString(value.type, `${fieldName}.type`)
    };
  }

  throw new Error(`${fieldName}.kind is not supported`);
}

function parseStorageSchemaUpdateDesigns(
  value: unknown
): Record<string, StorageSchemaUpdateDesign> {
  if (!isRecord(value)) {
    throw new Error('updateDesigns must be an object');
  }

  const result: Record<string, StorageSchemaUpdateDesign> = {};
  for (const [updateName, updateDesign] of Object.entries(value)) {
    const parsedUpdateName = parseRequiredString(updateName, 'updateDesigns.key');
    result[parsedUpdateName] = parseStorageSchemaUpdateDesign(
      updateDesign,
      `updateDesigns.${parsedUpdateName}`
    );
  }

  return result;
}

function parseStorageSchemaUpdateDesign(
  value: unknown,
  fieldName: string
): StorageSchemaUpdateDesign {
  if (!isRecord(value)) {
    throw new Error(`${fieldName} must be an object`);
  }

  assertKnownKeys(value, ['fields', 'handlerPlan', 'notes'], fieldName);
  return {
    fields: parseStorageSchemaUpdateFieldDesigns(value.fields, `${fieldName}.fields`),
    ...(value.handlerPlan === undefined
      ? {}
      : {
          handlerPlan: parseStorageSchemaUpdateHandlerPlan(
            value.handlerPlan,
            `${fieldName}.handlerPlan`
          )
        }),
    notes: parseStringList(value.notes, `${fieldName}.notes`)
  };
}

function parseStorageSchemaUpdateFieldDesigns(
  value: unknown,
  fieldName: string
): StorageSchemaUpdateDesign['fields'] {
  if (!isRecord(value)) {
    throw new Error(`${fieldName} must be an object`);
  }

  const result: StorageSchemaUpdateDesign['fields'] = {};
  for (const [updateFieldName, fieldDesign] of Object.entries(value)) {
    const parsedUpdateFieldName = parseRequiredString(updateFieldName, `${fieldName}.key`);
    if (!isRecord(fieldDesign)) {
      throw new Error(`${fieldName}.${parsedUpdateFieldName} must be an object`);
    }
    assertKnownKeys(
      fieldDesign,
      ['effects', 'events', 'ignored', 'notes'],
      `${fieldName}.${parsedUpdateFieldName}`
    );
    result[parsedUpdateFieldName] = {
      ...(fieldDesign.effects === undefined
        ? {}
        : {
            effects: parseStorageSchemaUpdateEffectRoutes(
              fieldDesign.effects,
              `${fieldName}.${parsedUpdateFieldName}.effects`
            )
          }),
      ...(fieldDesign.events === undefined
        ? {}
        : {
            events: parseStorageSchemaUpdateEventRoutes(
              fieldDesign.events,
              `${fieldName}.${parsedUpdateFieldName}.events`
            )
          }),
      ...(fieldDesign.ignored === undefined
        ? {}
        : {
            ignored: parseStorageSchemaUpdateIgnoredRoute(
              fieldDesign.ignored,
              `${fieldName}.${parsedUpdateFieldName}.ignored`
            )
          }),
      ...(fieldDesign.notes === undefined
        ? {}
        : {
            notes: parseStringList(fieldDesign.notes, `${fieldName}.${parsedUpdateFieldName}.notes`)
          })
    };
  }

  return result;
}

function parseStorageSchemaUpdateEventRoutes(
  value: unknown,
  fieldName: string
): NonNullable<StorageSchemaUpdateDesign['fields'][string]['events']> {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }

  return value.map((route, index) => {
    const itemFieldName = `${fieldName}[${String(index)}]`;
    if (!isRecord(route)) {
      throw new Error(`${itemFieldName} must be an object`);
    }
    assertKnownKeys(route, ['name', 'notes', 'sourceFields'], itemFieldName);
    return {
      name: parseRequiredString(route.name, `${itemFieldName}.name`),
      notes: parseStringList(route.notes, `${itemFieldName}.notes`),
      sourceFields: parseStringList(route.sourceFields, `${itemFieldName}.sourceFields`)
    };
  });
}

function parseStorageSchemaUpdateEffectRoutes(
  value: unknown,
  fieldName: string
): NonNullable<StorageSchemaUpdateDesign['fields'][string]['effects']> {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }

  return value.map((route, index) => {
    const itemFieldName = `${fieldName}[${String(index)}]`;
    if (!isRecord(route)) {
      throw new Error(`${itemFieldName} must be an object`);
    }
    assertKnownKeys(route, ['kind', 'name', 'notes', 'sourceFields'], itemFieldName);
    return {
      kind: parseStorageSchemaUpdateEffectKind(route.kind, `${itemFieldName}.kind`),
      name: parseRequiredString(route.name, `${itemFieldName}.name`),
      notes: parseStringList(route.notes, `${itemFieldName}.notes`),
      sourceFields: parseStringList(route.sourceFields, `${itemFieldName}.sourceFields`)
    };
  });
}

function parseStorageSchemaUpdateIgnoredRoute(
  value: unknown,
  fieldName: string
): NonNullable<StorageSchemaUpdateDesign['fields'][string]['ignored']> {
  if (!isRecord(value)) {
    throw new Error(`${fieldName} must be an object`);
  }

  assertKnownKeys(value, ['reason'], fieldName);
  return { reason: parseRequiredString(value.reason, `${fieldName}.reason`) };
}

function parseStorageSchemaUpdateHandlerPlan(
  value: unknown,
  fieldName: string
): StorageSchemaUpdateHandlerPlan {
  if (!isRecord(value)) {
    throw new Error(`${fieldName} must be an object`);
  }

  assertKnownKeys(value, ['maturity', 'notes', 'status', 'steps', 'summary'], fieldName);
  return {
    maturity: parseMaturity(value.maturity, `${fieldName}.maturity`),
    notes: parseStringList(value.notes, `${fieldName}.notes`),
    status: parseStorageSchemaUpdateHandlerPlanStatus(value.status, `${fieldName}.status`),
    steps: parseStorageSchemaUpdateHandlerPlanSteps(value.steps, `${fieldName}.steps`),
    summary: parseRequiredString(value.summary, `${fieldName}.summary`)
  };
}

function parseStorageSchemaUpdateHandlerPlanSteps(
  value: unknown,
  fieldName: string
): StorageSchemaUpdateHandlerPlanStep[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }

  const seenIds = new Set<string>();
  return value.map((step, index) => {
    const itemFieldName = `${fieldName}[${String(index)}]`;
    if (!isRecord(step)) {
      throw new Error(`${itemFieldName} must be an object`);
    }
    assertKnownKeys(
      step,
      [
        'id',
        'op',
        'description',
        'sourceFields',
        'table',
        'columns',
        'type',
        'event',
        'effect',
        'effectKind',
        'condition'
      ],
      itemFieldName
    );
    const id = parseRequiredString(step.id, `${itemFieldName}.id`);
    if (seenIds.has(id)) {
      throw new Error(`${fieldName} must not contain duplicate step ${id}`);
    }
    seenIds.add(id);

    return {
      ...(step.columns === undefined
        ? {}
        : { columns: parseStringList(step.columns, `${itemFieldName}.columns`) }),
      ...(step.condition === undefined
        ? {}
        : { condition: parseRequiredString(step.condition, `${itemFieldName}.condition`) }),
      description: parseRequiredString(step.description, `${itemFieldName}.description`),
      ...(step.effect === undefined
        ? {}
        : { effect: parseRequiredString(step.effect, `${itemFieldName}.effect`) }),
      ...(step.effectKind === undefined
        ? {}
        : {
            effectKind: parseStorageSchemaUpdateEffectKind(
              step.effectKind,
              `${itemFieldName}.effectKind`
            )
          }),
      ...(step.event === undefined
        ? {}
        : { event: parseRequiredString(step.event, `${itemFieldName}.event`) }),
      id,
      op: parseStorageSchemaUpdateHandlerPlanStepOp(step.op, `${itemFieldName}.op`),
      sourceFields: parseStringList(step.sourceFields, `${itemFieldName}.sourceFields`),
      ...(step.table === undefined
        ? {}
        : { table: parseRequiredString(step.table, `${itemFieldName}.table`) }),
      ...(step.type === undefined
        ? {}
        : { type: parseRequiredString(step.type, `${itemFieldName}.type`) })
    };
  });
}

function parseStorageSchemaUpdateEffectKind(
  value: unknown,
  fieldName: string
): StorageSchemaUpdateEffectKind {
  const parsed = parseRequiredString(value, fieldName);
  if (schemaUpdateEffectKinds.has(parsed as StorageSchemaUpdateEffectKind)) {
    return parsed as StorageSchemaUpdateEffectKind;
  }

  throw new Error(`${fieldName} is not supported`);
}

function parseStorageSchemaUpdateHandlerPlanStatus(
  value: unknown,
  fieldName: string
): StorageSchemaUpdateHandlerPlanStatus {
  const parsed = parseRequiredString(value, fieldName);
  if (schemaUpdateHandlerPlanStatuses.has(parsed as StorageSchemaUpdateHandlerPlanStatus)) {
    return parsed as StorageSchemaUpdateHandlerPlanStatus;
  }

  throw new Error(`${fieldName} is not supported`);
}

function parseStorageSchemaUpdateHandlerPlanStepOp(
  value: unknown,
  fieldName: string
): StorageSchemaUpdateHandlerPlanStepOp {
  const parsed = parseRequiredString(value, fieldName);
  if (schemaUpdateHandlerPlanStepOps.has(parsed as StorageSchemaUpdateHandlerPlanStepOp)) {
    return parsed as StorageSchemaUpdateHandlerPlanStepOp;
  }

  throw new Error(`${fieldName} is not supported`);
}

function validateStorageReview(
  entry: StorageReviewEntry,
  storageOptions: string[]
): StorageReviewEntry['reviewIssues'] {
  const seenReviewKeys = new Set<string>();
  return entry.reviews.flatMap((review, index) => {
    const issues = validateStorageReviewItem(review, entry, storageOptions);
    if (isRecord(review)) {
      const schema = typeof review.schema === 'string' ? review.schema : undefined;
      const maturity =
        review.maturity === 1 || review.maturity === 2 || review.maturity === 3
          ? review.maturity
          : undefined;
      const reviewKey = `${schema ?? 'unknown'}:${
        maturity === undefined ? 'unknown' : String(maturity)
      }`;
      if (schema === storageDecisionReviewSchema && maturity !== undefined) {
        if (seenReviewKeys.has(reviewKey)) {
          issues.push(
            `reviews[${String(index)}] duplicates ${schema} maturity ${String(maturity)}`
          );
        }
        seenReviewKeys.add(reviewKey);
      }
      return issues.length === 0
        ? []
        : [
            {
              index,
              issues,
              ...(maturity === undefined ? {} : { maturity }),
              ...(schema === undefined ? {} : { schema })
            }
          ];
    }

    return issues.length === 0 ? [] : [{ index, issues }];
  });
}

function validateStorageReviewItem(
  review: unknown,
  entry: StorageReviewEntry,
  storageOptions: string[]
): string[] {
  if (!isRecord(review)) {
    return ['review must be an object'];
  }

  if (review.schema !== storageDecisionReviewSchema) {
    return [`review.schema must be "${storageDecisionReviewSchema}"`];
  }

  const issues: string[] = [];
  validateStorageDecisionReview(review, entry, storageOptions, issues);
  return issues;
}

function validateStorageDecisionReview(
  review: Record<string, unknown>,
  entry: StorageReviewEntry,
  storageOptions: string[],
  issues: string[]
): void {
  if (review.schema !== storageDecisionReviewSchema) {
    issues.push(`review.schema must be "${storageDecisionReviewSchema}"`);
  }
  if (review.status !== 'done' && review.status !== 'blocked') {
    issues.push('review.status must be "done" or "blocked"');
  }
  validateMaturity(review.maturity, 'review.maturity', issues);
  if (review.status === 'done') {
    if (entry.storage.length === 0) {
      issues.push('done review requires entry.storage');
    }
  }
  if (review.status === 'blocked') {
    if (!Array.isArray(review.openQuestions) || review.openQuestions.length === 0) {
      issues.push('blocked review requires at least one open question');
    }
  }

  validateRequiredString(review.decision, 'review.decision', issues);
  validateConstructors(review.constructors, issues);
  validateUses(review.uses, issues);
  validateRejectedStorage(review.rejectedStorage, entry.storage, storageOptions, issues);
  validateStringArray(review.notes, 'review.notes', issues);
  validateStringArray(review.openQuestions, 'review.openQuestions', issues);
  validateKnownKeys(
    review,
    [
      'schema',
      'status',
      'maturity',
      'decision',
      'constructors',
      'uses',
      'rejectedStorage',
      'notes',
      'openQuestions'
    ],
    'review',
    issues
  );
}

function validateConstructors(value: unknown, issues: string[]): void {
  if (!Array.isArray(value)) {
    issues.push('review.constructors must be an array');
    return;
  }

  value.forEach((constructor, index) => {
    if (!isRecord(constructor)) {
      issues.push(`review.constructors[${String(index)}] must be an object`);
      return;
    }

    validateRequiredString(constructor.name, `review.constructors[${String(index)}].name`, issues);
    validateStringArray(constructor.fields, `review.constructors[${String(index)}].fields`, issues);
    validateKnownKeys(
      constructor,
      ['name', 'fields'],
      `review.constructors[${String(index)}]`,
      issues
    );
  });
}

function validateUses(value: unknown, issues: string[]): void {
  if (!isRecord(value)) {
    issues.push('review.uses must be an object');
    return;
  }

  for (const field of reviewUseFields) {
    validateStringArray(value[field], `review.uses.${field}`, issues);
  }
  validateKnownKeys(value, reviewUseFields, 'review.uses', issues);
}

function validateRejectedStorage(
  value: unknown,
  selectedStorage: string,
  storageOptions: string[],
  issues: string[]
): void {
  if (!isRecord(value)) {
    issues.push('review.rejectedStorage must be an object');
    return;
  }

  const allowedRejectedStorage = storageOptions.filter((storage) => storage !== selectedStorage);
  validateKnownKeys(value, allowedRejectedStorage, 'review.rejectedStorage', issues);
  for (const storage of allowedRejectedStorage) {
    validateRequiredString(value[storage], `review.rejectedStorage.${storage}`, issues);
  }
}

function validateKnownKeys(
  value: Record<string, unknown>,
  knownKeys: string[],
  fieldName: string,
  issues: string[]
): void {
  const known = new Set(knownKeys);
  for (const key of Object.keys(value)) {
    if (!known.has(key)) {
      issues.push(`${fieldName}.${key} is not allowed`);
    }
  }
}

function validateStringArray(value: unknown, fieldName: string, issues: string[]): void {
  if (!Array.isArray(value)) {
    issues.push(`${fieldName} must be an array`);
    return;
  }

  value.forEach((item, index) => {
    validateRequiredString(item, `${fieldName}[${String(index)}]`, issues);
  });
}

function validateRequiredString(value: unknown, fieldName: string, issues: string[]): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    issues.push(`${fieldName} must be a non-empty string`);
  }
}

function validateMaturity(value: unknown, fieldName: string, issues: string[]): void {
  if (value !== 1 && value !== 2 && value !== 3) {
    issues.push(`${fieldName} must be 1, 2, or 3`);
  }
}

function parseStorageReviewEntryPatch(value: string): StorageReviewEntryPatch {
  const parsed = JSON.parse(value) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('Storage review entry patch must be an object');
  }

  assertKnownKeys(parsed, ['maturity', 'reviews', 'storage', 'storageTarget'], 'patch');
  const patch: StorageReviewEntryPatch = {};
  if (parsed.maturity !== undefined) {
    patch.maturity = parseMaturity(parsed.maturity, 'maturity');
  }
  if (parsed.reviews !== undefined) {
    patch.reviews = parseStorageReviews(parsed.reviews, 'reviews');
  }
  if (parsed.storage !== undefined) {
    patch.storage = parseString(parsed.storage, 'storage').trim();
  }
  if (parsed.storageTarget !== undefined) {
    patch.storageTarget = parseString(parsed.storageTarget, 'storageTarget');
  }
  if (
    patch.maturity === undefined &&
    patch.reviews === undefined &&
    patch.storage === undefined &&
    patch.storageTarget === undefined
  ) {
    throw new Error('Storage review entry patch is empty');
  }

  return patch;
}

function parseStorageSchemaTablePatch(value: string): StorageSchemaTablePatch {
  const parsed = JSON.parse(value) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('Storage schema table patch must be an object');
  }

  assertKnownKeys(parsed, ['columnLayout'], 'patch');
  const patch: StorageSchemaTablePatch = {};
  if (parsed.columnLayout !== undefined) {
    patch.columnLayout = parseSchemaColumnLayout(parsed.columnLayout, 'columnLayout');
  }
  if (patch.columnLayout === undefined) {
    throw new Error('Storage schema table patch is empty');
  }

  return patch;
}

function assertKnownKeys(
  value: Record<string, unknown>,
  knownKeys: string[],
  fieldName: string
): void {
  const known = new Set(knownKeys);
  for (const key of Object.keys(value)) {
    if (!known.has(key)) {
      throw new Error(`${fieldName}.${key} is not allowed`);
    }
  }
}

function parseString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }

  return value;
}

function parseRequiredString(value: unknown, fieldName: string): string {
  const parsed = parseString(value, fieldName).trim();
  if (parsed.length === 0) {
    throw new Error(`${fieldName} must not be empty`);
  }

  return parsed;
}

function parseMaturity(value: unknown, fieldName: string): 1 | 2 | 3 {
  if (value === undefined) {
    return 1;
  }
  if (value === 1 || value === 2 || value === 3) {
    return value;
  }

  throw new Error(`${fieldName} must be 1, 2, or 3`);
}

function parseStringList(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }

  const result = value.map((item, index) =>
    parseRequiredString(item, `${fieldName}[${String(index)}]`)
  );
  if (new Set(result).size !== result.length) {
    throw new Error(`${fieldName} must not contain duplicates`);
  }

  return result;
}

function parseStringMap(value: unknown, fieldName: string): Record<string, string> {
  if (!isRecord(value)) {
    throw new Error(`${fieldName} must be an object`);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      parseRequiredString(key, `${fieldName}.key`),
      parseRequiredString(item, `${fieldName}.${key}`)
    ])
  );
}

function parseUnknownArray(value: unknown, fieldName: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }

  return value;
}

function parseBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${fieldName} must be a boolean`);
  }

  return value;
}

function parseSchemaColumnLayout(value: unknown, fieldName: string): StorageSchemaColumnLayout {
  const layout = parseRequiredString(value, fieldName);
  if (schemaColumnLayouts.has(layout as StorageSchemaColumnLayout)) {
    return layout as StorageSchemaColumnLayout;
  }

  throw new Error(`${fieldName} must be ddl, grid, or stacked`);
}
function parseTableColumnRole(
  value: unknown,
  fieldName: string
): StorageSchemaTable['columns'][number]['role'] {
  const role = parseRequiredString(value, fieldName);
  if (role === 'data' || role === 'foreign-key' || role === 'primary-key') {
    return role;
  }

  throw new Error(`${fieldName} must be data, foreign-key, or primary-key`);
}

function parseStorageReviews(value: unknown, fieldName: string): unknown[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }

  return value;
}

function isStorageReviewRequest(request: IncomingMessage): boolean {
  const url = new URL(request.url ?? '/', 'http://tdlib-docs.local');
  return (
    url.pathname === storageReviewApiPath ||
    url.pathname.startsWith(storageReviewEntryApiPath) ||
    url.pathname.startsWith(storageReviewTableApiPath)
  );
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks).toString('utf8');
}

function broadcastStorageReviewState(server: ViteDevServer, state: StorageReviewState): void {
  server.ws.send({
    data: state,
    event: storageReviewUpdateEvent,
    type: 'custom'
  });
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
