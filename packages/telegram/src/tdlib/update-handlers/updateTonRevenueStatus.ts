import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireTonRevenueStatusUpdate = TelegramWireUpdateByType<'updateTonRevenueStatus'>;

export async function handleUpdateTonRevenueStatus(
  update: TelegramWireTonRevenueStatusUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  await upsertTelegramKv(database, 'ton_revenue_status', update.status);
  events.publishTelegramTonRevenueStatusUpdated(update);
}
