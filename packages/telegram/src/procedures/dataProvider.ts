import { asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import {
  datasetSchema,
  expandInputSchema,
  getInputSchema,
  renderInputSchema,
  selectInputSchema,
  type Dataset,
  type DatasetRow,
  type ModelRef
} from '@agentg/data';
import { toJsonValue, type JsonValue } from '@agentg/framework';
import { z } from 'zod';

import { telegramUsers } from '../database/schema.js';
import type { Chat } from '../domain/models/chat.js';
import type { Message } from '../domain/models/message.js';
import { chatRef, messageModelParts, messageRef, userRef } from '../model/refs.js';
import { createRepositories } from '../repositories/repositories.js';
import { andSql } from '../storage/sqlCondition.js';
import type { ProcedureResources } from './resources.js';

type SortInput = Readonly<{
  direction: 'asc' | 'desc';
  key: string;
}>;

const intTextSchema = z
  .string()
  .trim()
  .regex(/^-?\d+$/);
const querySchema = z.string().trim().min(1);

const chatWhereSchema = z
  .object({
    chatIdsGt: intTextSchema.optional(),
    chatIdsGte: intTextSchema.optional(),
    chatIdsLt: intTextSchema.optional(),
    chatIdsLte: intTextSchema.optional(),
    chatIds: z.array(z.string().trim().min(1)).optional(),
    folderId: z.number().int().nonnegative().optional(),
    pinned: z.boolean().optional(),
    readState: z.enum(['read', 'unread']).optional(),
    titleQueryNot: querySchema.optional(),
    titleQuery: querySchema.optional(),
    unreadCount: z.number().int().nonnegative().optional(),
    unreadCountGt: z.number().int().nonnegative().optional(),
    unreadCountGte: z.number().int().nonnegative().optional(),
    unreadCountLt: z.number().int().nonnegative().optional(),
    unreadCountLte: z.number().int().nonnegative().optional(),
    type: z.string().trim().min(1).optional()
  })
  .strict();

const messageWhereSchema = z
  .object({
    chatId: z.string().trim().min(1).optional(),
    chatIdGt: intTextSchema.optional(),
    chatIdGte: intTextSchema.optional(),
    chatIdLt: intTextSchema.optional(),
    chatIdLte: intTextSchema.optional(),
    contentType: querySchema.optional(),
    endAt: z.iso.datetime().optional(),
    messageDateGt: z.iso.datetime().optional(),
    messageDateGte: z.iso.datetime().optional(),
    messageDateLt: z.iso.datetime().optional(),
    messageDateLte: z.iso.datetime().optional(),
    messageId: intTextSchema.optional(),
    messageIdGt: intTextSchema.optional(),
    messageIdGte: intTextSchema.optional(),
    messageIdLt: intTextSchema.optional(),
    messageIdLte: intTextSchema.optional(),
    messageIds: z.array(z.string().trim().min(1)).optional(),
    readState: z.enum(['read', 'unread']).optional(),
    senderQueryNot: querySchema.optional(),
    senderQuery: querySchema.optional(),
    startAt: z.iso.datetime().optional(),
    textQueryNot: querySchema.optional(),
    textQuery: querySchema.optional()
  })
  .strict();

const userWhereSchema = z
  .object({
    displayNameQueryNot: querySchema.optional(),
    displayNameQuery: querySchema.optional(),
    firstNameQueryNot: querySchema.optional(),
    firstNameQuery: querySchema.optional(),
    lastNameQueryNot: querySchema.optional(),
    lastNameQuery: querySchema.optional(),
    userIds: z.array(z.string().trim().min(1)).optional(),
    userIdsGt: intTextSchema.optional(),
    userIdsGte: intTextSchema.optional(),
    userIdsLt: intTextSchema.optional(),
    userIdsLte: intTextSchema.optional()
  })
  .strict();

export function dataSelectProcedure(resources: ProcedureResources) {
  return async (rawInput: unknown): Promise<Dataset> => {
    const input = selectInputSchema.parse(rawInput);
    const repositories = createRepositories(resources.database);
    switch (input.model) {
      case 'telegram.chat': {
        const where = chatWhereSchema.parse(input.where ?? {});
        const order = chatOrder(input.sort);
        if (where.chatIds?.length === 0) {
          return { rows: [] };
        }
        const chats = await repositories.chats.list({
          chatIds: where.chatIds,
          chatIdGt: where.chatIdsGt,
          chatIdGte: where.chatIdsGte,
          chatIdLt: where.chatIdsLt,
          chatIdLte: where.chatIdsLte,
          folderId: where.folderId,
          limit: input.limit,
          offset: input.offset,
          ...(order === undefined ? {} : { order }),
          pinned: where.pinned,
          readState: where.readState,
          titleQueryNot: where.titleQueryNot,
          titleQuery: where.titleQuery,
          unreadCount: where.unreadCount,
          unreadCountGt: where.unreadCountGt,
          unreadCountGte: where.unreadCountGte,
          unreadCountLt: where.unreadCountLt,
          unreadCountLte: where.unreadCountLte,
          type: where.type
        });
        return datasetSchema.parse({
          rows: chats.map((item) =>
            chatRow(item.chat, {
              isMarkedAsUnread: item.isMarkedAsUnread,
              placements: toJsonValue(item.placements),
              unreadCount: item.unreadCount
            })
          )
        });
      }
      case 'telegram.message': {
        const where = messageWhereSchema.parse(input.where ?? {});
        const order = messageOrder(input.sort);
        const rows = await selectMessages(resources, {
          chatId: where.chatId,
          chatIdGt: where.chatIdGt,
          chatIdGte: where.chatIdGte,
          chatIdLt: where.chatIdLt,
          chatIdLte: where.chatIdLte,
          contentType: where.contentType,
          endAt: where.endAt,
          limit: input.limit ?? 50,
          messageDateGt: where.messageDateGt,
          messageDateGte: where.messageDateGte,
          messageDateLt: where.messageDateLt,
          messageDateLte: where.messageDateLte,
          messageId: where.messageId,
          messageIdGt: where.messageIdGt,
          messageIdGte: where.messageIdGte,
          messageIdLt: where.messageIdLt,
          messageIdLte: where.messageIdLte,
          messageIds: where.messageIds,
          offset: input.offset,
          ...(order === undefined ? {} : { order }),
          readState: where.readState,
          senderQueryNot: where.senderQueryNot,
          senderQuery: where.senderQuery,
          textQueryNot: where.textQueryNot,
          textQuery: where.textQuery,
          startAt: where.startAt
        });
        return datasetSchema.parse({
          rows
        });
      }
      case 'telegram.user': {
        const where = userWhereSchema.parse(input.where ?? {});
        const order = userOrder(input.sort);
        return datasetSchema.parse({
          rows: await selectUsers(resources, {
            displayNameQueryNot: where.displayNameQueryNot,
            displayNameQuery: where.displayNameQuery,
            firstNameQueryNot: where.firstNameQueryNot,
            firstNameQuery: where.firstNameQuery,
            lastNameQueryNot: where.lastNameQueryNot,
            lastNameQuery: where.lastNameQuery,
            limit: input.limit,
            offset: input.offset,
            ...(order === undefined ? {} : { order }),
            userIdGt: where.userIdsGt,
            userIdGte: where.userIdsGte,
            userIdLt: where.userIdsLt,
            userIdLte: where.userIdsLte,
            userIds: where.userIds
          })
        });
      }
      default:
        throw new Error(`Telegram data provider does not support model: ${input.model}`);
    }
  };
}

export function dataGetProcedure(resources: ProcedureResources) {
  return async (rawInput: unknown): Promise<DatasetRow | null> => {
    const input = getInputSchema.parse(rawInput);
    const repositories = createRepositories(resources.database);
    switch (input.ref._model) {
      case 'telegram.chat': {
        const [item] = await repositories.chats.list({
          chatIds: [input.ref.id],
          limit: 1
        });
        return item === undefined
          ? null
          : chatRow(item.chat, {
              isMarkedAsUnread: item.isMarkedAsUnread,
              placements: toJsonValue(item.placements),
              unreadCount: item.unreadCount
            });
      }
      case 'telegram.message': {
        const parts = messageModelParts(input.ref.id);
        if (parts === null) {
          return null;
        }
        const message = await repositories.messages.read(parts);
        return message === null ? null : messageRow(message, [message.chat]);
      }
      case 'telegram.user':
        return readUser(resources, input.ref.id);
      default:
        throw new Error(`Telegram data provider does not support model: ${input.ref._model}`);
    }
  };
}

export function dataExpandProcedure(resources: ProcedureResources) {
  return async (rawInput: unknown): Promise<Dataset> => {
    const input = expandInputSchema.parse(rawInput);
    if (input.relation !== 'messages') {
      throw new Error(`Telegram data provider does not support relation: ${input.relation}`);
    }
    const where = messageWhereSchema.parse(input.where ?? {});
    const repositories = createRepositories(resources.database);
    const output: DatasetRow[] = [];
    for (const row of input.from) {
      const ref = row.refs[input.sourceRef];
      if (ref === undefined) {
        throw new Error(`Dataset row is missing source ref: ${input.sourceRef}`);
      }
      if (ref._model !== 'telegram.chat') {
        throw new Error(`Telegram messages expansion requires telegram.chat source refs`);
      }
      const messages = await repositories.messages.list({
        chatId: ref.id,
        contentType: where.contentType,
        endAt: where.endAt,
        limit: input.limit ?? 50,
        messageDateGt: where.messageDateGt,
        messageDateGte: where.messageDateGte,
        messageDateLt: where.messageDateLt,
        messageDateLte: where.messageDateLte,
        messageId: where.messageId,
        messageIdGt: where.messageIdGt,
        messageIdGte: where.messageIdGte,
        messageIdLt: where.messageIdLt,
        messageIdLte: where.messageIdLte,
        messageIds: where.messageIds,
        readState: where.readState,
        senderQueryNot: where.senderQueryNot,
        senderQuery: where.senderQuery,
        textQueryNot: where.textQueryNot,
        textQuery: where.textQuery,
        startAt: where.startAt
      });
      output.push(...messages.map((message) => messageRow(message, [...row.lineage, ref])));
    }
    return datasetSchema.parse({
      rows: output
    });
  };
}

export function dataRenderProcedure() {
  return (rawInput: unknown): Dataset => {
    const input = renderInputSchema.parse(rawInput);
    const rows = input.from;
    if (rows.length === 0) {
      return { rows: [] };
    }
    for (const row of rows) {
      const ref = row.refs[input.sourceRef];
      if (ref === undefined) {
        throw new Error(`Dataset row is missing source ref: ${input.sourceRef}`);
      }
      if (ref._model !== 'telegram.message') {
        throw new Error('Telegram render requires telegram.message source refs');
      }
    }
    const groupByRef = renderGroupByRef(input.options);
    if (groupByRef !== undefined) {
      return renderGrouped(rows, groupByRef, input.format);
    }
    return renderSingle(rows, input.format);
  };
}

async function selectMessages(
  resources: ProcedureResources,
  input: {
    chatId?: string | undefined;
    chatIdGt?: string | undefined;
    chatIdGte?: string | undefined;
    chatIdLt?: string | undefined;
    chatIdLte?: string | undefined;
    contentType?: string | undefined;
    endAt?: string | undefined;
    limit: number;
    messageDateGt?: string | undefined;
    messageDateGte?: string | undefined;
    messageDateLt?: string | undefined;
    messageDateLte?: string | undefined;
    messageId?: string | undefined;
    messageIdGt?: string | undefined;
    messageIdGte?: string | undefined;
    messageIdLt?: string | undefined;
    messageIdLte?: string | undefined;
    messageIds?: readonly string[] | undefined;
    offset?: number | undefined;
    order?: { direction: 'asc' | 'desc'; key: 'date' | 'id' | 'text' } | undefined;
    readState?: 'read' | 'unread' | undefined;
    senderQueryNot?: string | undefined;
    senderQuery?: string | undefined;
    startAt?: string | undefined;
    textQueryNot?: string | undefined;
    textQuery?: string | undefined;
  }
): Promise<DatasetRow[]> {
  if (input.messageIds !== undefined && input.chatId === undefined) {
    throw new Error('Telegram messageIds filter requires chatId');
  }
  const repositories = createRepositories(resources.database);
  const messages = await repositories.messages.list({
    chatId: input.chatId,
    chatIdGt: input.chatIdGt,
    chatIdGte: input.chatIdGte,
    chatIdLt: input.chatIdLt,
    chatIdLte: input.chatIdLte,
    contentType: input.contentType,
    endAt: input.endAt,
    limit: input.limit,
    messageDateGt: input.messageDateGt,
    messageDateGte: input.messageDateGte,
    messageDateLt: input.messageDateLt,
    messageDateLte: input.messageDateLte,
    messageId: input.messageId,
    messageIdGt: input.messageIdGt,
    messageIdGte: input.messageIdGte,
    messageIdLt: input.messageIdLt,
    messageIdLte: input.messageIdLte,
    messageIds: input.messageIds,
    offset: input.offset,
    ...(input.order === undefined ? {} : { order: input.order }),
    readState: input.readState,
    senderQueryNot: input.senderQueryNot,
    senderQuery: input.senderQuery,
    textQueryNot: input.textQueryNot,
    textQuery: input.textQuery,
    startAt: input.startAt
  });
  return messages.map((message) => messageRow(message, [message.chat]));
}

async function selectUsers(
  resources: ProcedureResources,
  input: {
    displayNameQueryNot?: string | undefined;
    displayNameQuery?: string | undefined;
    firstNameQueryNot?: string | undefined;
    firstNameQuery?: string | undefined;
    lastNameQueryNot?: string | undefined;
    lastNameQuery?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
    order?: { direction: 'asc' | 'desc'; key: 'displayName' | 'id' } | undefined;
    userIdGt?: string | undefined;
    userIdGte?: string | undefined;
    userIdLt?: string | undefined;
    userIdLte?: string | undefined;
    userIds?: readonly string[] | undefined;
  }
): Promise<DatasetRow[]> {
  if (canReadUsersByIds(input)) {
    const rows: DatasetRow[] = [];
    const offset = input.offset ?? 0;
    const limit = input.limit ?? input.userIds.length;
    for (const userId of input.userIds.slice(offset, offset + limit)) {
      const row = await readUser(resources, userId);
      if (row !== null) {
        rows.push(row);
      }
    }
    return rows;
  }
  const rows = await resources.database
    .select({
      firstName: telegramUsers.firstName,
      id: telegramUsers.id,
      lastName: telegramUsers.lastName
    })
    .from(telegramUsers)
    .where(userWhere(input))
    .orderBy(...userOrderBy(input.order))
    .limit(input.limit ?? 50)
    .offset(input.offset ?? 0);
  return rows.map((row) =>
    userRow({
      firstName: row.firstName,
      id: row.id,
      lastName: row.lastName
    })
  );
}

function canReadUsersByIds(input: {
  displayNameQueryNot?: string | undefined;
  displayNameQuery?: string | undefined;
  firstNameQueryNot?: string | undefined;
  firstNameQuery?: string | undefined;
  lastNameQueryNot?: string | undefined;
  lastNameQuery?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
  order?: { direction: 'asc' | 'desc'; key: 'displayName' | 'id' } | undefined;
  userIdGt?: string | undefined;
  userIdGte?: string | undefined;
  userIdLt?: string | undefined;
  userIdLte?: string | undefined;
  userIds?: readonly string[] | undefined;
}): input is typeof input & { userIds: readonly string[] } {
  return (
    input.userIds !== undefined &&
    input.order === undefined &&
    input.userIdGt === undefined &&
    input.userIdGte === undefined &&
    input.userIdLt === undefined &&
    input.userIdLte === undefined &&
    input.displayNameQueryNot === undefined &&
    input.displayNameQuery === undefined &&
    input.firstNameQueryNot === undefined &&
    input.firstNameQuery === undefined &&
    input.lastNameQueryNot === undefined &&
    input.lastNameQuery === undefined
  );
}

function userWhere(input: {
  displayNameQueryNot?: string | undefined;
  displayNameQuery?: string | undefined;
  firstNameQueryNot?: string | undefined;
  firstNameQuery?: string | undefined;
  lastNameQueryNot?: string | undefined;
  lastNameQuery?: string | undefined;
  userIdGt?: string | undefined;
  userIdGte?: string | undefined;
  userIdLt?: string | undefined;
  userIdLte?: string | undefined;
  userIds?: readonly string[] | undefined;
}): SQL | undefined {
  return andSql(
    input.userIds === undefined ? undefined : inArray(telegramUsers.id, [...input.userIds]),
    input.userIdGte === undefined
      ? undefined
      : sql`${telegramUsers.id}::bigint >= ${input.userIdGte}::bigint`,
    input.userIdGt === undefined
      ? undefined
      : sql`${telegramUsers.id}::bigint > ${input.userIdGt}::bigint`,
    input.userIdLte === undefined
      ? undefined
      : sql`${telegramUsers.id}::bigint <= ${input.userIdLte}::bigint`,
    input.userIdLt === undefined
      ? undefined
      : sql`${telegramUsers.id}::bigint < ${input.userIdLt}::bigint`,
    input.displayNameQuery === undefined
      ? undefined
      : textQueryWhere(
          sql`coalesce(${telegramUsers.firstName}, '') || ' ' || coalesce(${telegramUsers.lastName}, '')`,
          input.displayNameQuery
        ),
    input.displayNameQueryNot === undefined
      ? undefined
      : notTextQueryWhere(
          sql`coalesce(${telegramUsers.firstName}, '') || ' ' || coalesce(${telegramUsers.lastName}, '')`,
          input.displayNameQueryNot
        ),
    input.firstNameQuery === undefined
      ? undefined
      : textQueryWhere(sql`coalesce(${telegramUsers.firstName}, '')`, input.firstNameQuery),
    input.firstNameQueryNot === undefined
      ? undefined
      : notTextQueryWhere(sql`coalesce(${telegramUsers.firstName}, '')`, input.firstNameQueryNot),
    input.lastNameQuery === undefined
      ? undefined
      : textQueryWhere(sql`coalesce(${telegramUsers.lastName}, '')`, input.lastNameQuery),
    input.lastNameQueryNot === undefined
      ? undefined
      : notTextQueryWhere(sql`coalesce(${telegramUsers.lastName}, '')`, input.lastNameQueryNot)
  );
}

function chatOrder(
  sort: SortInput | undefined
): { direction: 'asc' | 'desc'; key: 'id' | 'title' } | undefined {
  if (sort === undefined) {
    return undefined;
  }
  switch (sort.key) {
    case 'id':
    case 'primaryRef':
    case 'row':
      return { direction: sort.direction, key: 'id' };
    case 'title':
      return { direction: sort.direction, key: 'title' };
    default:
      throw new Error(`Telegram chat sort is not supported: ${sort.key}`);
  }
}

function messageOrder(
  sort: SortInput | undefined
): { direction: 'asc' | 'desc'; key: 'date' | 'id' | 'text' } | undefined {
  if (sort === undefined) {
    return undefined;
  }
  switch (sort.key) {
    case 'telegramMessageId':
    case 'primaryRef':
    case 'row':
      return { direction: sort.direction, key: 'id' };
    case 'messageDate':
      return { direction: sort.direction, key: 'date' };
    case 'text':
      return { direction: sort.direction, key: 'text' };
    default:
      throw new Error(`Telegram message sort is not supported: ${sort.key}`);
  }
}

function userOrder(
  sort: SortInput | undefined
): { direction: 'asc' | 'desc'; key: 'displayName' | 'id' } | undefined {
  if (sort === undefined) {
    return undefined;
  }
  switch (sort.key) {
    case 'id':
    case 'primaryRef':
    case 'row':
      return { direction: sort.direction, key: 'id' };
    case 'displayName':
      return { direction: sort.direction, key: 'displayName' };
    default:
      throw new Error(`Telegram user sort is not supported: ${sort.key}`);
  }
}

function userOrderBy(
  order: { direction: 'asc' | 'desc'; key: 'displayName' | 'id' } | undefined
): SQL[] {
  if (order === undefined) {
    return [asc(telegramUsers.id)];
  }
  switch (order.key) {
    case 'displayName':
      return [
        ordered(
          sql`coalesce(${telegramUsers.firstName}, '') || ' ' || coalesce(${telegramUsers.lastName}, '')`,
          order.direction
        ),
        asc(telegramUsers.id)
      ];
    case 'id':
      return [ordered(telegramUsers.id, order.direction)];
  }
}

function ordered(expression: Parameters<typeof asc>[0], direction: 'asc' | 'desc'): SQL {
  return direction === 'asc' ? asc(expression) : desc(expression);
}

function textQueryWhere(expression: SQL, query: string): SQL | undefined {
  const patterns = wildcardPatterns(query);
  return andSql(...patterns.map((pattern) => sql`${expression} ilike ${pattern} escape '\\'`));
}

function notTextQueryWhere(expression: SQL, query: string): SQL | undefined {
  const condition = textQueryWhere(expression, query);
  return condition === undefined ? undefined : sql`not (${condition})`;
}

function wildcardPatterns(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token) => `%${token.replace(/[\\%_]/g, '\\$&').replace(/\*/g, '%')}%`);
}

