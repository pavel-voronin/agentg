import { eq } from 'drizzle-orm';

import type { JsonValue } from '@agentg/framework';

import type { Database } from '../database/client.js';
import { telegramKv } from '../database/schema.js';
import { tdJsonValue } from '../tdlib/value.js';

export async function upsertTelegramKv(
  database: Database,
  key: string,
  value: unknown
): Promise<void> {
  const row: typeof telegramKv.$inferInsert = {
    key,
    value: requiredJsonValue(value)
  };

  await database.insert(telegramKv).values(row).onConflictDoUpdate({
    set: row,
    target: telegramKv.key
  });
}

export async function deleteTelegramKv(database: Database, key: string): Promise<void> {
  await database.delete(telegramKv).where(eq(telegramKv.key, key));
}

function requiredJsonValue(value: unknown): JsonValue {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
