import type { Database } from '../database/client.js';
import { telegramFiles } from '../database/schema.js';
import type { FileState } from '../domain/models/fileState.js';

export type FileStorageRow = typeof telegramFiles.$inferInsert;

export async function saveFileState(database: Database, file: FileState): Promise<void> {
  const row = fileStorageRow(file);
  await database.insert(telegramFiles).values(row).onConflictDoUpdate({
    set: row,
    target: telegramFiles.id
  });
}

export async function saveFileStates(
  database: Database,
  files: readonly FileState[]
): Promise<void> {
  const rows = uniqueFileStorageRows(files);
  for (const row of rows) {
    await database.insert(telegramFiles).values(row).onConflictDoUpdate({
      set: row,
      target: telegramFiles.id
    });
  }
}

function fileStorageRow(file: FileState): FileStorageRow {
  return file;
}

function uniqueFileStorageRows(files: readonly FileState[]): FileStorageRow[] {
  const rowsById = new Map<number, FileStorageRow>();
  for (const file of files) {
    rowsById.set(file.id, fileStorageRow(file));
  }
  return [...rowsById.values()];
}
