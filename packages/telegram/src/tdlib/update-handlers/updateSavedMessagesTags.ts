import { replaceSavedMessagesTags } from '../../store/savedMessages.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireSavedMessagesTagsUpdate = TelegramWireUpdateByType<'updateSavedMessagesTags'>;

export async function handleUpdateSavedMessagesTags(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireSavedMessagesTagsUpdate
): Promise<void> {
  await replaceSavedMessagesTags(database, update);
  events.publishTelegramSavedMessagesTagsUpdated(update);
}
