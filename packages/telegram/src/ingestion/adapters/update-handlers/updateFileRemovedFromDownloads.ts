import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { fileRemovedFromDownloadsChanges } from '../fileDownload.js';
import type { IngestionResources } from '../../resources.js';

type FileRemovedFromDownloadsUpdate = UpdateByType<'updateFileRemovedFromDownloads'>;

export async function handleUpdateFileRemovedFromDownloads(
  update: FileRemovedFromDownloadsUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, fileRemovedFromDownloadsChanges(update));
}
