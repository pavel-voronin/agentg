import type { Database } from '../database/client.js';
import { telegramUsers } from '../database/schema.js';
import { tdJsonObject } from '../tdlib/shape.js';
import type { user as User } from 'tdlib-types';

export async function storeUser(database: Database, user: User): Promise<void> {
  const row = {
    firstName: user.first_name,
    id: String(user.id),
    isPremium: user.is_premium,
    lastName: user.last_name,
    type: tdJsonObject(user.type)
  };

  await database.insert(telegramUsers).values(row).onConflictDoUpdate({
    set: row,
    target: telegramUsers.id
  });
}
