import type { JsonValue } from '@agentg/events/json';

import type { TelegramDatabase } from '../database.js';
import { telegramChatRef, telegramUserRef } from '../modelRefs.js';
import { telegramStarRevenueStatuses } from '../schema.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireStarRevenueStatusUpdate = TelegramWireUpdateByType<'updateStarRevenueStatus'>;

export async function upsertStarRevenueStatus(
  database: TelegramDatabase,
  update: TelegramWireStarRevenueStatusUpdate
): Promise<void> {
  const status = update.status;
  const row: typeof telegramStarRevenueStatuses.$inferInsert = {
    availableAmount: requiredTelegramWireJsonValue(status.available_amount),
    currentAmount: requiredTelegramWireJsonValue(status.current_amount),
    nextWithdrawalIn: status.next_withdrawal_in,
    ownerId: starRevenueOwnerId(update.owner_id),
    totalAmount: requiredTelegramWireJsonValue(status.total_amount),
    withdrawalEnabled: status.withdrawal_enabled
  };

  await database.insert(telegramStarRevenueStatuses).values(row).onConflictDoUpdate({
    set: row,
    target: telegramStarRevenueStatuses.ownerId
  });
}

function starRevenueOwnerId(owner: TelegramWireStarRevenueStatusUpdate['owner_id']): string {
  const ownerRecord = owner as {
    _: string;
    chat_id?: number;
    user_id?: number;
  };

  if (ownerRecord._ === 'messageSenderUser' && ownerRecord.user_id !== undefined) {
    const ref = telegramUserRef(String(ownerRecord.user_id));
    return `${ref._model}:${ref.id}`;
  }
  if (ownerRecord._ === 'messageSenderChat' && ownerRecord.chat_id !== undefined) {
    const ref = telegramChatRef(String(ownerRecord.chat_id));
    return `${ref._model}:${ref.id}`;
  }
  throw new Error('Unsupported star revenue owner');
}

function requiredTelegramWireJsonValue(value: unknown): JsonValue {
  const json = telegramWireJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
