import { storeChatRevenueAmount } from '../telegram-store/chatRevenueAmount.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireChatRevenueAmountUpdate = TelegramWireUpdateByType<'updateChatRevenueAmount'>;

export async function handleUpdateChatRevenueAmount(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireChatRevenueAmountUpdate
): Promise<void> {
  await storeChatRevenueAmount(database, update);
}
