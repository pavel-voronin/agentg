import type { TelegramDatabase } from '../database.js';
import { telegramFileGenerationRequests } from '../schema.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireFileGenerationStartUpdate = TelegramWireUpdateByType<'updateFileGenerationStart'>;

export async function upsertFileGenerationRequest(
  database: TelegramDatabase,
  update: TelegramWireFileGenerationStartUpdate
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
