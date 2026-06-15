import { applyIngestionChanges } from '../../applyChanges.js';
import { starRevenueStatusChanges } from '../starRevenue.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type StarRevenueStatusUpdate = UpdateByType<'updateStarRevenueStatus'>;

export function handleUpdateStarRevenueStatus(
  update: StarRevenueStatusUpdate,
  resources: IngestionResources
): Promise<void> {
  return applyIngestionChanges(resources, starRevenueStatusChanges(update)).then(() => undefined);
}
