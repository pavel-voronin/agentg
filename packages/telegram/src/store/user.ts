import type { TelegramDatabase } from '../database/client.js';
import { telegramUsers } from '../database/schema.js';
import { telegramWireJsonObject, type TelegramWireUser } from '../tdlib/wire.js';

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
