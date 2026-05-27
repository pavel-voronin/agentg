import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramKv } from '../telegram-store/kv.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireStoryStealthModeUpdate = TelegramWireUpdateByType<'updateStoryStealthMode'>;

const STORY_STEALTH_MODE_KEY = 'story_stealth_mode';

export async function handleUpdateStoryStealthMode(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireStoryStealthModeUpdate
): Promise<void> {
  await upsertTelegramKv(database, STORY_STEALTH_MODE_KEY, {
    active_until_date: update.active_until_date,
    cooldown_until_date: update.cooldown_until_date
  });

  events.publishTelegramStoryStealthModeUpdated(update);
}
