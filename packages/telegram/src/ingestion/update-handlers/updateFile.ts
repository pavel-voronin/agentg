import { storeFileUpdate } from '../../store/file.js';
import type { FileUpdate } from '../types.js';
import type { IngestionResources } from '../resources.js';

export async function handleUpdateFile(
  update: FileUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  await storeFileUpdate(files, update);
}
