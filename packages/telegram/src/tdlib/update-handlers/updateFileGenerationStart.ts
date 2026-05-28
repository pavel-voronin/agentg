import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertFileGenerationRequest } from '../../store/fileGenerationRequest.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireFileGenerationStartUpdate = TelegramWireUpdateByType<'updateFileGenerationStart'>;

export function handleUpdateFileGenerationStart(
  { database, files }: TelegramUpdateHandlerContext,
  update: TelegramWireFileGenerationStartUpdate
): Promise<void> {
  return upsertFileGenerationRequest(database, update).then(() => {
    files.startFileGeneration(update);
  });
}
