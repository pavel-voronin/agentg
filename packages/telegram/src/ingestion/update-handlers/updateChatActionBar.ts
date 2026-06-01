import { upsertTelegramChatFragment } from '../../store/chat.js';
import { tdJsonValue, type UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ChatActionBarUpdate = UpdateByType<'updateChatActionBar'>;

export async function handleUpdateChatActionBar(
  update: ChatActionBarUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { events } = resources;
  await upsertTelegramChatFragment(database, {
    id: String(update.chat_id),
    actionBar: tdJsonValue(update.action_bar ?? null) ?? null
  });
  await events.publishTelegramChatDirectoryUpdated(String(update.chat_id));
}
