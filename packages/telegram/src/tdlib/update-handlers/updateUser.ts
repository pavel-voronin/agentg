import { storeUser } from '../../store/user.js';
import type { TelegramWireUserUpdate } from '../wire.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';

export async function handleUpdateUser(
  { database, events }: TelegramUpdateHandlerContext,
  { user }: TelegramWireUserUpdate
): Promise<void> {
  await storeUser(database, user);
  events.publishTelegramUserUpdated(user);
}
