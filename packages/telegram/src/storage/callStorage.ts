import type { Database } from '../database/client.js';
import { telegramCalls } from '../database/schema.js';
import type { Call } from '../domain/models/call.js';

export type CallStorageRow = typeof telegramCalls.$inferInsert;

export async function saveCall(database: Database, call: Call): Promise<void> {
  const row = callStorageRow(call);
  await database.insert(telegramCalls).values(row).onConflictDoUpdate({
    set: row,
    target: telegramCalls.id
  });
}

function callStorageRow(call: Call): CallStorageRow {
  return call;
}
