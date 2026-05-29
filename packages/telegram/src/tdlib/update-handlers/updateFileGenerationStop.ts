import { eq } from 'drizzle-orm';

import { telegramFileGenerationRequests } from '../../database/schema.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useFiles } from '../../files/subsystem.js';

type TelegramWireFileGenerationStopUpdate = TelegramWireUpdateByType<'updateFileGenerationStop'>;

export async function handleUpdateFileGenerationStop(
  update: TelegramWireFileGenerationStopUpdate
): Promise<void> {
  const database = useDatabase();
  const files = useFiles();
  await database
    .delete(telegramFileGenerationRequests)
    .where(eq(telegramFileGenerationRequests.generationId, update.generation_id));
  await files.stopFileGeneration(update.generation_id);
}
