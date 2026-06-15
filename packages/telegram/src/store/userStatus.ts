import type { Database } from '../database/client.js';
import { telegramUsers } from '../database/schema.js';
import { tdJsonObject, type UpdateByType } from '../tdlib/shape.js';

type UserStatus = UpdateByType<'updateUserStatus'>['status'];

export async function storeUserStatus(
  database: Database,
  userId: number | string,
  status: UserStatus
): Promise<void> {
  const row = {
    id: String(userId),
    status: tdJsonObject(status)
  };

  await database
    .insert(telegramUsers)
    .values(row)
    .onConflictDoUpdate({
      set: {
        status: row.status
      },
      target: telegramUsers.id
    });
}
