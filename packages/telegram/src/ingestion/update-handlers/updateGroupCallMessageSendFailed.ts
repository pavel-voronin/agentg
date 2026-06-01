import { telegramGroupCallMessages } from '../../database/schema.js';
import { tdJsonObject, type UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type GroupCallMessageSendFailedUpdate = UpdateByType<'updateGroupCallMessageSendFailed'>;

export async function handleUpdateGroupCallMessageSendFailed(
  update: GroupCallMessageSendFailedUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const error = tdJsonObject(update.error);
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

  await events.publishTelegramGroupCallMessageSendFailed({
    error,
    groupCallId: row.groupCallId,
    messageId: row.messageId
  });
}
