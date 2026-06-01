import { storeBusinessConnection } from '../../store/businessConnection.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type BusinessConnectionUpdate = UpdateByType<'updateBusinessConnection'>;

export async function handleUpdateBusinessConnection(
  { connection }: BusinessConnectionUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  await storeBusinessConnection(database, connection);
  await events.publishTelegramBusinessConnectionUpdated(connection.id);
}
