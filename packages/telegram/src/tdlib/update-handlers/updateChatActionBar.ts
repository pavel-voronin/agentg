import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramChatFragment } from '../../store/chat.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';

type TelegramWireChatActionBarUpdate = TelegramWireUpdateByType<'updateChatActionBar'>;

export async function handleUpdateChatActionBar(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatActionBarUpdate
): Promise<void> {
  await upsertTelegramChatFragment(database, {
    id: String(update.chat_id),
    actionBar: telegramWireJsonValue(update.action_bar ?? null) ?? null
  });
  await events.publishTelegramChatDirectoryUpdated(String(update.chat_id));
}
