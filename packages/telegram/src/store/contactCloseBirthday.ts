import type { Database } from '../database/client.js';
import { telegramCloseBirthdayUsers } from '../database/schema.js';
import { tdJsonObject, type UpdateByType } from '../tdlib/shape.js';

type ContactCloseBirthdaysUpdate = UpdateByType<'updateContactCloseBirthdays'>;
type CloseBirthdayUser = ContactCloseBirthdaysUpdate['close_birthday_users'][number];

export async function replaceContactCloseBirthdayUsers(
  database: Database,
  closeBirthdayUsers: readonly CloseBirthdayUser[]
): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction.delete(telegramCloseBirthdayUsers);

    if (closeBirthdayUsers.length > 0) {
      await transaction
        .insert(telegramCloseBirthdayUsers)
        .values(closeBirthdayUsers.map(contactCloseBirthdayUserRow));
    }
  });
}

function contactCloseBirthdayUserRow(
  closeBirthdayUser: CloseBirthdayUser
): typeof telegramCloseBirthdayUsers.$inferInsert {
  return {
    birthdate: tdJsonObject(closeBirthdayUser.birthdate),
    userId: String(closeBirthdayUser.user_id)
  };
}
