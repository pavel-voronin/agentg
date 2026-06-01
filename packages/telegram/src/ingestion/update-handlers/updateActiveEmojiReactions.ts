import { upsertTelegramKv } from '../../store/kv.js';
import type { UpdateByType } from '../types.js';
import type { IngestionResources } from '../resources.js';

type ActiveEmojiReactionsUpdate = UpdateByType<'updateActiveEmojiReactions'>;

export function handleUpdateActiveEmojiReactions(
  update: ActiveEmojiReactionsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  return upsertTelegramKv(database, 'active_emoji_reactions', update.emojis);
}
