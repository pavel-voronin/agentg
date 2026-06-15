import { upsertFileGenerationRequest } from '../../store/fileGenerationRequest.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type FileGenerationStartUpdate = UpdateByType<'updateFileGenerationStart'>;

export function handleUpdateFileGenerationStart(
  update: FileGenerationStartUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { files } = resources;
  return upsertFileGenerationRequest(database, update).then(() => {
    files.startFileGeneration(update);
  });
}
