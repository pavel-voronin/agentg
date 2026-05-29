import { telegramGroupCallVerificationStates } from '../../database/schema.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireGroupCallVerificationStateUpdate =
  TelegramWireUpdateByType<'updateGroupCallVerificationState'>;

export async function handleUpdateGroupCallVerificationState(
  update: TelegramWireGroupCallVerificationStateUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const emojis = telegramWireJsonValue(update.emojis) ?? [];
  const row: typeof telegramGroupCallVerificationStates.$inferInsert = {
    emojis,
    generation: update.generation,
    groupCallId: update.group_call_id
  };

  await database
    .insert(telegramGroupCallVerificationStates)
    .values(row)
    .onConflictDoUpdate({
      set: {
        emojis,
        generation: row.generation
      },
      target: telegramGroupCallVerificationStates.groupCallId
    });

  events.publishTelegramGroupCallVerificationStateUpdated(update);
}
