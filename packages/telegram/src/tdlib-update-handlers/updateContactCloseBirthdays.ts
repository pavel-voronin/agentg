import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { replaceContactCloseBirthdayUsers } from '../telegram-store/contactCloseBirthday.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireContactCloseBirthdaysUpdate =
  TelegramWireUpdateByType<'updateContactCloseBirthdays'>;

export function handleUpdateContactCloseBirthdays(
  context: TelegramUpdateHandlerContext,
  update: TelegramWireContactCloseBirthdaysUpdate
): Promise<void> {
  return replaceContactCloseBirthdayUsers(context.database, update.close_birthday_users);
}
