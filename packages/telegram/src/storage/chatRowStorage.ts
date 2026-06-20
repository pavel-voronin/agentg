import type { JsonValue } from '@agentg/framework';
import { eq, ilike } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import { telegramChats } from '../database/schema.js';
import { orSql } from './sqlCondition.js';

export type ChatStorageRow = {
  isMarkedAsUnread: boolean | null;
  lastMessageId: string | null;
  lastReadInboxMessageId: string | null;
  lastReadOutboxMessageId: string | null;
  notificationMuteFor: number | null;
  privateUserId: string | null;
  telegramChatId: string;
  title: string;
  type: string;
  unreadCount: number | null;
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

export async function readChatRowById(
  database: Database,
  chatId: string
): Promise<ChatStorageRow | undefined> {
  const [row] = await database
    .select(readChatSelection())
    .from(telegramChats)
    .where(eq(telegramChats.id, chatId))
    .limit(1);
  return row === undefined ? undefined : toChatStorageRow(row);
}

export function toChatStorageRow(row: {
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
}): ChatStorageRow {
  return {
    isMarkedAsUnread: row.isMarkedAsUnread ?? null,
    lastMessageId: row.lastMessageId ?? null,
    lastReadInboxMessageId: row.lastReadInboxMessageId ?? null,
    lastReadOutboxMessageId: row.lastReadOutboxMessageId ?? null,
    notificationMuteFor: notificationMuteFor(row.notificationSettings),
    privateUserId: chatPrivateUserId(row.type),
    telegramChatId: row.telegramChatId ?? row.id ?? '',
    title: row.title ?? '',
    type: telegramChatTypeLabel(row.type),
    unreadCount: row.unreadCount ?? null
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

function telegramChatTypeLabel(value: JsonValue | null): string {
  const type = asPlainRecord(value);
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

function chatPrivateUserId(value: JsonValue | null): string | null {
  const type = asPlainRecord(value);
  const userId = type?.user_id ?? type?.userId;
  return stringifyTelegramId(userId) ?? null;
}

function notificationMuteFor(value: JsonValue | null | undefined): number | null {
  const settings = asPlainRecord(value);
  const muteFor = settings?.mute_for ?? settings?.muteFor;
  return typeof muteFor === 'number' && Number.isSafeInteger(muteFor) && muteFor >= 0
    ? muteFor
    : null;
}
