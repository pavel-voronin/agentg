import type { UpdateByType } from '../updateTypes.js';
import { applyIngestionChanges } from '../../applyChanges.js';
import { contactCloseBirthdaysChanges } from '../state.js';
import type { IngestionResources } from '../../resources.js';

type ContactCloseBirthdaysUpdate = UpdateByType<'updateContactCloseBirthdays'>;

export async function handleUpdateContactCloseBirthdays(
  update: ContactCloseBirthdaysUpdate,
  resources: IngestionResources
): Promise<void> {
  await applyIngestionChanges(resources, contactCloseBirthdaysChanges(update));
}
