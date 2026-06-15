import { replaceMessageReactionSummaries } from '../../store/message.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type MessageReactionsUpdate = UpdateByType<'updateMessageReactions'>;

export async function handleUpdateMessageReactions(
  update: MessageReactionsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);

  await replaceMessageReactionSummaries(database, {
    chatId,
    messageId,
    reactions: update.reactions
  });
}
