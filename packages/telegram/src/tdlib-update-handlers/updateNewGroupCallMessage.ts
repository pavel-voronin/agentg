import { telegramGroupCallMessages } from '../schema.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import {
  telegramWireDate,
  telegramWireId,
  telegramWireJsonObject,
  type TelegramWireUpdateByType
} from '../telegramWire.js';

type TelegramWireNewGroupCallMessageUpdate = TelegramWireUpdateByType<'updateNewGroupCallMessage'>;

export async function handleUpdateNewGroupCallMessage(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireNewGroupCallMessageUpdate
): Promise<void> {
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
