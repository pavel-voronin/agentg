import { mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { getTableName, type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

const execFileAsync = promisify(execFile);

const ORACLE_REF =
  process.env.TELEGRAM_UPDATE_ORACLE_REF ?? '0249732835745567ce4297a9fa7be037de6b0616';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = join(root, 'packages/tdlib-docs/src/data/tdlibSchema.json');

type ConstructorSchema = {
  fields: { name: string; type: string }[];
  name: string;
  resultType: string;
};

type Schema = {
  constructors: ConstructorSchema[];
  updates: ConstructorSchema[];
};

type Snapshot = {
  effects: unknown[];
  events: unknown[];
  reads: unknown[];
  writes: unknown[];
};

type Failure = {
  current: Snapshot;
  oracle: Snapshot;
  update: { _: string };
  updateType: string;
};

type CatalogModule = {
  handledUpdateTypes: readonly string[];
  persistLiveUpdate(update: { _: string }, resources: unknown): Promise<void>;
};

type GeneratedContext = {
  constructorsByName: Map<string, ConstructorSchema>;
  constructorsByResult: Map<string, ConstructorSchema[]>;
};

const preferredConstructors = new Map<string, string>([
  ['AuthenticationCodeInfo', 'authenticationCodeInfo'],
  ['AuthenticationCodeType', 'authenticationCodeTypeTelegramMessage'],
  ['AuthorizationState', 'authorizationStateReady'],
  ['Background', 'background'],
  ['BackgroundFill', 'backgroundFillSolid'],
  ['BackgroundType', 'backgroundTypeWallpaper'],
  ['CallState', 'callStatePending'],
  ['ChatAction', 'chatActionTyping'],
  ['ChatAvailableReactions', 'chatAvailableReactionsAll'],
  ['ChatList', 'chatListMain'],
  ['ChatMemberStatus', 'chatMemberStatusMember'],
  ['ChatPhotoInfo', 'chatPhotoInfo'],
  ['ChatPosition', 'chatPosition'],
  ['ChatType', 'chatTypePrivate'],
  ['ConnectionState', 'connectionStateReady'],
  ['File', 'file'],
  ['FormattedText', 'formattedText'],
  ['MessageContent', 'messageText'],
  ['MessageInteractionInfo', 'messageInteractionInfo'],
  ['MessageReaction', 'messageReaction'],
  ['MessageReactions', 'messageReactions'],
  ['MessageSender', 'messageSenderUser'],
  ['MessageTopic', 'messageTopicDirectMessages'],
  ['NotificationGroup', 'notificationGroup'],
  ['NotificationGroupType', 'notificationGroupTypeMessages'],
  ['NotificationSettingsScope', 'notificationSettingsScopePrivateChats'],
  ['NotificationType', 'notificationTypeNewMessage'],
  ['OptionValue', 'optionValueString'],
  ['ReactionType', 'reactionTypeEmoji'],
  ['StoryContent', 'storyContentPhoto'],
  ['StoryList', 'storyListMain'],
  ['UserStatus', 'userStatusOnline'],
  ['UserType', 'userTypeRegular']
]);

async function main(): Promise<void> {
  const schema = JSON.parse(await readFile(schemaPath, 'utf8')) as Schema;
  const context = generatedContext(schema);
  const oracleTree = await materializeOracleTree();
  try {
    const oracleCatalog = await importCatalog(
      oracleTree,
      'packages/telegram/src/ingestion/catalog.ts'
    );
    const currentCatalog = await importCatalog(
      root,
      'packages/telegram/src/ingestion/adapters/catalog.ts'
    );
    const types = requestedUpdateTypes(
      assertSameInventory(oracleCatalog.handledUpdateTypes, currentCatalog.handledUpdateTypes)
    );
    const failures = [];

    for (const updateType of types) {
      const update = generateUpdate(updateType, context);
      const oracle = await capture(oracleCatalog, update);
      const current = await capture(currentCatalog, update);
      if (JSON.stringify(oracle) !== JSON.stringify(current)) {
        failures.push({ current, oracle, update, updateType });
      }
    }

    if (failures.length > 0) {
      console.error(
        JSON.stringify(
          {
            failureCount: failures.length,
            failures:
              process.env.TELEGRAM_UPDATE_REGRESSION_VERBOSE === '1'
                ? failures
                : process.env.TELEGRAM_UPDATE_REGRESSION_DIFF === '1'
                  ? failures.map(summarizeFailure)
                  : failures.map((failure) => failure.updateType),
            oracleRef: ORACLE_REF
          },
          null,
          2
        )
      );
      process.exitCode = 1;
      return;
    }

    console.log(
      JSON.stringify(
        {
          comparedUpdates: types.length,
          oracleRef: ORACLE_REF,
          status: 'ok'
        },
        null,
        2
      )
    );
  } finally {
    await rm(oracleTree, { force: true, recursive: true });
  }
}

async function materializeOracleTree(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'agentg-telegram-oracle-'));
  await execFileAsync('bash', ['-lc', `git archive ${ORACLE_REF} | tar -x -C "${directory}"`], {
    cwd: root
  });
  await symlink(join(root, 'node_modules'), join(directory, 'node_modules'));
  return directory;
}

