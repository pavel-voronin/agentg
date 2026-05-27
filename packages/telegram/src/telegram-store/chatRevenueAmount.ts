import type { TelegramDatabase } from '../database.js';
import { telegramChatRevenueAmounts } from '../schema.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireChatRevenueAmountUpdate = TelegramWireUpdateByType<'updateChatRevenueAmount'>;

export async function storeChatRevenueAmount(
  database: TelegramDatabase,
  update: TelegramWireChatRevenueAmountUpdate
): Promise<void> {
  const row = chatRevenueAmountRow(update);

  await database.insert(telegramChatRevenueAmounts).values(row).onConflictDoUpdate({
    set: row,
    target: telegramChatRevenueAmounts.chatId
  });
}

function chatRevenueAmountRow(
  update: TelegramWireChatRevenueAmountUpdate
): typeof telegramChatRevenueAmounts.$inferInsert {
  const amount = update.revenue_amount;

  return {
    availableAmount: amount.available_amount,
    balanceAmount: amount.balance_amount,
    chatId: String(update.chat_id),
    cryptocurrency: amount.cryptocurrency,
    totalAmount: amount.total_amount,
    withdrawalEnabled: amount.withdrawal_enabled
  };
}
