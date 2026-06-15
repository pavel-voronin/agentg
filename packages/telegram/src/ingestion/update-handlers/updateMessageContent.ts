import { publishMessageUpdated } from '../../events.js';
import { recordMessageContentFiles, replaceMessageContent } from '../../store/message.js';
import { updatedMessagePayload } from '../messagePayloads.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type MessageContentUpdate = UpdateByType<'updateMessageContent'>;

export async function handleUpdateMessageContent(
  update: MessageContentUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const { files } = resources;
  await replaceMessageContent(database, update);
  publishMessageUpdated(events, { message: updatedMessagePayload(update) });
  await recordMessageContentFiles(files, update, 'live_update');
}
