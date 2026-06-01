import { storeSupergroup } from '../../store/supergroup.js';
import type { SupergroupUpdate } from '../types.js';
import type { IngestionResources } from '../resources.js';

export async function handleUpdateSupergroup(
  { supergroup }: SupergroupUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await storeSupergroup(database, supergroup);
}
