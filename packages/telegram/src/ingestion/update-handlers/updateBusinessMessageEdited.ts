import { publishMessageUpdated } from '../../events.js';
import { storeBusinessMessage } from '../../store/businessMessage.js';
import { updatedBusinessMessagePayload } from '../messagePayloads.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type BusinessMessageEditedUpdate = UpdateByType<'updateBusinessMessageEdited'>;

export async function handleUpdateBusinessMessageEdited(
  update: BusinessMessageEditedUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const { files } = resources;
  await storeBusinessMessage(database, {
    businessMessage: update.message,
    connectionId: update.connection_id
  });

  publishMessageUpdated(events, {
    message: updatedBusinessMessagePayload(update.message.message)
  });
  await files.recordMessageFiles(update.message.message, 'live_update');

  const replyToMessage = update.message.reply_to_message ?? null;
  if (replyToMessage !== null) {
    await files.recordMessageFiles(replyToMessage, 'live_update');
  }
}
