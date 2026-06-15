import type { JsonValue } from '@agentg/framework';

import type { Database } from '../database/client.js';
import { telegramTextCompositionStyles } from '../database/schema.js';
import { tdJsonValue } from '../tdlib/shape.js';

type TextCompositionStyleRuntimeRecord = Record<string, unknown> & {
  readonly creator_user_id?: unknown;
  readonly custom_emoji_id?: unknown;
  readonly english_example?: unknown;
  readonly install_count?: unknown;
  readonly is_creator?: unknown;
  readonly is_custom?: unknown;
  readonly name?: unknown;
  readonly prompt?: unknown;
  readonly title?: unknown;
};

export async function replaceTextCompositionStyles(
  database: Database,
  styles: readonly unknown[]
): Promise<void> {
  const rows = styles.map(textCompositionStyleRow);

  await database.transaction(async (transaction) => {
    await transaction.delete(telegramTextCompositionStyles);

    if (rows.length > 0) {
      await transaction.insert(telegramTextCompositionStyles).values(rows);
    }
  });
}

function textCompositionStyleRow(
  style: unknown
): typeof telegramTextCompositionStyles.$inferInsert {
  const record = textCompositionStyleRecord(style);

  return {
    creatorUserId: nullableIdField(record, 'creator_user_id'),
    customEmojiId: nullableIdField(record, 'custom_emoji_id'),
    englishExample: nullableJsonField(record, 'english_example'),
    installCount: nullableIntegerField(record, 'install_count'),
    isCreator: booleanFlagField(record, 'is_creator'),
    isCustom: booleanFlagField(record, 'is_custom'),
    name: requiredStringField(record, 'name'),
    prompt: nullableStringField(record, 'prompt'),
    title: requiredStringField(record, 'title')
  };
}

function textCompositionStyleRecord(style: unknown): TextCompositionStyleRuntimeRecord {
  if (typeof style !== 'object' || style === null || Array.isArray(style)) {
    throw new Error('Expected textCompositionStyle runtime object');
  }

  return style as TextCompositionStyleRuntimeRecord;
}

function requiredStringField(record: TextCompositionStyleRuntimeRecord, field: string): string {
  const value = record[field];
  if (typeof value !== 'string') {
    throw new Error(`Expected textCompositionStyle.${field} to be a string`);
  }
  return value;
}

function nullableStringField(
  record: TextCompositionStyleRuntimeRecord,
  field: string
): string | null {
  const value = record[field];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error(`Expected textCompositionStyle.${field} to be a string or null`);
  }
  return value;
}

function booleanFlagField(record: TextCompositionStyleRuntimeRecord, field: string): boolean {
  const value = record[field];
  if (value === undefined || value === null || value === false || value === 0 || value === '0') {
    return false;
  }
  if (value === true || value === 1 || value === '1') {
    return true;
  }
  throw new Error(`Expected textCompositionStyle.${field} to be a boolean flag`);
}

function nullableIntegerField(
  record: TextCompositionStyleRuntimeRecord,
  field: string
): number | null {
  const value = record[field];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`Expected textCompositionStyle.${field} to be an integer or null`);
  }
  return value;
}

function nullableIdField(record: TextCompositionStyleRuntimeRecord, field: string): string | null {
  const value = record[field];
  if (value === undefined || value === null || value === 0 || value === '0') {
    return null;
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`Expected textCompositionStyle.${field} to be an ID or null`);
  }
  return String(value);
}

function nullableJsonField(
  record: TextCompositionStyleRuntimeRecord,
  field: string
): JsonValue | null {
  const value = record[field];
  if (value === undefined || value === null) {
    return null;
  }
  return tdJsonValue(value) ?? null;
}
