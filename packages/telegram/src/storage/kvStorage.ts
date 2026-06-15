import { eq } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import { telegramKv } from '../database/schema.js';
import type { KvEntry } from '../domain/models/kvEntry.js';

export type KvEntryStorageRow = typeof telegramKv.$inferInsert;

export async function saveKvEntry(database: Database, entry: KvEntry): Promise<void> {
  const row = kvEntryStorageRow(entry);
  await database.insert(telegramKv).values(row).onConflictDoUpdate({
    set: row,
    target: telegramKv.key
  });
}

export async function deleteKvEntry(database: Database, key: string): Promise<void> {
  await database.delete(telegramKv).where(eq(telegramKv.key, key));
}

function kvEntryStorageRow(entry: KvEntry): KvEntryStorageRow {
  return entry;
}
