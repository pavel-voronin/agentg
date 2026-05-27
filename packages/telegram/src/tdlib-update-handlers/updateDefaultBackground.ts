import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { storeDefaultBackgroundSelection } from '../telegram-store/defaultBackground.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireDefaultBackgroundUpdate = TelegramWireUpdateByType<'updateDefaultBackground'>;

export async function handleUpdateDefaultBackground(
  { database, events, files }: TelegramUpdateHandlerContext,
  update: TelegramWireDefaultBackgroundUpdate
): Promise<void> {
  const background = update.background ?? null;
  const selection = await storeDefaultBackgroundSelection(
    database,
    update.for_dark_theme,
    background
  );

  await files.recordDefaultBackgroundFiles(selection.key, background, 'live_update');
  events.publishTelegramDefaultBackgroundUpdated(selection);
}
