import { patchOpenedMessageContent } from '../../store/message.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type MessageContentOpenedUpdate = UpdateByType<'updateMessageContentOpened'>;

export async function handleUpdateMessageContentOpened(
  update: MessageContentOpenedUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);
  const changed = await patchOpenedMessageContent(database, { chatId, messageId });

  if (!changed) {
    return;
  }

  await events.publishTelegramStoredMessageUpdated({ chatId, messageId });
}