async function importCatalog(tree: string, path: string): Promise<CatalogModule> {
  return (await import(pathToFileURL(join(tree, path)).href)) as CatalogModule;
}

function assertSameInventory(left: readonly string[], right: readonly string[]): string[] {
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  if (JSON.stringify(leftSorted) !== JSON.stringify(rightSorted)) {
    throw new Error(
      `Update handler inventory mismatch: ${JSON.stringify({ current: rightSorted, oracle: leftSorted })}`
    );
  }
  return rightSorted;
}

function requestedUpdateTypes(types: string[]): string[] {
  const requested = process.env.TELEGRAM_UPDATE_REGRESSION_TYPES;
  if (requested === undefined || requested.trim().length === 0) {
    return types;
  }
  const requestedTypes = new Set(requested.split(',').map((type) => type.trim()));
  return types.filter((type) => requestedTypes.has(type));
}

function summarizeFailure(failure: Failure): unknown {
  return {
    sections: Object.fromEntries(
      (['writes', 'effects', 'events', 'reads'] as const).map((section) => [
        section,
        summarizeSection(failure.oracle[section], failure.current[section])
      ])
    ),
    updateType: failure.updateType
  };
}

function summarizeSection(oracle: unknown[], current: unknown[]): unknown {
  const firstDifferenceIndex = firstDifferentIndex(oracle, current);
  return {
    currentCount: current.length,
    equal: firstDifferenceIndex === null && oracle.length === current.length,
    firstDifferenceIndex,
    firstDifference:
      firstDifferenceIndex === null
        ? null
        : {
            current: current[firstDifferenceIndex] ?? null,
            oracle: oracle[firstDifferenceIndex] ?? null
          },
    oracleCount: oracle.length
  };
}

function firstDifferentIndex(left: unknown[], right: unknown[]): number | null {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (JSON.stringify(left[index] ?? null) !== JSON.stringify(right[index] ?? null)) {
      return index;
    }
  }
  return null;
}

async function capture(catalog: CatalogModule, update: { _: string }): Promise<Snapshot> {
  const snapshot: Snapshot = { effects: [], events: [], reads: [], writes: [] };
  await catalog.persistLiveUpdate(update, resources(snapshot));
  return sortSnapshot(snapshot);
}

function resources(snapshot: Snapshot): unknown {
  const database = databaseProbe(snapshot);
  return {
    account: {
      clear: () => snapshot.effects.push({ op: 'account.clear' }),
      senderKey: () => 'user:30',
      setUserId: (userId: unknown) => snapshot.effects.push({ op: 'account.setUserId', userId })
    },
    database,
    events: {
      publish: (type: string, payload?: unknown) =>
        snapshot.events.push({ payload: normalize(payload), type })
    },
    files: new Proxy(
      {},
      {
        get: (_target, property) => {
          return (...args: unknown[]) => {
            snapshot.effects.push(normalize(canonicalFileEffect(String(property), args)));
            return Promise.resolve();
          };
        }
      }
    ),
    liveCoverage: {
      markConnected: () => Promise.resolve(),
      markDisconnected: () => Promise.resolve(),
      recordLiveMessage: (chatId: string, date: Date) => {
        snapshot.effects.push({
          chatId,
          date: normalize(date),
          op: 'liveCoverage.recordLiveMessage'
        });
        return Promise.resolve();
      },
      syncKnownChats: () => Promise.resolve(),
      tick: () => Promise.resolve(),
      wait: () => Promise.resolve()
    },
    status: new Proxy(
      {},
      {
        get: (_target, property) => {
          if (property === 'snapshot') {
            return () => ({});
          }
          return (...args: unknown[]) => {
            snapshot.effects.push({ args: normalize(args), op: `status.${String(property)}` });
          };
        }
      }
    )
  };
}

