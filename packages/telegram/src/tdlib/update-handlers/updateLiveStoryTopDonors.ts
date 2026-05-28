import { telegramLiveStoryDonors } from '../../database/schema.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';

type TelegramWireLiveStoryTopDonorsUpdate = TelegramWireUpdateByType<'updateLiveStoryTopDonors'>;

export async function handleUpdateLiveStoryTopDonors(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireLiveStoryTopDonorsUpdate
): Promise<void> {
  const row: typeof telegramLiveStoryDonors.$inferInsert = {
    groupCallId: update.group_call_id,
    topDonors: requiredTelegramWireJsonValue(update.donors.top_donors),
    totalStarCount: String(update.donors.total_star_count)
  };

  await database.insert(telegramLiveStoryDonors).values(row).onConflictDoUpdate({
    set: row,
    target: telegramLiveStoryDonors.groupCallId
  });

  events.publishTelegramLiveStoryTopDonorsUpdated(update);
}

function requiredTelegramWireJsonValue(value: unknown) {
  const json = telegramWireJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
