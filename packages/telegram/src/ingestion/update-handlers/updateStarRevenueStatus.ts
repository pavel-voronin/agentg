import { upsertStarRevenueStatus } from '../../store/starRevenue.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type StarRevenueStatusUpdate = UpdateByType<'updateStarRevenueStatus'>;

export function handleUpdateStarRevenueStatus(
  update: StarRevenueStatusUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  return upsertStarRevenueStatus(database, update);
}