function canonicalFileEffect(property: string, args: unknown[]): unknown {
  if (property === 'handleFileSnapshot') {
    const [snapshot] = args;
    return {
      args: [canonicalFileSnapshot(snapshot)],
      op: 'files.handleFileSnapshot'
    };
  }
  if (property === 'handleUpdateFile') {
    const [update] = args;
    return {
      args: [canonicalFileSnapshot(rawField(update, 'file'))],
      op: 'files.handleFileSnapshot'
    };
  }
  if (property === 'startFileGeneration') {
    const [request] = args;
    return {
      args: [canonicalFileGenerationRequest(request)],
      op: 'files.startFileGeneration'
    };
  }
  if (property === 'recordFileSlots') {
    const [recording, cause] = args;
    return {
      args: [canonicalFileRecording(recording), cause],
      op: 'files.recordFileSlots'
    };
  }
  if (property === 'recordChatFiles') {
    const [chat, cause] = args;
    return canonicalRecordFileSlots(
      {
        update: {
          chat: {
            chat,
            id: stringIdField(chat, 'id')
          }
        }
      },
      cause
    );
  }
  if (property === 'recordChatBackgroundFiles') {
    const [chatId, background, cause] = args;
    return canonicalRecordFileSlots(
      {
        scope: { slotKeyPrefix: 'background.' },
        update: { chatBackground: { background, chatId } }
      },
      cause
    );
  }
  if (property === 'recordChatPhotoFiles') {
    const [chatId, photo, cause] = args;
    return canonicalRecordFileSlots(
      {
        scope: { slotKeyPrefix: 'avatar.' },
        update: { chatPhoto: { chatId, photo } }
      },
      cause
    );
  }
  if (property === 'recordChatThemeFiles') {
    const [chatId, theme, cause] = args;
    return canonicalRecordFileSlots(
      {
        scope: { slotKeyPrefix: 'theme.' },
        update: { chatTheme: { chatId, theme } }
      },
      cause
    );
  }
  if (property === 'recordDefaultBackgroundFiles') {
    const [key, background, cause] = args;
    return canonicalRecordFileSlots(
      {
        scope: { slotKeyPrefix: 'background.' },
        update: { defaultBackground: { background, key } }
      },
      cause
    );
  }
  if (property === 'recordEmojiChatThemeFiles') {
    const [themes, cause] = args;
    return canonicalRecordFileSlots({ update: { emojiChatThemes: { themes } } }, cause);
  }
  if (property === 'recordMessageContentFiles') {
    const [update, cause] = args;
    return canonicalRecordFileSlots(
      {
        update: {
          contentUpdate: {
            chatId: stringIdField(update, 'chat_id'),
            content: objectValue(update, 'new_content'),
            messageId: stringIdField(update, 'message_id')
          }
        }
      },
      cause
    );
  }
  if (property === 'recordMessageFiles') {
    const [message, cause] = args;
    return canonicalRecordFileSlots(
      {
        update: {
          message: {
            chatId: stringIdField(message, 'chat_id'),
            content: objectValue(message, 'content'),
            messageId: stringIdField(message, 'id')
          }
        }
      },
      cause
    );
  }
  if (property === 'recordNotificationGroupFiles') {
    const [groups, cause] = args;
    return canonicalRecordFileSlots({ update: { notificationGroups: { groups } } }, cause);
  }
  if (property === 'recordActiveNotificationSnapshotFiles') {
    const [groups, cause] = args;
    return canonicalRecordFileSlots(
      {
        options: { pruneStaleActiveNotificationSlots: true },
        update: { notificationGroups: { groups } }
      },
      cause
    );
  }
  if (property === 'recordNotificationFiles') {
    const [groupId, notification, cause] = args;
    return canonicalRecordFileSlots(
      {
        update: {
          notificationGroups: {
            groups: [
              {
                id: groupId,
                notifications: [notification]
              }
            ]
          }
        }
      },
      cause
    );
  }
  if (property === 'recordQuickReplyMessageFiles') {
    const [message, cause] = args;
    return canonicalRecordFileSlots(
      {
        update: {
          quickReplyMessage: {
            content: objectValue(message, 'content'),
            messageId: stringIdField(message, 'id')
          }
        }
      },
      cause
    );
  }
  if (property === 'recordStickerSetFiles') {
    const [stickerSet, cause] = args;
    return canonicalRecordFileSlots(
      {
        update: {
          stickerSet: {
            id: rawField(stickerSet, 'id'),
            stickerSet
          }
        }
      },
      cause
    );
  }
  if (property === 'recordStoryFiles') {
    const [story, cause] = args;
    return canonicalRecordFileSlots(
      {
        update: {
          story: {
            posterChatId: stringIdField(story, 'poster_chat_id'),
            story,
            storyId: rawField(story, 'id')
          }
        }
      },
      cause
    );
  }
  if (property === 'recordTrendingStickerSetFiles') {
    const [stickerSets, cause] = args;
    return canonicalRecordFileSlots(
      {
        scope: { slotKeyPrefix: 'trending.' },
        update: { stickerSetInfos: { sets: rawField(stickerSets, 'sets') } }
      },
      cause
    );
  }
  if (property === 'recordUserFullInfoFiles') {
    const [userId, info, cause] = args;
    return canonicalRecordFileSlots(
      {
        scope: { slotKeyPrefix: 'full_info.' },
        update: { userFullInfo: { info, userId } }
      },
      cause
    );
  }
  return { args: normalize(args), op: `files.${property}` };
}

