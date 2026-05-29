import { replaceSavedMessagesTags } from '../../store/savedMessages.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireSavedMessagesTagsUpdate = TelegramWireUpdateByType<'updateSavedMessagesTags'>;

export async function handleUpdateSavedMessagesTags(
  update: TelegramWireSavedMessagesTagsUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  await replaceSavedMessagesTags(database, update);
  events.publishTelegramSavedMessagesTagsUpdated(update);
}
