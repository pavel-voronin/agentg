import type { JsonValue } from '@agentg/framework';

import type { DomainChange, StarRevenueStatusSavedChange } from '../../domain/changes.js';
import type { StarRevenueStatus } from '../../domain/models/starRevenue.js';
import { chatRef, userRef } from '../../model/refs.js';
import { tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';

type StarRevenueStatusUpdate = UpdateByType<'updateStarRevenueStatus'>;

export function starRevenueStatusChanges(update: StarRevenueStatusUpdate): DomainChange[] {
  return [
    {
      kind: 'starRevenueStatus.saved',
      status: starRevenueStatusRecord(update)
    } satisfies StarRevenueStatusSavedChange
  ];
}

function starRevenueStatusRecord(update: StarRevenueStatusUpdate): StarRevenueStatus {
  const status = update.status;
  return {
    availableAmount: requiredJsonValue(status.available_amount),
    currentAmount: requiredJsonValue(status.current_amount),
    nextWithdrawalIn: status.next_withdrawal_in,
    ownerId: starRevenueOwnerId(update.owner_id),
    totalAmount: requiredJsonValue(status.total_amount),
    withdrawalEnabled: status.withdrawal_enabled
  };
}

function starRevenueOwnerId(owner: StarRevenueStatusUpdate['owner_id']): string {
  const ownerRecord = owner as {
    _: string;
    chat_id?: number;
    user_id?: number;
  };

  if (ownerRecord._ === 'messageSenderUser' && ownerRecord.user_id !== undefined) {
    const ref = userRef(String(ownerRecord.user_id));
    return `${ref._model}:${ref.id}`;
  }
  if (ownerRecord._ === 'messageSenderChat' && ownerRecord.chat_id !== undefined) {
    const ref = chatRef(String(ownerRecord.chat_id));
    return `${ref._model}:${ref.id}`;
  }
  throw new Error('Unsupported star revenue owner');
}

function requiredJsonValue(value: unknown): JsonValue {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
