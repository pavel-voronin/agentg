import type { UpdateByType } from '../updateTypes.js';
import { fileSnapshotFromUpdate } from '../fileSlot.js';
import type { IngestionResources } from '../../resources.js';

type FileUpdate = UpdateByType<'updateFile'>;

export async function handleUpdateFile(
  update: FileUpdate,
  resources: IngestionResources
): Promise<void> {
  await resources.files.handleFileSnapshot(fileSnapshotFromUpdate(update));
}
