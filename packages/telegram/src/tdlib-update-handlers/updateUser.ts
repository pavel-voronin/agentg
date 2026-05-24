import { storeUser, userUpdatedEventInput } from '../telegram-store/user.js';
import type { TelegramWireUserUpdate } from '../telegramWire.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';

export async function handleUpdateUser(
  { database, events }: TelegramUpdateHandlerContext,
  { user }: TelegramWireUserUpdate
): Promise<void> {
  await storeUser(database, user);
  events.publishTelegramUserUpdated(userUpdatedEventInput(user));
}
