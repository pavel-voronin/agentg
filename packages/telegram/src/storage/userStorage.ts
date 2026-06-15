import type { Database } from '../database/client.js';
import { telegramUsers } from '../database/schema.js';
import type { UserState, UserPatch } from '../domain/models/user.js';

export type UserStorageRow = typeof telegramUsers.$inferInsert;

export async function upsertUserPatch(database: Database, user: UserPatch): Promise<void> {
  const row = userStorageRow(user);
  await database.insert(telegramUsers).values(row).onConflictDoUpdate({
    set: row,
    target: telegramUsers.id
  });
}

function userStorageRow(user: UserState | UserPatch): UserStorageRow {
  return user;
}
