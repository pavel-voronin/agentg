import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { replaceMessageReactionSummaries } from '../telegram-store/message.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireMessageReactionsUpdate = TelegramWireUpdateByType<'updateMessageReactions'>;

export async function handleUpdateMessageReactions(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireMessageReactionsUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);

  await replaceMessageReactionSummaries(database, {
    chatId,
    messageId,
    reactions: update.reactions
  });

  await events.publishTelegramStoredMessageUpdated({ chatId, messageId });
}
