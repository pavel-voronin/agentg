import { storeCall } from '../../store/call.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type CallUpdate = UpdateByType<'updateCall'>;

export async function handleUpdateCall(
  { call }: CallUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await storeCall(database, call);
}
