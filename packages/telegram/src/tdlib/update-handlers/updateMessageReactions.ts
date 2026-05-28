import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { replaceMessageReactionSummaries } from '../../store/message.js';
import type { TelegramWireUpdateByType } from '../wire.js';

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
