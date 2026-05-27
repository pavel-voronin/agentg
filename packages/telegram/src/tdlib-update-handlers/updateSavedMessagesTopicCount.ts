import type { TelegramUpdateHandlerContext } from '../telegram-update-runtime/context.js';
import { upsertTelegramKv } from '../telegram-store/kv.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';

type TelegramWireSavedMessagesTopicCountUpdate =
  TelegramWireUpdateByType<'updateSavedMessagesTopicCount'>;

export function handleUpdateSavedMessagesTopicCount(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireSavedMessagesTopicCountUpdate
): Promise<void> {
  return upsertTelegramKv(database, 'saved_messages_topic_count', update.topic_count);
}
