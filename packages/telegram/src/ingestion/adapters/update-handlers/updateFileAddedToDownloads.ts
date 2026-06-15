import { applyIngestionChangesToDatabase } from '../../applyChanges.js';
import { fileAddedToDownloadsChanges } from '../fileDownload.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type FileAddedToDownloadsUpdate = UpdateByType<'updateFileAddedToDownloads'>;

export async function handleUpdateFileAddedToDownloads(
  update: FileAddedToDownloadsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await database.transaction(async (transaction) => {
    await applyIngestionChangesToDatabase(
      resources,
      transaction,
      fileAddedToDownloadsChanges(update)
    );
  });
}
