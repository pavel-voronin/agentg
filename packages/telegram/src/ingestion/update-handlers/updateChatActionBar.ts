import { upsertTelegramChatFragment } from '../../store/chat.js';
import { tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type ChatActionBarUpdate = UpdateByType<'updateChatActionBar'>;

export async function handleUpdateChatActionBar(
  update: ChatActionBarUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  await upsertTelegramChatFragment(database, {
    id: String(update.chat_id),
    actionBar: tdJsonValue(update.action_bar ?? null) ?? null
  });
}
