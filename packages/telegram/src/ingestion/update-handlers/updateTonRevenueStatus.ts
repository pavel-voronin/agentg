import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type TonRevenueStatusUpdate = UpdateByType<'updateTonRevenueStatus'>;

export async function handleUpdateTonRevenueStatus(
  update: TonRevenueStatusUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  await upsertTelegramKv(database, 'ton_revenue_status', update.status);
  await events.publishTelegramTonRevenueStatusUpdated(update);
}
