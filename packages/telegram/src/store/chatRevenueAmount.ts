import type { Database } from '../database/client.js';
import { telegramChatRevenueAmounts } from '../database/schema.js';
import { type UpdateByType } from '../tdlib/shape.js';

type ChatRevenueAmountUpdate = UpdateByType<'updateChatRevenueAmount'>;

export async function storeChatRevenueAmount(
  database: Database,
  update: ChatRevenueAmountUpdate
): Promise<void> {
  const row = chatRevenueAmountRow(update);

  await database.insert(telegramChatRevenueAmounts).values(row).onConflictDoUpdate({
    set: row,
    target: telegramChatRevenueAmounts.chatId
  });
}

function chatRevenueAmountRow(
  update: ChatRevenueAmountUpdate
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
