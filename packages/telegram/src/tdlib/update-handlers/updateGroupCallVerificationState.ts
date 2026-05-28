import { telegramGroupCallVerificationStates } from '../../schema.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';

type TelegramWireGroupCallVerificationStateUpdate =
  TelegramWireUpdateByType<'updateGroupCallVerificationState'>;

export async function handleUpdateGroupCallVerificationState(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireGroupCallVerificationStateUpdate
): Promise<void> {
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
