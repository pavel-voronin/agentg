import { recordMessageContentFiles, replaceMessageContent } from '../../store/message.js';
import type { TelegramWireMessageContentUpdate } from '../wire.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';

export async function handleUpdateMessageContent(
  { database, events, files }: TelegramUpdateHandlerContext,
  update: TelegramWireMessageContentUpdate
): Promise<void> {
  await replaceMessageContent(database, update);
  await recordMessageContentFiles(files, update, 'live_update');
  events.publishTelegramMessageUpdated(update);
}
