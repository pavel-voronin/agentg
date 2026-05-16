import { telegramUsers } from '../schema.js';
import type { TdlibUpdateUser } from '../tdlib-schema/UpdateUser.js';
import type { TelegramUpdateHandlerContext } from './context.js';

export async function handleUpdateUser(
  { database, events }: TelegramUpdateHandlerContext,
  { user }: TdlibUpdateUser
): Promise<void> {
  await database
    .insert(telegramUsers)
    .values({
      firstName: user.firstName,
      id: user.id,
      isPremium: user.isPremium,
      lastName: user.lastName,
      type: user.type
    })
    .onConflictDoUpdate({
      set: {
        firstName: user.firstName,
        id: user.id,
        isPremium: user.isPremium,
        lastName: user.lastName,
        type: user.type
      },
      target: telegramUsers.id
    });

  events.publishTelegramUserUpdated({
    firstName: user.firstName,
    id: user.id,
    isBot: user.isBot,
    lastName: user.lastName,
    ...(user.isSelf === true ? { isSelf: true } : {}),
    ...(user.username === undefined ? {} : { username: user.username })
  });
}
