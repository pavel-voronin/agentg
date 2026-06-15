import type { Database } from '../database/client.js';
import { telegramBackgrounds } from '../database/schema.js';
import type { Background } from '../domain/models/background.js';

export async function saveBackground(database: Database, background: Background): Promise<void> {
  await database.insert(telegramBackgrounds).values(background).onConflictDoUpdate({
    set: background,
    target: telegramBackgrounds.id
  });
}

export async function saveBackgrounds(
  database: Database,
  backgrounds: readonly Background[]
): Promise<void> {
  const records = uniqueBackgrounds(backgrounds);
  for (const background of records) {
    await saveBackground(database, background);
  }
}

function uniqueBackgrounds(backgrounds: readonly Background[]): Background[] {
  const recordsById = new Map<string, Background>();
  for (const background of backgrounds) {
    recordsById.set(background.id, background);
  }
  return [...recordsById.values()];
}
