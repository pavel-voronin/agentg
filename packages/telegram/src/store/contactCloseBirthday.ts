import type { TelegramDatabase } from '../database.js';
import { telegramCloseBirthdayUsers } from '../schema.js';
import { telegramWireJsonObject, type TelegramWireUpdateByType } from '../tdlib/wire.js';

type TelegramWireContactCloseBirthdaysUpdate =
  TelegramWireUpdateByType<'updateContactCloseBirthdays'>;
type TelegramWireCloseBirthdayUser =
  TelegramWireContactCloseBirthdaysUpdate['close_birthday_users'][number];

export async function replaceContactCloseBirthdayUsers(
  database: TelegramDatabase,
  closeBirthdayUsers: readonly TelegramWireCloseBirthdayUser[]
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
  closeBirthdayUser: TelegramWireCloseBirthdayUser
): typeof telegramCloseBirthdayUsers.$inferInsert {
  return {
    birthdate: telegramWireJsonObject(closeBirthdayUser.birthdate),
    userId: String(closeBirthdayUser.user_id)
  };
}
