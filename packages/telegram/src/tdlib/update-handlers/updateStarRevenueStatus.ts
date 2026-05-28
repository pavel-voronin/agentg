import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertStarRevenueStatus } from '../../store/starRevenue.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireStarRevenueStatusUpdate = TelegramWireUpdateByType<'updateStarRevenueStatus'>;

export function handleUpdateStarRevenueStatus(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireStarRevenueStatusUpdate
): Promise<void> {
  return upsertStarRevenueStatus(database, update);
}
