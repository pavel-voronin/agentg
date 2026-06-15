import type { Database } from '../database/client.js';
import { telegramBusinessConnections } from '../database/schema.js';
import type { BusinessConnection } from '../domain/models/businessConnection.js';

export type BusinessConnectionStorageRow = typeof telegramBusinessConnections.$inferInsert;

export async function saveBusinessConnection(
  database: Database,
  connection: BusinessConnection
): Promise<void> {
  const row = businessConnectionStorageRow(connection);
  await database.insert(telegramBusinessConnections).values(row).onConflictDoUpdate({
    set: row,
    target: telegramBusinessConnections.id
  });
}

function businessConnectionStorageRow(
  connection: BusinessConnection
): BusinessConnectionStorageRow {
  return connection;
}
