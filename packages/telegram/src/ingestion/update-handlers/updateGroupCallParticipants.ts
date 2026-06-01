import { telegramGroupCallEncryptedParticipantUsers } from '../../database/schema.js';
import { tdJsonValue, type UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type GroupCallParticipantsUpdate = UpdateByType<'updateGroupCallParticipants'>;

export async function handleUpdateGroupCallParticipants(
  update: GroupCallParticipantsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const row = {
    groupCallId: update.group_call_id,
    participantUserIds: tdJsonValue(update.participant_user_ids) ?? []
  } satisfies typeof telegramGroupCallEncryptedParticipantUsers.$inferInsert;

  await database.insert(telegramGroupCallEncryptedParticipantUsers).values(row).onConflictDoUpdate({
    set: row,
    target: telegramGroupCallEncryptedParticipantUsers.groupCallId
  });

  await events.publishTelegramGroupCallEncryptedParticipantUsersUpdated(update);
}
