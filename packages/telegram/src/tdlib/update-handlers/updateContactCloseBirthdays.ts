import { replaceContactCloseBirthdayUsers } from '../../store/contactCloseBirthday.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireContactCloseBirthdaysUpdate =
  TelegramWireUpdateByType<'updateContactCloseBirthdays'>;

export function handleUpdateContactCloseBirthdays(
  update: TelegramWireContactCloseBirthdaysUpdate
): Promise<void> {
  const database = useDatabase();
  return replaceContactCloseBirthdayUsers(database, update.close_birthday_users);
}