function canonicalRecordFileSlots(recording: unknown, cause: unknown): unknown {
  return {
    args: [canonicalFileRecording(recording), cause],
    op: 'files.recordFileSlots'
  };
}

function canonicalFileRecording(recording: unknown): unknown {
  return normalize(recording);
}

function canonicalFileSnapshot(snapshot: unknown): unknown {
  const local = objectValue(snapshot, 'local');
  const remote = objectValue(snapshot, 'remote');
  return normalize({
    expectedSize: rawField(snapshot, 'expectedSize') ?? rawField(snapshot, 'expected_size'),
    id: rawField(snapshot, 'id'),
    local: {
      can_be_deleted: rawField(local, 'can_be_deleted'),
      can_be_downloaded: rawField(local, 'can_be_downloaded'),
      download_offset: rawField(local, 'download_offset'),
      downloaded_prefix_size: rawField(local, 'downloaded_prefix_size'),
      downloaded_size: rawField(local, 'downloaded_size'),
      is_downloading_active: rawField(local, 'is_downloading_active'),
      is_downloading_completed: rawField(local, 'is_downloading_completed'),
      path: rawField(local, 'path')
    },
    remote: {
      id: rawField(remote, 'id'),
      is_uploading_active: rawField(remote, 'is_uploading_active'),
      is_uploading_completed: rawField(remote, 'is_uploading_completed'),
      unique_id: rawField(remote, 'unique_id'),
      uploaded_size: rawField(remote, 'uploaded_size')
    },
    size: rawField(snapshot, 'size')
  });
}

function canonicalFileGenerationRequest(request: unknown): unknown {
  return normalize({
    conversion: rawField(request, 'conversion'),
    destinationPath: rawField(request, 'destinationPath') ?? rawField(request, 'destination_path'),
    generationId: rawField(request, 'generationId') ?? rawField(request, 'generation_id'),
    originalPath: rawField(request, 'originalPath') ?? rawField(request, 'original_path')
  });
}

function objectField(value: unknown, key: string): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'object' && field !== null && !Array.isArray(field)
    ? (field as Record<string, unknown>)
    : null;
}

function objectValue(value: unknown, key: string): unknown {
  return objectField({ value }, 'value')?.[key];
}

function rawField(value: unknown, key: string): unknown {
  return objectField({ value }, 'value')?.[key];
}

function stringIdField(value: unknown, key: string): unknown {
  const field = rawField(value, key);
  if (typeof field === 'number' || typeof field === 'bigint') {
    return String(field);
  }
  return field;
}

function databaseProbe(snapshot: Snapshot): unknown {
  const query = (op: string, table?: unknown, payload?: unknown) =>
    queryProbe(snapshot, op, table, payload);
  const database = {
    delete: (table: unknown) => query('delete', table),
    insert: (table: unknown) => query('insert', table),
    select: (selection?: unknown) => query('select', undefined, selection),
    transaction: (callback: (transaction: unknown) => unknown) =>
      Promise.resolve(callback(database)),
    update: (table: unknown) => query('update', table)
  };
  return database;
}

