import type { Database } from '../database/client.js';
import { telegramChatPhotos } from '../database/schema.js';
import type { ChatPhoto } from '../domain/models/chatPhoto.js';

export type ChatPhotoStorageRow = typeof telegramChatPhotos.$inferInsert;

export async function saveChatPhotos(
  database: Database,
  photos: readonly ChatPhoto[]
): Promise<void> {
  const rows = uniqueChatPhotoStorageRows(photos);
  for (const row of rows) {
    await database.insert(telegramChatPhotos).values(row).onConflictDoUpdate({
      set: row,
      target: telegramChatPhotos.id
    });
  }
}

function chatPhotoStorageRow(photo: ChatPhoto): ChatPhotoStorageRow {
  return photo;
}

function uniqueChatPhotoStorageRows(photos: readonly ChatPhoto[]): ChatPhotoStorageRow[] {
  const rowsById = new Map<string, ChatPhotoStorageRow>();
  for (const photo of photos) {
    rowsById.set(photo.id, chatPhotoStorageRow(photo));
  }
  return [...rowsById.values()];
}
