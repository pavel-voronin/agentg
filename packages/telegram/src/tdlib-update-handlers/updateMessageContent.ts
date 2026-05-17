import {
  messageContentUpdatedEventInput,
  recordMessageContentFiles,
  replaceMessageContent
} from '../telegram-store/Message.js';
import type { TelegramWireMessageContentUpdate } from '../telegram-wire.js';
import type { TelegramUpdateHandlerContext } from './context.js';

export async function handleUpdateMessageContent(
  { database, events, files }: TelegramUpdateHandlerContext,
  update: TelegramWireMessageContentUpdate
): Promise<void> {
  await replaceMessageContent(database, update);
  await recordMessageContentFiles(files, update, 'live_update');
  events.publishTelegramMessageUpdated(messageContentUpdatedEventInput(update));
}