function queryProbe(snapshot: Snapshot, op: string, table?: unknown, payload?: unknown): unknown {
  const state: Record<string, unknown> = {
    op,
    payload: normalize(payload),
    table: tableName(table)
  };
  const recordWrite = (extra: Record<string, unknown>) => {
    snapshot.writes.push(normalize({ ...state, ...extra }));
  };
  const probe = {
    for: () => Promise.resolve(selectedRows()),
    from: (nextTable: unknown) => {
      state.table = tableName(nextTable);
      return probe;
    },
    groupBy: () => probe,
    innerJoin: () => probe,
    leftJoin: () => probe,
    limit: () => Promise.resolve(selectedRows()),
    offset: () => probe,
    onConflictDoNothing: (input?: unknown) => {
      state.conflict = normalize({ input, type: 'nothing' });
      return probe;
    },
    onConflictDoUpdate: (input?: unknown) => {
      state.conflict = normalize({ input, type: 'update' });
      return probe;
    },
    orderBy: () => Promise.resolve([]),
    returning: () => Promise.resolve([{ id: '10', telegramMessageId: '10' }]),
    set: (values: unknown) => {
      recordWrite({ values });
      return probe;
    },
    then: (resolveValue: (value: unknown) => unknown, rejectValue?: (reason: unknown) => unknown) =>
      Promise.resolve(op === 'select' ? selectedRows() : []).then(resolveValue, rejectValue),
    values: (values: unknown) => {
      recordWrite({ values });
      return probe;
    },
    where: (condition?: unknown) => {
      state.where = normalizeSql(condition);
      if (op === 'delete') {
        recordWrite({});
      }
      return probe;
    }
  };
  return probe;
}

function selectedRows(): unknown[] {
  return [
    {
      chatId: '20',
      id: '10',
      reactions: {
        _: 'messageReactions',
        are_tags: false,
        can_get_added_reactions: false,
        paid_reactors: [],
        reactions: []
      }
    }
  ];
}

function sortSnapshot(snapshot: Snapshot): Snapshot {
  return {
    effects: sortItems(snapshot.effects),
    events: sortItems(snapshot.events),
    reads: snapshot.reads,
    writes: uniqueItems(sortItems(snapshot.writes))
  };
}

function sortItems(items: unknown[]): unknown[] {
  return [...items].sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right))
  );
}

