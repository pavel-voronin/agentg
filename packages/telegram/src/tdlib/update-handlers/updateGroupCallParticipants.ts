import { telegramGroupCallEncryptedParticipantUsers } from '../../database/schema.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireGroupCallParticipantsUpdate =
  TelegramWireUpdateByType<'updateGroupCallParticipants'>;

export async function handleUpdateGroupCallParticipants(
  update: TelegramWireGroupCallParticipantsUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const row = {
    groupCallId: update.group_call_id,
    participantUserIds: telegramWireJsonValue(update.participant_user_ids) ?? []
  } satisfies typeof telegramGroupCallEncryptedParticipantUsers.$inferInsert;

  await database.insert(telegramGroupCallEncryptedParticipantUsers).values(row).onConflictDoUpdate({
    set: row,
    target: telegramGroupCallEncryptedParticipantUsers.groupCallId
  });

  events.publishTelegramGroupCallEncryptedParticipantUsersUpdated(update);
}
