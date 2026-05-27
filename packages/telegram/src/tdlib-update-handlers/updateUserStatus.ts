import { storeUserStatus } from '../telegram-store/userStatus.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireUserStatusUpdate = TelegramWireUpdateByType<'updateUserStatus'>;

export async function handleUpdateUserStatus(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireUserStatusUpdate
): Promise<void> {
  await storeUserStatus(database, update.user_id, update.status);
  events.publishTelegramUserStatusUpdated(update);
}
