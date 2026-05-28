import { telegramGroupCallMessages } from '../../schema.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { telegramWireJsonObject, type TelegramWireUpdateByType } from '../wire.js';

type TelegramWireGroupCallMessageSendFailedUpdate =
  TelegramWireUpdateByType<'updateGroupCallMessageSendFailed'>;

export async function handleUpdateGroupCallMessageSendFailed(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireGroupCallMessageSendFailedUpdate
): Promise<void> {
  const error = telegramWireJsonObject(update.error);
  const row: typeof telegramGroupCallMessages.$inferInsert = {
    error,
    groupCallId: update.group_call_id,
    messageId: update.message_id
  };

  await database
    .insert(telegramGroupCallMessages)
    .values(row)
    .onConflictDoUpdate({
      set: {
        error
      },
      target: [telegramGroupCallMessages.groupCallId, telegramGroupCallMessages.messageId]
    });

  events.publishTelegramGroupCallMessageSendFailed({
    error,
    groupCallId: row.groupCallId,
    messageId: row.messageId
  });
}