function uniqueItems(items: unknown[]): unknown[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function generatedContext(schema: Schema): GeneratedContext {
  const constructorsByName = new Map(
    [...schema.constructors, ...schema.updates].map((item) => [item.name, item])
  );
  const constructorsByResult = new Map<string, ConstructorSchema[]>();
  for (const constructor of schema.constructors) {
    constructorsByResult.set(constructor.resultType, [
      ...(constructorsByResult.get(constructor.resultType) ?? []),
      constructor
    ]);
  }
  return { constructorsByName, constructorsByResult };
}

function generateUpdate(updateType: string, context: GeneratedContext): { _: string } {
  const update = context.constructorsByName.get(updateType);
  if (update === undefined) {
    throw new Error(`Unknown TDLib update constructor ${updateType}`);
  }
  return withUpdateOverrides(updateType, generateConstructor(update, context, 0));
}

function generateConstructor(
  constructor: ConstructorSchema,
  context: GeneratedContext,
  depth: number
): Record<string, unknown> {
  const result: Record<string, unknown> = { _: constructor.name };
  for (const field of constructor.fields) {
    result[field.name] = generateValue(
      field.type,
      context,
      `${constructor.name}.${field.name}`,
      depth + 1
    );
  }
  return result;
}

function generateValue(
  type: string,
  context: GeneratedContext,
  path: string,
  depth: number
): unknown {
  if (depth > 20) {
    return null;
  }
  if (type.startsWith('vector<') && type.endsWith('>')) {
    return [generateValue(type.slice('vector<'.length, -1), context, `${path}[]`, depth + 1)];
  }
  switch (type) {
    case 'Bool':
      return true;
    case 'bytes':
      return 'bytes';
    case 'double':
      return 1.5;
    case 'int32':
    case 'int53':
    case 'int64':
      return numericValue(path);
    case 'string':
      return stringValue(path);
  }
  const direct = context.constructorsByName.get(type);
  if (direct !== undefined) {
    return generateConstructor(direct, context, depth + 1);
  }
  const constructor = selectConstructor(type, context);
  if (constructor === undefined) {
    return null;
  }
  return generateConstructor(constructor, context, depth + 1);
}

function selectConstructor(type: string, context: GeneratedContext): ConstructorSchema | undefined {
  const preferred = preferredConstructors.get(type);
  if (preferred !== undefined) {
    return context.constructorsByName.get(preferred);
  }
  return context.constructorsByResult.get(type)?.[0];
}

function withUpdateOverrides<T extends Record<string, unknown>>(updateType: string, update: T): T {
  update.chat_id = 20;
  update.message_id = 10;
  if (updateType === 'updateDeleteMessages') {
    update.from_cache = false;
    update.is_permanent = true;
    update.message_ids = [10, 11];
  }
  if (updateType === 'updateMessageReaction') {
    update.actor_id = { _: 'messageSenderUser', user_id: 30 };
    update.old_reaction_types = [];
    update.new_reaction_types = [{ _: 'reactionTypeEmoji', emoji: '🔥' }];
  }
  if (
    updateType === 'updateNewMessage' &&
    typeof update.message === 'object' &&
    update.message !== null
  ) {
    Object.assign(update.message, messageFixture());
  }
  return update;
}

function messageFixture(): Record<string, unknown> {
  return {
    _: 'message',
    author_signature: '',
    auto_delete_in: 0,
    can_be_saved: true,
    chat_id: 20,
    contains_unread_mention: false,
    content: {
      _: 'messageText',
      text: {
        _: 'formattedText',
        entities: [],
        text: 'fixture'
      }
    },
    date: 1_710_000_000,
    edit_date: 0,
    id: 10,
    interaction_info: null,
    is_channel_post: false,
    is_from_offline: false,
    is_outgoing: false,
    is_paid_star_suggested_post: false,
    is_paid_ton_suggested_post: false,
    is_pinned: false,
    sender_id: { _: 'messageSenderUser', user_id: 30 },
    unread_reactions: []
  };
}

function numericValue(path: string): number {
  if (path.endsWith('.date') || path.endsWith('_date')) {
    return 1_710_000_000;
  }
  if (path.endsWith('chat_id')) {
    return 20;
  }
  if (path.endsWith('message_id') || path.endsWith('.id')) {
    return 10;
  }
  if (path.endsWith('user_id')) {
    return 30;
  }
  return 1;
}

function stringValue(path: string): string {
  if (path.endsWith('emoji')) {
    return '🔥';
  }
  if (path.endsWith('text')) {
    return 'fixture';
  }
  return path.split('.').at(-1) ?? 'fixture';
}

function tableName(table: unknown): string | null {
  if (table === undefined) {
    return null;
  }
  try {
    return getTableName(table as never);
  } catch {
    return normalizeColumn(table) ?? (typeof table === 'string' ? table : '[table]');
  }
}

function normalize(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  const sqlValue = normalizeSql(value);
  if (sqlValue !== null) {
    return sqlValue;
  }
  const column = normalizeColumn(value);
  if (column !== null) {
    return column;
  }
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key, entry]) => typeof entry !== 'function' && !isDefaultNullField(key, entry))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [
          key,
          isRuntimeTimestampField(key, entry) ? '[runtime-timestamp]' : normalize(entry)
        ])
    );
  }
  return value;
}

function isDefaultNullField(key: string, value: unknown): boolean {
  return key === 'fileSlotsRecordedAt' && value === null;
}

function isRuntimeTimestampField(key: string, value: unknown): boolean {
  return key === 'deletedAt' && (value instanceof Date || typeof value === 'string');
}

function normalizeSql(value: unknown): object | string | null {
  if (typeof value !== 'object' || value === null || !('queryChunks' in value)) {
    return null;
  }
  try {
    return new PgDialect().sqlToQuery(value as SQL);
  } catch {
    return '[sql]';
  }
}

function normalizeColumn(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('name' in value)) {
    return null;
  }
  const name = (value as { name?: unknown }).name;
  return typeof name === 'string' ? name : null;
}

await main();