async function readUser(resources: ProcedureResources, id: string): Promise<DatasetRow | null> {
  const [row] = await resources.database
    .select({
      firstName: telegramUsers.firstName,
      id: telegramUsers.id,
      lastName: telegramUsers.lastName
    })
    .from(telegramUsers)
    .where(eq(telegramUsers.id, id))
    .limit(1);
  return row === undefined
    ? null
    : userRow({
        firstName: row.firstName,
        id: row.id,
        lastName: row.lastName
      });
}

function chatRow(
  chat: Chat,
  metadata: {
    isMarkedAsUnread: boolean | null;
    placements: JsonValue;
    unreadCount: number | null;
  }
): DatasetRow {
  const ref = chatRef(chat.id);
  return {
    lineage: [ref],
    refs: {
      chat: ref
    },
    value: toJsonValue({
      ...chat,
      isMarkedAsUnread: metadata.isMarkedAsUnread,
      placements: metadata.placements,
      unreadCount: metadata.unreadCount
    })
  };
}

function messageRow(message: Message, lineage: readonly ModelRef[]): DatasetRow {
  const ref = messageRef({
    chatId: message.chat.id,
    messageId: message.telegramMessageId
  });
  return {
    lineage: dedupeRefs([...lineage, ref]),
    refs: {
      chat: message.chat,
      message: ref
    },
    value: toJsonValue(message)
  };
}

