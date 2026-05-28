import type { JsonValue } from '@agentg/events/json';

import type { TelegramDatabase } from '../database.js';
import { telegramFiles } from '../schema.js';
import {
  telegramWireJsonObject,
  telegramWireJsonValue,
  type TelegramWireFile,
  type TelegramWireUpdateByType
} from '../tdlib/wire.js';
import { upsertTelegramChatFragment } from './chat.js';

type TelegramWireChatPhotoUpdate = TelegramWireUpdateByType<'updateChatPhoto'>;
type TelegramWireChatPhotoInfo = NonNullable<TelegramWireChatPhotoUpdate['photo']>;

export async function storeChatPhotoInfo(
  database: TelegramDatabase,
  chatId: string,
  photo: TelegramWireChatPhotoInfo | null
): Promise<void> {
  await database.transaction(async (transaction) => {
    if (photo !== null) {
      await storeFile(transaction, photo.small);
      await storeFile(transaction, photo.big);
    }

    await upsertTelegramChatFragment(transaction, {
      id: chatId,
      photo: chatPhotoInfoValue(photo)
    });
  });
}

function chatPhotoInfoValue(photo: TelegramWireChatPhotoInfo | null): JsonValue {
  if (photo === null) {
    return null;
  }

  return {
    _: 'chatPhotoInfo',
    big: fileReferenceValue(photo.big),
    has_animation: photo.has_animation,
    is_personal: photo.is_personal,
    minithumbnail: telegramWireJsonValue(photo.minithumbnail ?? null) ?? null,
    small: fileReferenceValue(photo.small)
  };
}

function fileReferenceValue(file: TelegramWireFile): JsonValue {
  return {
    _: 'file',
    id: file.id
  };
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

function nullablePositiveId(value: number): string | null {
  return value > 0 ? String(value) : null;
}
