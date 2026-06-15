import { applyIngestionChanges } from '../../applyChanges.js';
import { fileGenerationStopChanges } from '../runtimeState.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type FileGenerationStopUpdate = UpdateByType<'updateFileGenerationStop'>;

export async function handleUpdateFileGenerationStop(
  update: FileGenerationStopUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  await applyIngestionChanges(resources, fileGenerationStopChanges(update));
  await files.stopFileGeneration(update.generation_id);
}
