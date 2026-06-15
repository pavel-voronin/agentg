import { replaceContactCloseBirthdayUsers } from '../../store/contactCloseBirthday.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type ContactCloseBirthdaysUpdate = UpdateByType<'updateContactCloseBirthdays'>;

export function handleUpdateContactCloseBirthdays(
  update: ContactCloseBirthdaysUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  return replaceContactCloseBirthdayUsers(database, update.close_birthday_users);
}
