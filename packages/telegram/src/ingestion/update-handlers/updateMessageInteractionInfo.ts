import {
  interactionInfoWithoutReactions,
  reactionStateFromInteractionInfo,
  upsertTelegramMessageFragment
} from '../../store/message.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type MessageInteractionInfoUpdate = UpdateByType<'updateMessageInteractionInfo'>;

export async function handleUpdateMessageInteractionInfo(
  update: MessageInteractionInfoUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);

  await upsertTelegramMessageFragment(database, {
    chatId,
    id: messageId,
    interactionInfo: interactionInfoWithoutReactions(update.interaction_info ?? null),
    reactions: reactionStateFromInteractionInfo(update.interaction_info ?? null)
  });

  await events.publishTelegramStoredMessageUpdated({ chatId, messageId });
}
