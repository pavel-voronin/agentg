import { eq } from 'drizzle-orm';

import type { JsonValue } from '@agentg/events/json';

import type { TelegramDatabase } from '../database/client.js';
import { telegramKv } from '../database/schema.js';
import { telegramWireJsonValue } from '../tdlib/wire.js';

export async function upsertTelegramKv(
  database: TelegramDatabase,
  key: string,
  value: unknown
): Promise<void> {
  const row: typeof telegramKv.$inferInsert = {
    key,
    value: requiredTelegramWireJsonValue(value)
  };

  await database.insert(telegramKv).values(row).onConflictDoUpdate({
    set: row,
    target: telegramKv.key
  });
}

export async function deleteTelegramKv(database: TelegramDatabase, key: string): Promise<void> {
  await database.delete(telegramKv).where(eq(telegramKv.key, key));
}

function requiredTelegramWireJsonValue(value: unknown): JsonValue {
  const json = telegramWireJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
