import { applyIngestionChanges } from '../../applyChanges.js';
import { emojiChatThemesChanges } from '../background.js';
import { emojiChatThemeFileSlots } from '../fileSlot.js';
import type { UpdateByType } from '../updateTypes.js';
import type { IngestionResources } from '../../resources.js';

type EmojiChatThemesUpdate = UpdateByType<'updateEmojiChatThemes'>;

export async function handleUpdateEmojiChatThemes(
  update: EmojiChatThemesUpdate,
  resources: IngestionResources
): Promise<void> {
  const { files } = resources;
  await applyIngestionChanges(resources, emojiChatThemesChanges(update));
  await files.recordFileSlots(emojiChatThemeFileSlots(update.chat_themes), 'live_update');
}
