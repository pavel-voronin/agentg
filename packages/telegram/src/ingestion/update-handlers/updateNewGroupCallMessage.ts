import { telegramGroupCallMessages } from '../../database/schema.js';
import { tdDate, tdId, tdJsonObject, type UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type NewGroupCallMessageUpdate = UpdateByType<'updateNewGroupCallMessage'>;

export async function handleUpdateNewGroupCallMessage(
  update: NewGroupCallMessageUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const row: typeof telegramGroupCallMessages.$inferInsert = {
    canBeDeleted: update.message.can_be_deleted,
    date: requiredDate(update.message.date),
    error: null,
    groupCallId: update.group_call_id,
    isFromOwner: update.message.is_from_owner,
    messageId: update.message.message_id,
    paidMessageStarCount: tdId(update.message.paid_message_star_count),
    senderId: tdJsonObject(update.message.sender_id),
    text: tdJsonObject(update.message.text)
  };

  await database
    .insert(telegramGroupCallMessages)
    .values(row)
    .onConflictDoUpdate({
      set: row,
      target: [telegramGroupCallMessages.groupCallId, telegramGroupCallMessages.messageId]
    });
}

function requiredDate(value: number): Date {
  const date = tdDate(value);
  if (date === undefined) {
    throw new Error('Expected Telegram wire date');
  }
  return date;
}
