import { storeEmojiChatThemes } from '../../store/emojiChatTheme.js';
import type { UpdateByType } from '../../tdlib/shape.js';
import type { IngestionResources } from '../resources.js';

type EmojiChatThemesUpdate = UpdateByType<'updateEmojiChatThemes'>;

export async function handleUpdateEmojiChatThemes(
  update: EmojiChatThemesUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const { files } = resources;
  await storeEmojiChatThemes(database, update.chat_themes);
  await files.recordEmojiChatThemeFiles(update.chat_themes, 'live_update');
}
