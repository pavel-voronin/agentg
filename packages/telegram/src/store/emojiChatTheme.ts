import type { Database } from '../database/client.js';
import { type UpdateByType } from '../tdlib/shape.js';
import { storeTelegramBackground } from './chatBackground.js';
import { upsertTelegramKv } from './kv.js';

export const TELEGRAM_EMOJI_CHAT_THEMES_KV_KEY = 'emoji_chat_themes';

type EmojiChatTheme = UpdateByType<'updateEmojiChatThemes'>['chat_themes'][number];
type ThemeSettings = EmojiChatTheme['light_settings'];
type Background = NonNullable<ThemeSettings['background']>;

export async function storeEmojiChatThemes(
  database: Database,
  themes: EmojiChatTheme[]
): Promise<void> {
  await database.transaction(async (transaction) => {
    const storedBackgroundIds = new Set<string>();

    for (const background of themeBackgrounds(themes)) {
      const backgroundId = background.id;
      if (storedBackgroundIds.has(backgroundId)) {
        continue;
      }
      storedBackgroundIds.add(backgroundId);
      await storeTelegramBackground(transaction, background);
    }

    await upsertTelegramKv(transaction, TELEGRAM_EMOJI_CHAT_THEMES_KV_KEY, themes);
  });
}

function* themeBackgrounds(themes: EmojiChatTheme[]): Generator<Background> {
  for (const theme of themes) {
    const lightBackground = theme.light_settings.background ?? null;
    if (lightBackground !== null) {
      yield lightBackground;
    }

    const darkBackground = theme.dark_settings.background ?? null;
    if (darkBackground !== null) {
      yield darkBackground;
    }
  }
}
