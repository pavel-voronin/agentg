import { telegramGroupCallEncryptedParticipantUsers } from '../../schema.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';

type TelegramWireGroupCallParticipantsUpdate =
  TelegramWireUpdateByType<'updateGroupCallParticipants'>;

export async function handleUpdateGroupCallParticipants(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireGroupCallParticipantsUpdate
): Promise<void> {
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
