import { upsertTelegramKv } from '../../store/kv.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';

type TelegramWireActiveEmojiReactionsUpdate =
  TelegramWireUpdateByType<'updateActiveEmojiReactions'>;

export function handleUpdateActiveEmojiReactions(
  update: TelegramWireActiveEmojiReactionsUpdate
): Promise<void> {
  const database = useDatabase();
  return upsertTelegramKv(database, 'active_emoji_reactions', update.emojis);
}
