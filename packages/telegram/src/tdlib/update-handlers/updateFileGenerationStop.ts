import { eq } from 'drizzle-orm';

import { telegramFileGenerationRequests } from '../../schema.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireFileGenerationStopUpdate = TelegramWireUpdateByType<'updateFileGenerationStop'>;

export async function handleUpdateFileGenerationStop(
  { database, files }: TelegramUpdateHandlerContext,
  update: TelegramWireFileGenerationStopUpdate
): Promise<void> {
  await database
    .delete(telegramFileGenerationRequests)
    .where(eq(telegramFileGenerationRequests.generationId, update.generation_id));
  await files.stopFileGeneration(update.generation_id);
}
