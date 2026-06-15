import { upsertTelegramMessageFragment } from '../../store/message.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type MessageIsPinnedUpdate = UpdateByType<'updateMessageIsPinned'>;

export async function handleUpdateMessageIsPinned(
  update: MessageIsPinnedUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);

  await upsertTelegramMessageFragment(database, {
    chatId,
    id: messageId,
    isPinned: update.is_pinned
  });
}
