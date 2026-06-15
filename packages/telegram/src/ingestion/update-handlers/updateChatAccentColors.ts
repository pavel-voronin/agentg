import { tdId, tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';
import { upsertTelegramChatFragment, type TelegramChatFragment } from '../../store/chat.js';
import type { IngestionResources } from '../resources.js';

type ChatAccentColorsUpdate = UpdateByType<'updateChatAccentColors'>;

export async function handleUpdateChatAccentColors(
  update: ChatAccentColorsUpdate,
  resources: IngestionResources
): Promise<void> {
  const { database } = resources;
  const row: TelegramChatFragment = {
    accentColorId: update.accent_color_id,
    backgroundCustomEmojiId: tdId(update.background_custom_emoji_id),
    id: String(update.chat_id),
    profileAccentColorId: update.profile_accent_color_id,
    profileBackgroundCustomEmojiId: tdId(update.profile_background_custom_emoji_id),
    upgradedGiftColors: tdJsonValue(update.upgraded_gift_colors ?? null)
  };

  await upsertTelegramChatFragment(database, row);
}
