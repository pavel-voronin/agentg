import { storeBusinessMessage } from '../../store/businessMessage.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';
import { useFiles } from '../../files/subsystem.js';

type TelegramWireNewBusinessCallbackQueryUpdate =
  TelegramWireUpdateByType<'updateNewBusinessCallbackQuery'>;

export async function handleUpdateNewBusinessCallbackQuery(
  update: TelegramWireNewBusinessCallbackQueryUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const files = useFiles();
  await storeBusinessMessage(database, {
    businessMessage: update.message,
    connectionId: update.connection_id
  });

  await files.recordMessageFiles(update.message.message, 'live_update');

  const replyToMessage = update.message.reply_to_message ?? null;
  if (replyToMessage !== null) {
    await files.recordMessageFiles(replyToMessage, 'live_update');
  }

  events.publishTelegramBusinessCallbackQueryReceived(update);
}
