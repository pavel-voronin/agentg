import { storeUserFullInfo } from '../telegram-store/userFullInfo.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireUserFullInfoUpdate = TelegramWireUpdateByType<'updateUserFullInfo'>;

export async function handleUpdateUserFullInfo(
  { database, events, files }: TelegramUpdateHandlerContext,
  update: TelegramWireUserFullInfoUpdate
): Promise<void> {
  const userId = String(update.user_id);

  await storeUserFullInfo(database, userId, update.user_full_info);
  await files.recordUserFullInfoFiles(userId, update.user_full_info, 'live_update');
  events.publishTelegramUserFullInfoUpdated({ userId });
}
