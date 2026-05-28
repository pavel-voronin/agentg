import type { JsonObject, JsonValue } from '@agentg/events/json';
import { ilike } from 'drizzle-orm';

import { telegramChats } from '../schema.js';
import { orSql } from './sql.js';

export type TelegramChatStorageRow = {
  chat: JsonObject;
  lastMessageId: string | null;
  telegramChatId: string;
  title: string;
  type: string;
};

export function readChatSelection() {
  return {
    isMarkedAsUnread: telegramChats.isMarkedAsUnread,
    lastMessageId: telegramChats.lastMessageId,
    lastReadInboxMessageId: telegramChats.lastReadInboxMessageId,
    lastReadOutboxMessageId: telegramChats.lastReadOutboxMessageId,
    notificationSettings: telegramChats.notificationSettings,
    telegramChatId: telegramChats.id,
    title: telegramChats.title,
    type: telegramChats.type,
    unreadCount: telegramChats.unreadCount
  };
}

export function chatSearchWhere(value: string) {
  return orSql(ilike(telegramChats.title, `%${value}%`), ilike(telegramChats.id, `%${value}%`));
}

export function toTelegramChatStorageRow(row: {
  id?: string | null;
  isMarkedAsUnread?: boolean | null;
  lastMessageId?: string | null;
  lastReadInboxMessageId?: string | null;
  lastReadOutboxMessageId?: string | null;
  notificationSettings?: JsonValue | null;
  telegramChatId?: string | null;
  title: string | null;
  type: JsonValue | null;
  unreadCount?: number | null;
}): TelegramChatStorageRow {
  const chat: JsonObject = {};
  assignJsonField(chat, 'type', row.type);
  assignJsonField(chat, 'notification_settings', row.notificationSettings);
  assignScalarField(chat, 'is_marked_as_unread', row.isMarkedAsUnread);
  assignScalarField(chat, 'last_message_id', row.lastMessageId);
  assignScalarField(chat, 'last_read_inbox_message_id', row.lastReadInboxMessageId);
  assignScalarField(chat, 'last_read_outbox_message_id', row.lastReadOutboxMessageId);
  assignScalarField(chat, 'unread_count', row.unreadCount);

  return {
    chat,
    lastMessageId: row.lastMessageId ?? null,
    telegramChatId: row.telegramChatId ?? row.id ?? '',
    title: row.title ?? '',
    type: telegramChatTypeLabel(row.type, chat)
  };
}

export function asPlainRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function stringifyTelegramId(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return String(value);
  }
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return undefined;
}

export function parsePositiveBigInt(value: unknown): bigint | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return BigInt(value);
  }

  if (typeof value === 'string' && /^[0-9]+$/.test(value)) {
    const parsed = BigInt(value);
    return parsed > 0n ? parsed : undefined;
  }

  return undefined;
}

export function parseNonNegativeBigInt(value: unknown): bigint | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return BigInt(value);
  }

  if (typeof value === 'string' && /^[0-9]+$/.test(value)) {
    return BigInt(value);
  }

  return undefined;
}

function telegramChatTypeLabel(value: JsonValue | null, chat: JsonObject): string {
  const type = asPlainRecord(value) ?? asPlainRecord(chat.type);
  if (type?._ === 'chatTypePrivate') {
    return 'private';
  }
  if (type?._ === 'chatTypeSecret') {
    return 'secret';
  }
  if (type?._ === 'chatTypeBasicGroup') {
    return 'group';
  }
  if (type?._ === 'chatTypeSupergroup') {
    return type.is_channel === true || type.isChannel === true ? 'channel' : 'group';
  }
  return typeof type?._ === 'string' ? type._ : 'unknown';
}

function assignJsonField(target: JsonObject, key: string, value: JsonValue | null | undefined) {
  if (value !== null && value !== undefined) {
    target[key] = value;
  }
}

function assignScalarField(
  target: JsonObject,
  key: string,
  value: boolean | number | string | null | undefined
) {
  if (value !== null && value !== undefined) {
    target[key] = value;
  }
}
