import { storeUser, userUpdatedEventInput } from '../telegram-store/User.js';
import type { TelegramWireUserUpdate } from '../telegram-wire.js';
import type { TelegramUpdateHandlerContext } from './context.js';

export async function handleUpdateUser(
  { database, events }: TelegramUpdateHandlerContext,
  { user }: TelegramWireUserUpdate
): Promise<void> {
  await storeUser(database, user);
  events.publishTelegramUserUpdated(userUpdatedEventInput(user));
}
