import type { JsonValue } from '@agentg/framework';

import type { Database } from '../database/client.js';
import { telegramFiles } from '../database/schema.js';
import { tdJsonObject, tdJsonValue, type UpdateByType } from '../tdlib/value.js';
import type { file as File } from 'tdlib-types';
import { upsertTelegramChatFragment } from './chat.js';

type ChatPhotoUpdate = UpdateByType<'updateChatPhoto'>;
type ChatPhotoInfo = NonNullable<ChatPhotoUpdate['photo']>;

export async function storeChatPhotoInfo(
  database: Database,
  chatId: string,
  photo: ChatPhotoInfo | null
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

function chatPhotoInfoValue(photo: ChatPhotoInfo | null): JsonValue {
  if (photo === null) {
    return null;
  }

  return {
    _: 'chatPhotoInfo',
    big: fileReferenceValue(photo.big),
    has_animation: photo.has_animation,
    is_personal: photo.is_personal,
    minithumbnail: tdJsonValue(photo.minithumbnail ?? null) ?? null,
    small: fileReferenceValue(photo.small)
  };
}

function fileReferenceValue(file: File): JsonValue {
  return {
    _: 'file',
    id: file.id
  };
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

function nullablePositiveId(value: number): string | null {
  return value > 0 ? String(value) : null;
}
