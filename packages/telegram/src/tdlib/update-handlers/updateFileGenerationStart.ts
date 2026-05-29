import { upsertFileGenerationRequest } from '../../store/fileGenerationRequest.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useFiles } from '../../files/subsystem.js';

type TelegramWireFileGenerationStartUpdate = TelegramWireUpdateByType<'updateFileGenerationStart'>;

export function handleUpdateFileGenerationStart(
  update: TelegramWireFileGenerationStartUpdate
): Promise<void> {
  const database = useDatabase();
  const files = useFiles();
  return upsertFileGenerationRequest(database, update).then(() => {
    files.startFileGeneration(update);
  });
}
