import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { fileDownloadChanges } from '../fileDownload.js';
import type { IngestionResources } from '../../resources.js';

type FileDownloadUpdate = UpdateByType<'updateFileDownload'>;

export async function handleUpdateFileDownload(
  update: FileDownloadUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, fileDownloadChanges(update));
}
