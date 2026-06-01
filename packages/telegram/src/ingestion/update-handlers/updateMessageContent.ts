import { recordMessageContentFiles, replaceMessageContent } from '../../store/message.js';
import type { MessageContentUpdate } from '../types.js';
import type { IngestionResources } from '../resources.js';

export async function handleUpdateMessageContent(
  update: MessageContentUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const { files } = resources;
  await replaceMessageContent(database, update);
  await recordMessageContentFiles(files, update, 'live_update');
  await events.publishTelegramMessageUpdated(update);
}
