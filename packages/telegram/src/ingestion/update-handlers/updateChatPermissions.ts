import { upsertTelegramChatFragment } from '../../store/chat.js';
import { tdJsonValue, type UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ChatPermissionsUpdate = UpdateByType<'updateChatPermissions'>;

export async function handleUpdateChatPermissions(
  update: ChatPermissionsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  const chatId = String(update.chat_id);
  await upsertTelegramChatFragment(database, {
    id: chatId,
    permissions: tdJsonValue(update.permissions) ?? null
  });
  await events.publishTelegramChatDirectoryUpdated(chatId);
}
