import type { JsonValue } from '@agentg/framework';

import type { Database } from '../database/client.js';
import { telegramFiles, telegramStickers } from '../database/schema.js';
import { tdId, tdJsonObject, tdJsonValue, type UpdateByType } from '../tdlib/shape.js';
import type { file as File } from 'tdlib-types';

type Sticker = UpdateByType<'updateAnimatedEmojiMessageClicked'>['sticker'];

export async function storeSticker(database: Database, sticker: Sticker): Promise<void> {
  await storeFile(database, sticker.sticker);

  const thumbnail = sticker.thumbnail ?? null;
  if (thumbnail !== null) {
    await storeFile(database, thumbnail.file);
  }

  const row: typeof telegramStickers.$inferInsert = {
    emoji: sticker.emoji,
    fileId: sticker.sticker.id,
    format: tdJsonObject(sticker.format),
    fullType: tdJsonObject(sticker.full_type),
    height: sticker.height,
    id: nullableZeroId(sticker.id),
    setId: nullableZeroId(sticker.set_id),
    thumbnail: requiredJsonValue(thumbnail),
    width: sticker.width
  };

  await database.insert(telegramStickers).values(row).onConflictDoUpdate({
    set: row,
    target: telegramStickers.fileId
  });
}

async function storeFile(database: Database, file: File): Promise<void> {
  const row: typeof telegramFiles.$inferInsert = {
    expectedSize: String(file.expected_size),
    id: file.id,
    local: tdJsonObject(file.local),
    remote: tdJsonObject(file.remote),
    size: nullablePositiveId(file.size)
  };

  await database.insert(telegramFiles).values(row).onConflictDoUpdate({
    set: row,
    target: telegramFiles.id
  });
}

function nullableZeroId(value: number | string | null | undefined): string | null {
  const id = tdId(value);
  return id === undefined || id === '0' ? null : id;
}

function nullablePositiveId(value: number): string | null {
  return value > 0 ? String(value) : null;
}

function requiredJsonValue(value: unknown): JsonValue {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
