import { telegramGroupCallMessages } from '../../database/schema.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';
import {
  telegramWireDate,
  telegramWireId,
  telegramWireJsonObject,
  type TelegramWireUpdateByType
} from '../wire.js';

type TelegramWireNewGroupCallMessageUpdate = TelegramWireUpdateByType<'updateNewGroupCallMessage'>;

export async function handleUpdateNewGroupCallMessage(
  update: TelegramWireNewGroupCallMessageUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const row: typeof telegramGroupCallMessages.$inferInsert = {
    canBeDeleted: update.message.can_be_deleted,
    date: requiredTelegramWireDate(update.message.date),
    error: null,
    groupCallId: update.group_call_id,
    isFromOwner: update.message.is_from_owner,
    messageId: update.message.message_id,
    paidMessageStarCount: telegramWireId(update.message.paid_message_star_count),
    senderId: telegramWireJsonObject(update.message.sender_id),
    text: telegramWireJsonObject(update.message.text)
  };

  await database
    .insert(telegramGroupCallMessages)
    .values(row)
    .onConflictDoUpdate({
      set: row,
      target: [telegramGroupCallMessages.groupCallId, telegramGroupCallMessages.messageId]
    });

  events.publishTelegramGroupCallMessageCreated(update);
}

function requiredTelegramWireDate(value: number): Date {
  const date = telegramWireDate(value);
  if (date === undefined) {
    throw new Error('Expected Telegram wire date');
  }
  return date;
}
