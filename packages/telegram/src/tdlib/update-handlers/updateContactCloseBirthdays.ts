import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { replaceContactCloseBirthdayUsers } from '../../store/contactCloseBirthday.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireContactCloseBirthdaysUpdate =
  TelegramWireUpdateByType<'updateContactCloseBirthdays'>;

export function handleUpdateContactCloseBirthdays(
  context: TelegramUpdateHandlerContext,
  update: TelegramWireContactCloseBirthdaysUpdate
): Promise<void> {
  return replaceContactCloseBirthdayUsers(context.database, update.close_birthday_users);
}
