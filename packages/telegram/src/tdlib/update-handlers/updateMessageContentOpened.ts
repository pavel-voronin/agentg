import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { patchOpenedMessageContent } from '../../store/message.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireMessageContentOpenedUpdate =
  TelegramWireUpdateByType<'updateMessageContentOpened'>;

export async function handleUpdateMessageContentOpened(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireMessageContentOpenedUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);
  const changed = await patchOpenedMessageContent(database, { chatId, messageId });

  if (!changed) {
    return;
  }

  await events.publishTelegramStoredMessageUpdated({ chatId, messageId });
}
