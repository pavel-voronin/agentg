import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramKv } from '../telegram-store/kv.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

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
