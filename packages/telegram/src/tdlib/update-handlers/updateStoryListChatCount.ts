import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireStoryListChatCountUpdate = TelegramWireUpdateByType<'updateStoryListChatCount'>;

export function handleUpdateStoryListChatCount(
  update: TelegramWireStoryListChatCountUpdate
): Promise<void> {
  const database = useDatabase();
  return upsertTelegramKv(
    database,
    `story_list_chat_count:${update.story_list._}`,
    update.chat_count
  );
}
