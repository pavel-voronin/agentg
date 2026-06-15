import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { fileGenerationRequestChanges, fileGenerationRequestRecord } from '../state.js';
import type { IngestionResources } from '../../resources.js';

type FileGenerationStartUpdate = UpdateByType<'updateFileGenerationStart'>;

export async function handleUpdateFileGenerationStart(
  update: FileGenerationStartUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  await applyIngestionChanges(resources, fileGenerationRequestChanges(update));
  files.startFileGeneration(fileGenerationRequestRecord(update));
}
