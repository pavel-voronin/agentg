import { upsertTelegramMessageFragment } from '../../store/message.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireMessageIsPinnedUpdate = TelegramWireUpdateByType<'updateMessageIsPinned'>;

export async function handleUpdateMessageIsPinned(
  update: TelegramWireMessageIsPinnedUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);

  await upsertTelegramMessageFragment(database, {
    chatId,
    id: messageId,
    isPinned: update.is_pinned
  });

  await events.publishTelegramStoredMessageUpdated({ chatId, messageId });
}
