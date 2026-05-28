import { storeChatRevenueAmount } from '../../store/chatRevenueAmount.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireChatRevenueAmountUpdate = TelegramWireUpdateByType<'updateChatRevenueAmount'>;

export async function handleUpdateChatRevenueAmount(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireChatRevenueAmountUpdate
): Promise<void> {
  await storeChatRevenueAmount(database, update);
}
