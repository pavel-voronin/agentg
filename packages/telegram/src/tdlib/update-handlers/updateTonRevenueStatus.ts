import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireTonRevenueStatusUpdate = TelegramWireUpdateByType<'updateTonRevenueStatus'>;

export async function handleUpdateTonRevenueStatus(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireTonRevenueStatusUpdate
): Promise<void> {
  await upsertTelegramKv(database, 'ton_revenue_status', update.status);
  events.publishTelegramTonRevenueStatusUpdated(update);
}
