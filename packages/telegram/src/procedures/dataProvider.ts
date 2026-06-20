import { eq } from 'drizzle-orm';
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
import type { ProcedureResources } from './resources.js';

const chatWhereSchema = z
  .object({
    chatIds: z.array(z.string().trim().min(1)).optional(),
    folderId: z.number().int().nonnegative().optional(),
    pinned: z.boolean().optional(),
    readState: z.enum(['read', 'unread']).optional(),
    type: z.string().trim().min(1).optional()
  })
  .strict();

const messageWhereSchema = z
  .object({
    chatId: z.string().trim().min(1).optional(),
    endAt: z.iso.datetime().optional(),
    messageIds: z.array(z.string().trim().min(1)).optional(),
    readState: z.enum(['read', 'unread']).optional(),
    startAt: z.iso.datetime().optional()
  })
  .strict();

const userWhereSchema = z
  .object({
    userIds: z.array(z.string().trim().min(1)).optional()
  })
  .strict();

export function dataSelectProcedure(resources: ProcedureResources) {
  return async (rawInput: unknown): Promise<Dataset> => {
    const input = selectInputSchema.parse(rawInput);
    const repositories = createRepositories(resources.database);
    switch (input.model) {
      case 'telegram.chat': {
        const where = chatWhereSchema.parse(input.where ?? {});
        if (where.chatIds?.length === 0) {
          return { rows: [] };
        }
        const chats = await repositories.chats.list({
          chatIds: where.chatIds,
          folderId: where.folderId,
          limit: input.limit,
          pinned: where.pinned,
          readState: where.readState,
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
        const rows = await selectMessages(resources, {
          chatId: where.chatId,
          endAt: where.endAt,
          limit: input.limit ?? 50,
          messageIds: where.messageIds,
          readState: where.readState,
          startAt: where.startAt
        });
        return datasetSchema.parse({
          rows
        });
      }
      case 'telegram.user': {
        const where = userWhereSchema.parse(input.where ?? {});
        return datasetSchema.parse({
          rows: await selectUsers(resources, {
            limit: input.limit,
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
        endAt: where.endAt,
        limit: input.limit ?? 50,
        messageIds: where.messageIds,
        readState: where.readState,
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
    endAt?: string | undefined;
    limit: number;
    messageIds?: readonly string[] | undefined;
    readState?: 'read' | 'unread' | undefined;
    startAt?: string | undefined;
  }
): Promise<DatasetRow[]> {
  if (input.messageIds !== undefined && input.chatId === undefined) {
    throw new Error('Telegram messageIds filter requires chatId');
  }
  const repositories = createRepositories(resources.database);
  const messages = await repositories.messages.list({
    chatId: input.chatId,
    endAt: input.endAt,
    limit: input.limit,
    messageIds: input.messageIds,
    readState: input.readState,
    startAt: input.startAt
  });
  return messages.map((message) => messageRow(message, [message.chat]));
}

async function selectUsers(
  resources: ProcedureResources,
  input: {
    limit?: number | undefined;
    userIds?: readonly string[] | undefined;
  }
): Promise<DatasetRow[]> {
  if (input.userIds !== undefined) {
    const rows: DatasetRow[] = [];
    for (const userId of input.userIds.slice(0, input.limit)) {
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
    .limit(input.limit ?? 50);
  return rows.map((row) =>
    userRow({
      firstName: row.firstName,
      id: row.id,
      lastName: row.lastName
    })
  );
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
