import { storeBusinessMessage } from '../telegram-store/businessMessage.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireNewBusinessCallbackQueryUpdate =
  TelegramWireUpdateByType<'updateNewBusinessCallbackQuery'>;

export async function handleUpdateNewBusinessCallbackQuery(
  { database, events, files }: TelegramUpdateHandlerContext,
  update: TelegramWireNewBusinessCallbackQueryUpdate
): Promise<void> {
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
