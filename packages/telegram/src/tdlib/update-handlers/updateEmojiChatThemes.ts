import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { storeEmojiChatThemes } from '../../store/emojiChatTheme.js';
import type { TelegramWireUpdateByType } from '../wire.js';

type TelegramWireEmojiChatThemesUpdate = TelegramWireUpdateByType<'updateEmojiChatThemes'>;

export async function handleUpdateEmojiChatThemes(
  { database, events, files }: TelegramUpdateHandlerContext,
  update: TelegramWireEmojiChatThemesUpdate
): Promise<void> {
  await storeEmojiChatThemes(database, update.chat_themes);
  await files.recordEmojiChatThemeFiles(update.chat_themes, 'live_update');
  events.publishTelegramEmojiChatThemesUpdated();
}
