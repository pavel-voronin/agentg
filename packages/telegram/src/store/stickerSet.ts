import type { JsonValue } from '@agentg/framework';

import type { Database } from '../database/client.js';
import { telegramStickerSets } from '../database/schema.js';
import { tdJsonValue, type UpdateByType } from '../tdlib/value.js';

type StickerSet = UpdateByType<'updateStickerSet'>['sticker_set'];

export async function upsertStickerSet(database: Database, stickerSet: StickerSet): Promise<void> {
  const row: typeof telegramStickerSets.$inferInsert = {
    emojis: requiredJsonValue(stickerSet.emojis),
    id: stickerSet.id,
    isAllowedAsChatEmojiStatus: stickerSet.is_allowed_as_chat_emoji_status,
    isArchived: stickerSet.is_archived,
    isInstalled: stickerSet.is_installed,
    isOfficial: stickerSet.is_official,
    isOwned: stickerSet.is_owned,
    isViewed: stickerSet.is_viewed,
    name: stickerSet.name,
    needsRepainting: stickerSet.needs_repainting,
    stickerType: requiredJsonValue(stickerSet.sticker_type),
    stickers: requiredJsonValue(stickerSet.stickers),
    thumbnail: requiredJsonValue(stickerSet.thumbnail ?? null),
    thumbnailOutline: requiredJsonValue(stickerSet.thumbnail_outline ?? null),
    title: stickerSet.title
  };

  await database.insert(telegramStickerSets).values(row).onConflictDoUpdate({
    set: row,
    target: telegramStickerSets.id
  });
}

function requiredJsonValue(value: unknown): JsonValue {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
