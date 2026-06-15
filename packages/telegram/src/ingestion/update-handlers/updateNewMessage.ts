import { publishMessageCreated } from '../../events.js';
import { recordMessageFiles, storeMessage } from '../../store/message.js';
import { createdMessagePayload } from '../messagePayloads.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type NewMessageUpdate = UpdateByType<'updateNewMessage'>;

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

  publishMessageCreated(events, { message: createdMessagePayload(message) });

  if (message.date > 0) {
    void recordLiveMessage(String(message.chat_id), new Date(message.date * 1000));
  }

  await recordMessageFiles(files, message, 'live_update');
}
