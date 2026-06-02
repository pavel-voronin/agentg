import type { Database } from '../database/client.js';
import { telegramFileGenerationRequests } from '../database/schema.js';
import { type UpdateByType } from '../tdlib/value.js';

type FileGenerationStartUpdate = UpdateByType<'updateFileGenerationStart'>;

export async function upsertFileGenerationRequest(
  database: Database,
  update: FileGenerationStartUpdate
): Promise<void> {
  const row: typeof telegramFileGenerationRequests.$inferInsert = {
    conversion: update.conversion,
    destinationPath: update.destination_path,
    generationId: update.generation_id,
    originalPath: update.original_path
  };

  await database.insert(telegramFileGenerationRequests).values(row).onConflictDoUpdate({
    set: row,
    target: telegramFileGenerationRequests.generationId
  });
}
