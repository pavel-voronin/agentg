import {
  messageContentUpdatedEventInput,
  recordMessageContentFiles,
  replaceMessageContent
} from '../telegram-store/message.js';
import type { TelegramWireMessageContentUpdate } from '../telegramWire.js';
import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';

export async function handleUpdateMessageContent(
  { database, events, files }: TelegramUpdateHandlerContext,
  update: TelegramWireMessageContentUpdate
): Promise<void> {
  await replaceMessageContent(database, update);
  await recordMessageContentFiles(files, update, 'live_update');
  events.publishTelegramMessageUpdated(messageContentUpdatedEventInput(update));
}
