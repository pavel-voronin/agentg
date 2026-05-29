import { upsertStarRevenueStatus } from '../../store/starRevenue.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireStarRevenueStatusUpdate = TelegramWireUpdateByType<'updateStarRevenueStatus'>;

export function handleUpdateStarRevenueStatus(
  update: TelegramWireStarRevenueStatusUpdate
): Promise<void> {
  const database = useDatabase();
  return upsertStarRevenueStatus(database, update);
}
