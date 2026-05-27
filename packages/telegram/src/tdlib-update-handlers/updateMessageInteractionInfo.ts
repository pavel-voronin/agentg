import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../telegramWire.js';
import {
  replaceMessageReactionSummaries,
  upsertTelegramMessageFragment
} from '../telegram-store/message.js';

type TelegramWireMessageInteractionInfoUpdate =
  TelegramWireUpdateByType<'updateMessageInteractionInfo'>;

export async function handleUpdateMessageInteractionInfo(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireMessageInteractionInfoUpdate
): Promise<void> {
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
