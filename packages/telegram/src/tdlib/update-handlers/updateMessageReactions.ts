import { replaceMessageReactionSummaries } from '../../store/message.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireMessageReactionsUpdate = TelegramWireUpdateByType<'updateMessageReactions'>;

export async function handleUpdateMessageReactions(
  update: TelegramWireMessageReactionsUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);

  await replaceMessageReactionSummaries(database, {
    chatId,
    messageId,
    reactions: update.reactions
  });

  await events.publishTelegramStoredMessageUpdated({ chatId, messageId });
}
