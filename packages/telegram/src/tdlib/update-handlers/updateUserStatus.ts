import { storeUserStatus } from '../../store/userStatus.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireUserStatusUpdate = TelegramWireUpdateByType<'updateUserStatus'>;

export async function handleUpdateUserStatus(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireUserStatusUpdate
): Promise<void> {
  await storeUserStatus(database, update.user_id, update.status);
  events.publishTelegramUserStatusUpdated(update);
}
