import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireSavedMessagesTopicCountUpdate =
  TelegramWireUpdateByType<'updateSavedMessagesTopicCount'>;

export function handleUpdateSavedMessagesTopicCount(
  update: TelegramWireSavedMessagesTopicCountUpdate
): Promise<void> {
  const database = useDatabase();
  return upsertTelegramKv(database, 'saved_messages_topic_count', update.topic_count);
}
