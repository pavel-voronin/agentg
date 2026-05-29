import { storeEmojiChatThemes } from '../../store/emojiChatTheme.js';
import type { TelegramWireUpdateByType } from '../wire.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';
import { useFiles } from '../../files/subsystem.js';

type TelegramWireEmojiChatThemesUpdate = TelegramWireUpdateByType<'updateEmojiChatThemes'>;

export async function handleUpdateEmojiChatThemes(
  update: TelegramWireEmojiChatThemesUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const files = useFiles();
  await storeEmojiChatThemes(database, update.chat_themes);
  await files.recordEmojiChatThemeFiles(update.chat_themes, 'live_update');
  events.publishTelegramEmojiChatThemesUpdated();
}
