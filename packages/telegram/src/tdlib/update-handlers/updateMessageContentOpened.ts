import { patchOpenedMessageContent } from '../../store/message.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireMessageContentOpenedUpdate =
  TelegramWireUpdateByType<'updateMessageContentOpened'>;

export async function handleUpdateMessageContentOpened(
  update: TelegramWireMessageContentOpenedUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);
  const changed = await patchOpenedMessageContent(database, { chatId, messageId });

  if (!changed) {
    return;
  }

  await events.publishTelegramStoredMessageUpdated({ chatId, messageId });
}
