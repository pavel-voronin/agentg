import type { JsonValue } from '@agentg/events/json';

import type { TelegramDatabase } from '../database.js';
import { telegramStickerSets } from '../schema.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../tdlib/wire.js';

type TelegramWireStickerSet = TelegramWireUpdateByType<'updateStickerSet'>['sticker_set'];

export async function upsertStickerSet(
  database: TelegramDatabase,
  stickerSet: TelegramWireStickerSet
): Promise<void> {
  const row: typeof telegramStickerSets.$inferInsert = {
    emojis: requiredTelegramWireJsonValue(stickerSet.emojis),
    id: stickerSet.id,
    isAllowedAsChatEmojiStatus: stickerSet.is_allowed_as_chat_emoji_status,
    isArchived: stickerSet.is_archived,
    isInstalled: stickerSet.is_installed,
    isOfficial: stickerSet.is_official,
    isOwned: stickerSet.is_owned,
    isViewed: stickerSet.is_viewed,
    name: stickerSet.name,
    needsRepainting: stickerSet.needs_repainting,
    stickerType: requiredTelegramWireJsonValue(stickerSet.sticker_type),
    stickers: requiredTelegramWireJsonValue(stickerSet.stickers),
    thumbnail: requiredTelegramWireJsonValue(stickerSet.thumbnail ?? null),
    thumbnailOutline: requiredTelegramWireJsonValue(stickerSet.thumbnail_outline ?? null),
    title: stickerSet.title
  };

  await database.insert(telegramStickerSets).values(row).onConflictDoUpdate({
    set: row,
    target: telegramStickerSets.id
  });
}

function requiredTelegramWireJsonValue(value: unknown): JsonValue {
  const json = telegramWireJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
