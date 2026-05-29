import { storeChatRevenueAmount } from '../../store/chatRevenueAmount.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireChatRevenueAmountUpdate = TelegramWireUpdateByType<'updateChatRevenueAmount'>;

export async function handleUpdateChatRevenueAmount(
  update: TelegramWireChatRevenueAmountUpdate
): Promise<void> {
  const database = useDatabase();
  await storeChatRevenueAmount(database, update);
}
