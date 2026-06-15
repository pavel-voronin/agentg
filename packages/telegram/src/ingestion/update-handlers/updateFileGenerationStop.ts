import { eq } from 'drizzle-orm';

import { telegramFileGenerationRequests } from '../../database/schema.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type FileGenerationStopUpdate = UpdateByType<'updateFileGenerationStop'>;

export async function handleUpdateFileGenerationStop(
  update: FileGenerationStopUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { files } = resources;
  await database
    .delete(telegramFileGenerationRequests)
    .where(eq(telegramFileGenerationRequests.generationId, update.generation_id));
  await files.stopFileGeneration(update.generation_id);
}
