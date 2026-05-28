import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireStoryListChatCountUpdate = TelegramWireUpdateByType<'updateStoryListChatCount'>;

export function handleUpdateStoryListChatCount(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireStoryListChatCountUpdate
): Promise<void> {
  return upsertTelegramKv(
    database,
    `story_list_chat_count:${update.story_list._}`,
    update.chat_count
  );
}
