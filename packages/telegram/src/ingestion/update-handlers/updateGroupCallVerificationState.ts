import { telegramGroupCallVerificationStates } from '../../database/schema.js';
import { tdJsonValue, type UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type GroupCallVerificationStateUpdate = UpdateByType<'updateGroupCallVerificationState'>;

export async function handleUpdateGroupCallVerificationState(
  update: GroupCallVerificationStateUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const emojis = tdJsonValue(update.emojis) ?? [];
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

  await events.publishTelegramGroupCallVerificationStateUpdated(update);
}
