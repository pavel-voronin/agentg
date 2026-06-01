import { recordMessageFiles, storeMessage } from '../../store/message.js';
import type { NewMessageUpdate } from '../types.js';
import type { IngestionResources } from '../resources.js';

export async function handleUpdateNewMessage(
  { message }: NewMessageUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const { files } = resources;
  const { recordLiveMessage } = resources.liveCoverage;
  if (!(await storeMessage(database, message, 'ignore'))) {
    return;
  }

  await recordMessageFiles(files, message, 'live_update');

  if (message.date > 0) {
    void recordLiveMessage(String(message.chat_id), new Date(message.date * 1000));
  }

  await events.publishTelegramMessageCreated(message);
}
