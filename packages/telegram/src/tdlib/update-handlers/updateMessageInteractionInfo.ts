import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';
import {
  replaceMessageReactionSummaries,
  upsertTelegramMessageFragment
} from '../../store/message.js';

type TelegramWireMessageInteractionInfoUpdate =
  TelegramWireUpdateByType<'updateMessageInteractionInfo'>;

export async function handleUpdateMessageInteractionInfo(
  update: TelegramWireMessageInteractionInfoUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  const messageId = String(update.message_id);

  await upsertTelegramMessageFragment(database, {
    chatId,
    id: messageId,
    interactionInfo: telegramWireJsonValue(update.interaction_info ?? null)
  });

  await replaceMessageReactionSummaries(database, {
    chatId,
    messageId,
    reactions: update.interaction_info?.reactions?.reactions ?? []
  });

  await events.publishTelegramStoredMessageUpdated({ chatId, messageId });
}
