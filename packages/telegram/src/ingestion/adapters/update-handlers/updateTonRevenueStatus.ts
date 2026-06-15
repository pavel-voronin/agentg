import { saveKvEntry } from '../../kv.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type TonRevenueStatusUpdate = UpdateByType<'updateTonRevenueStatus'>;

export async function handleUpdateTonRevenueStatus(
  update: TonRevenueStatusUpdate,
  resources: IngestionResources
): Promise<void> {
  await saveKvEntry(resources, 'ton_revenue_status', update.status);
}
