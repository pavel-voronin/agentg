import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertStarRevenueStatus } from '../telegram-store/starRevenue.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireStarRevenueStatusUpdate = TelegramWireUpdateByType<'updateStarRevenueStatus'>;

export function handleUpdateStarRevenueStatus(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireStarRevenueStatusUpdate
): Promise<void> {
  return upsertStarRevenueStatus(database, update);
}
