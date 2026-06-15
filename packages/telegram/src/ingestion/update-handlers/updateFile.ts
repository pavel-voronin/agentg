import { storeFileUpdate } from '../../store/file.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type FileUpdate = UpdateByType<'updateFile'>;

export async function handleUpdateFile(
  update: FileUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  await storeFileUpdate(files, update);
}