function userRow(user: {
  firstName: string | null;
  id: string;
  lastName: string | null;
}): DatasetRow {
  const ref = userRef(user.id);
  return {
    lineage: [ref],
    refs: {
      user: ref
    },
    value: toJsonValue({
      _model: 'telegram.user',
      displayName: userDisplayName(user),
      firstName: user.firstName,
      id: user.id,
      lastName: user.lastName
    })
  };
}

function renderGroupByRef(options: JsonValue | undefined): string | undefined {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    return undefined;
  }
  const value = options.groupByRef;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function renderGrouped(
  rows: readonly DatasetRow[],
  groupByRef: string,
  format: 'json' | 'text'
): Dataset {
  const groups = new Map<string, DatasetRow[]>();
  for (const row of rows) {
    const ref = row.refs[groupByRef];
    if (ref === undefined) {
      throw new Error(`Dataset row is missing groupByRef: ${groupByRef}`);
    }
    const key = refKey(ref);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return datasetSchema.parse({
    rows: [...groups.values()].map((group) => {
      const first = group[0];
      if (first === undefined) {
        throw new Error('Render group is empty');
      }
      const ref = first.refs[groupByRef];
      if (ref === undefined) {
        throw new Error(`Dataset row is missing groupByRef: ${groupByRef}`);
      }
      return {
        lineage: dedupeRefs(group.flatMap((row) => row.lineage)),
        refs: {
          [groupByRef]: ref
        },
        value: renderedValue(group, format)
      };
    })
  });
}

function renderSingle(rows: readonly DatasetRow[], format: 'json' | 'text'): Dataset {
  const refs = uniqueRefs(rows);
  for (const [key, values] of refs) {
    if (values.size > 1) {
      throw new Error(`Telegram render is ambiguous for ref key: ${key}`);
    }
  }
  return datasetSchema.parse({
    rows: [
      {
        lineage: dedupeRefs(rows.flatMap((row) => row.lineage)),
        refs: Object.fromEntries(
          [...refs.entries()].map(([key, values]) => [key, refFromKey([...values][0] ?? '')])
        ),
        value: renderedValue(rows, format)
      }
    ]
  });
}

function renderedValue(rows: readonly DatasetRow[], format: 'json' | 'text'): JsonValue {
  if (format === 'json') {
    return rows.map((row) => row.value);
  }
  return rows.map(renderMessageLine).join('\n');
}

function renderMessageLine(row: DatasetRow): string {
  const value = row.value;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return JSON.stringify(value);
  }
  const date = typeof value.messageDate === 'string' ? value.messageDate : '';
  const sender = typeof value.senderDisplayName === 'string' ? value.senderDisplayName : 'Unknown';
  const text =
    typeof value.text === 'string' && value.text.length > 0
      ? value.text
      : typeof value.contentType === 'string'
        ? value.contentType
        : '';
  return [date, sender, text]
    .filter((part) => typeof part === 'string' && part.length > 0)
    .join(' ');
}

function uniqueRefs(rows: readonly DatasetRow[]): Map<string, Set<string>> {
  const output = new Map<string, Set<string>>();
  for (const row of rows) {
    for (const [key, ref] of Object.entries(row.refs)) {
      const values = output.get(key) ?? new Set<string>();
      values.add(refKey(ref));
      output.set(key, values);
    }
  }
  return output;
}

function dedupeRefs(refs: readonly ModelRef[]): ModelRef[] {
  const output = new Map<string, ModelRef>();
  for (const ref of refs) {
    output.set(refKey(ref), ref);
  }
  return [...output.values()];
}

function refKey(ref: ModelRef): string {
  return `${ref._model}:${ref.id}`;
}

function refFromKey(key: string): ModelRef {
  const separator = key.indexOf(':');
  if (separator <= 0) {
    throw new Error(`Model ref key is invalid: ${key}`);
  }
  return {
    _model: key.slice(0, separator),
    id: key.slice(separator + 1)
  };
}

function userDisplayName(user: {
  firstName: string | null;
  id: string;
  lastName: string | null;
}): string {
  const name = [user.firstName, user.lastName]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ');
  return name.length > 0 ? name : user.id;
}
