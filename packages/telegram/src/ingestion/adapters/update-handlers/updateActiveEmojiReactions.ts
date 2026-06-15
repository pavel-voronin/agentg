import { saveKvEntry } from '../../kv.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type ActiveEmojiReactionsUpdate = UpdateByType<'updateActiveEmojiReactions'>;

export function handleUpdateActiveEmojiReactions(
  update: ActiveEmojiReactionsUpdate,
  resources: IngestionResources
): Promise<void> {
  return saveKvEntry(resources, 'active_emoji_reactions', update.emojis);
}
