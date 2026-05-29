import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireStoryStealthModeUpdate = TelegramWireUpdateByType<'updateStoryStealthMode'>;

const STORY_STEALTH_MODE_KEY = 'story_stealth_mode';

export async function handleUpdateStoryStealthMode(
  update: TelegramWireStoryStealthModeUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  await upsertTelegramKv(database, STORY_STEALTH_MODE_KEY, {
    active_until_date: update.active_until_date,
    cooldown_until_date: update.cooldown_until_date
  });

  events.publishTelegramStoryStealthModeUpdated(update);
}
