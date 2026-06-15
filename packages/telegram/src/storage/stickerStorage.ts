import type { Database } from '../database/client.js';
import { telegramStickers, telegramStickerSets } from '../database/schema.js';
import type { Sticker, StickerSet } from '../domain/models/sticker.js';

export async function saveSticker(database: Database, sticker: Sticker): Promise<void> {
  await database.insert(telegramStickers).values(sticker).onConflictDoUpdate({
    set: sticker,
    target: telegramStickers.fileId
  });
}

export async function saveStickerSet(database: Database, stickerSet: StickerSet): Promise<void> {
  await database.insert(telegramStickerSets).values(stickerSet).onConflictDoUpdate({
    set: stickerSet,
    target: telegramStickerSets.id
  });
}
