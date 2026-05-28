import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireSavedMessagesTopicCountUpdate =
  TelegramWireUpdateByType<'updateSavedMessagesTopicCount'>;

export function handleUpdateSavedMessagesTopicCount(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireSavedMessagesTopicCountUpdate
): Promise<void> {
  return upsertTelegramKv(database, 'saved_messages_topic_count', update.topic_count);
}
