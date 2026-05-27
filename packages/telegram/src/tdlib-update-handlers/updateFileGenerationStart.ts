import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertFileGenerationRequest } from '../telegram-store/fileGenerationRequest.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireFileGenerationStartUpdate = TelegramWireUpdateByType<'updateFileGenerationStart'>;

export function handleUpdateFileGenerationStart(
  { database, files }: TelegramUpdateHandlerContext,
  update: TelegramWireFileGenerationStartUpdate
): Promise<void> {
  return upsertFileGenerationRequest(database, update).then(() => {
    files.startFileGeneration(update);
  });
}
