import { storeSupergroup } from '../../store/supergroup.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type SupergroupUpdate = UpdateByType<'updateSupergroup'>;

export async function handleUpdateSupergroup(
  { supergroup }: SupergroupUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await storeSupergroup(database, supergroup);
}
