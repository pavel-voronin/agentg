import { telegramLiveStoryDonors } from '../../database/schema.js';
import { tdJsonValue, type UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type LiveStoryTopDonorsUpdate = UpdateByType<'updateLiveStoryTopDonors'>;

export async function handleUpdateLiveStoryTopDonors(
  update: LiveStoryTopDonorsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const row: typeof telegramLiveStoryDonors.$inferInsert = {
    groupCallId: update.group_call_id,
    topDonors: requiredJsonValue(update.donors.top_donors),
    totalStarCount: String(update.donors.total_star_count)
  };

  await database.insert(telegramLiveStoryDonors).values(row).onConflictDoUpdate({
    set: row,
    target: telegramLiveStoryDonors.groupCallId
  });

  await events.publishTelegramLiveStoryTopDonorsUpdated(update);
}

function requiredJsonValue(value: unknown) {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
