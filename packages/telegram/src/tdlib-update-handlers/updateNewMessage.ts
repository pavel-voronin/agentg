import { recordMessageFiles, storeMessage } from '../telegram-store/message.js';
import type { TelegramWireNewMessageUpdate } from '../telegramWire.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';

export async function handleUpdateNewMessage(
  { database, files, liveCoverageObserver, events }: TelegramUpdateHandlerContext,
  { message }: TelegramWireNewMessageUpdate
): Promise<void> {
  if (!(await storeMessage(database, message, 'ignore'))) {
    return;
  }

  await recordMessageFiles(files, message, 'live_update');

  if (message.date > 0) {
    void liveCoverageObserver.recordLiveMessage(
      String(message.chat_id),
      new Date(message.date * 1000)
    );
  }

  events.publishTelegramMessageCreated(message);
}
