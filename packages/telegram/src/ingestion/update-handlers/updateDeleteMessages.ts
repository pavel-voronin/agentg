import { publishMessageDeleted } from '../../events.js';
import { deleteMessages } from '../../store/message.js';
import { deletedMessagesPayload } from '../messagePayloads.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type DeleteMessagesUpdate = UpdateByType<'updateDeleteMessages'>;

export async function handleUpdateDeleteMessages(
  update: DeleteMessagesUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  if (update.from_cache || !update.is_permanent) {
    return;
  }

  const event = { delete: deletedMessagesPayload(update) };
  await deleteMessages(database, {
    chatId: String(update.chat_id),
    messageIds: update.message_ids.map(String)
  });
  publishMessageDeleted(events, event);
}
