import { replaceSavedMessagesTags } from '../telegram-store/savedMessages.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireSavedMessagesTagsUpdate = TelegramWireUpdateByType<'updateSavedMessagesTags'>;

export async function handleUpdateSavedMessagesTags(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireSavedMessagesTagsUpdate
): Promise<void> {
  await replaceSavedMessagesTags(database, update);
  events.publishTelegramSavedMessagesTagsUpdated(update);
}
