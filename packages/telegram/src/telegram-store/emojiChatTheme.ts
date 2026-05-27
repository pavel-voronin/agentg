import type { TelegramDatabase } from '../database.js';
import type { TelegramWireUpdateByType } from '../telegramWire.js';
import { storeTelegramBackground } from './chatBackground.js';
import { upsertTelegramKv } from './kv.js';

export const TELEGRAM_EMOJI_CHAT_THEMES_KV_KEY = 'emoji_chat_themes';

type TelegramWireEmojiChatTheme =
  TelegramWireUpdateByType<'updateEmojiChatThemes'>['chat_themes'][number];
type TelegramWireThemeSettings = TelegramWireEmojiChatTheme['light_settings'];
type TelegramWireBackground = NonNullable<TelegramWireThemeSettings['background']>;

export async function storeEmojiChatThemes(
  database: TelegramDatabase,
  themes: TelegramWireEmojiChatTheme[]
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

function* themeBackgrounds(
  themes: TelegramWireEmojiChatTheme[]
): Generator<TelegramWireBackground> {
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
