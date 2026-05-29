import { telegramWireId, telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';
import { upsertTelegramChatFragment, type TelegramChatFragment } from '../../store/chat.js';
import { useDatabase } from '../../database/subsystem.js';
import { useUpdateEvents } from '../../events/updateEvents.js';

type TelegramWireChatAccentColorsUpdate = TelegramWireUpdateByType<'updateChatAccentColors'>;

export async function handleUpdateChatAccentColors(
  update: TelegramWireChatAccentColorsUpdate
): Promise<void> {
  const database = useDatabase();
  const events = useUpdateEvents();
  const row: TelegramChatFragment = {
    accentColorId: update.accent_color_id,
    backgroundCustomEmojiId: telegramWireId(update.background_custom_emoji_id),
    id: String(update.chat_id),
    profileAccentColorId: update.profile_accent_color_id,
    profileBackgroundCustomEmojiId: telegramWireId(update.profile_background_custom_emoji_id),
    upgradedGiftColors: telegramWireJsonValue(update.upgraded_gift_colors ?? null)
  };

  await upsertTelegramChatFragment(database, row);
  await events.publishTelegramChatDirectoryUpdated(String(update.chat_id));
}
