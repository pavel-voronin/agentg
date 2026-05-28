import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramChatFragment } from '../../store/chat.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';

type TelegramWireChatPermissionsUpdate = TelegramWireUpdateByType<'updateChatPermissions'>;

export async function handleUpdateChatPermissions(
  { database, events }: TelegramUpdateHandlerContext,
  update: TelegramWireChatPermissionsUpdate
): Promise<void> {
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    permissions: telegramWireJsonValue(update.permissions) ?? null
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
