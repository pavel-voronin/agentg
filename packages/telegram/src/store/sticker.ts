import type { JsonValue } from '@agentg/events/json';

import type { TelegramDatabase } from '../database/client.js';
import { telegramFiles, telegramStickers } from '../database/schema.js';
import {
  telegramWireId,
  telegramWireJsonObject,
  telegramWireJsonValue,
  type TelegramWireFile,
  type TelegramWireUpdateByType
} from '../tdlib/wire.js';

type TelegramWireSticker = TelegramWireUpdateByType<'updateAnimatedEmojiMessageClicked'>['sticker'];

export async function storeSticker(
  database: TelegramDatabase,
  sticker: TelegramWireSticker
): Promise<void> {
  await storeFile(database, sticker.sticker);

  const thumbnail = sticker.thumbnail ?? null;
  if (thumbnail !== null) {
    await storeFile(database, thumbnail.file);
  }

  const row: typeof telegramStickers.$inferInsert = {
    emoji: sticker.emoji,
    fileId: sticker.sticker.id,
    format: telegramWireJsonObject(sticker.format),
    fullType: telegramWireJsonObject(sticker.full_type),
    height: sticker.height,
    id: nullableZeroId(sticker.id),
    setId: nullableZeroId(sticker.set_id),
    thumbnail: requiredTelegramWireJsonValue(thumbnail),
    width: sticker.width
  };

  await database.insert(telegramStickers).values(row).onConflictDoUpdate({
    set: row,
    target: telegramStickers.fileId
  });
}

async function storeFile(database: TelegramDatabase, file: TelegramWireFile): Promise<void> {
  const row: typeof telegramFiles.$inferInsert = {
    expectedSize: String(file.expected_size),
    id: file.id,
    local: telegramWireJsonObject(file.local),
    remote: telegramWireJsonObject(file.remote),
    size: nullablePositiveId(file.size)
  };

  await database.insert(telegramFiles).values(row).onConflictDoUpdate({
    set: row,
    target: telegramFiles.id
  });
}

function nullableZeroId(value: number | string | null | undefined): string | null {
  const id = telegramWireId(value);
  return id === undefined || id === '0' ? null : id;
}

function nullablePositiveId(value: number): string | null {
  return value > 0 ? String(value) : null;
}

function requiredTelegramWireJsonValue(value: unknown): JsonValue {
  const json = telegramWireJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
