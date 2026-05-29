import { recordMessageContentFiles, replaceMessageContent } from '../../store/message.js';
import type { TelegramWireMessageContentUpdate } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';
import { useFiles } from '../../files/subsystem.js';

export async function handleUpdateMessageContent(
  update: TelegramWireMessageContentUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const files = useFiles();
  await replaceMessageContent(database, update);
  await recordMessageContentFiles(files, update, 'live_update');
  events.publishTelegramMessageUpdated(update);
}
