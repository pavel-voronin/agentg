import type { TelegramDatabase } from '../database.js';
import { telegramUsers } from '../schema.js';
import { telegramWireJsonObject, type TelegramWireUser } from '../telegram-wire.js';

export async function storeUser(database: TelegramDatabase, user: TelegramWireUser): Promise<void> {
  const row = {
    firstName: user.first_name,
    id: String(user.id),
    isPremium: user.is_premium,
    lastName: user.last_name,
    type: telegramWireJsonObject(user.type)
  };

  await database.insert(telegramUsers).values(row).onConflictDoUpdate({
    set: row,
    target: telegramUsers.id
  });
}

export function userUpdatedEventInput(user: TelegramWireUser, options: { isSelf?: boolean } = {}) {
  const username = activeUsername(user.usernames);
  return {
    firstName: user.first_name,
    id: String(user.id),
    isBot: user.type._ === 'userTypeBot',
    lastName: user.last_name,
    ...(options.isSelf === true ? { isSelf: true } : {}),
    ...(username === undefined ? {} : { username })
  };
}

function activeUsername(value: TelegramWireUser['usernames']): string | undefined {
  return value?.active_usernames[0];
}
