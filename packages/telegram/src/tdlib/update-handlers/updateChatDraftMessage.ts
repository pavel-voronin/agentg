import { replaceTelegramChatPositions, upsertTelegramChatFragment } from '../../store/chat.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatDraftMessageUpdate = TelegramWireUpdateByType<'updateChatDraftMessage'>;

export async function handleUpdateChatDraftMessage(
  update: TelegramWireChatDraftMessageUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const chatId = String(update.chat_id);
  await database.transaction(async (transaction) => {
    await upsertTelegramChatFragment(transaction, {
      draftMessage: telegramWireJsonValue(update.draft_message ?? null) ?? null,
      id: chatId
    });
    await replaceTelegramChatPositions(transaction, chatId, update.positions);
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
