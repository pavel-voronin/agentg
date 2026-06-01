import { storeBusinessMessage } from '../../store/businessMessage.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type NewBusinessCallbackQueryUpdate = UpdateByType<'updateNewBusinessCallbackQuery'>;

export async function handleUpdateNewBusinessCallbackQuery(
  update: NewBusinessCallbackQueryUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const { files } = resources;
  await storeBusinessMessage(database, {
    businessMessage: update.message,
    connectionId: update.connection_id
  });

  await files.recordMessageFiles(update.message.message, 'live_update');

  const replyToMessage = update.message.reply_to_message ?? null;
  if (replyToMessage !== null) {
    await files.recordMessageFiles(replyToMessage, 'live_update');
  }

  await events.publishTelegramBusinessCallbackQueryReceived(update);
}
