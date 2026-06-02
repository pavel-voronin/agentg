import { eq } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import { telegramFileDownloads } from '../database/schema.js';
import { tdDate } from '../tdlib/value.js';
import type { message as Message } from 'tdlib-types';

type FileDownload = {
  add_date: number;
  complete_date: number;
  file_id: number;
  is_paused: boolean;
  message: Message;
};

export async function upsertTelegramFileDownload(
  database: Database,
  fileDownload: FileDownload
): Promise<void> {
  const row: typeof telegramFileDownloads.$inferInsert = {
    addDate: requiredFileDownloadDate(fileDownload.add_date, 'add_date'),
    completeDate: fileDownloadCompleteDate(fileDownload.complete_date),
    fileId: fileDownload.file_id,
    isPaused: fileDownload.is_paused,
    messageChatId: String(fileDownload.message.chat_id),
    messageId: String(fileDownload.message.id)
  };

  await database.insert(telegramFileDownloads).values(row).onConflictDoUpdate({
    set: row,
    target: telegramFileDownloads.fileId
  });
}

export async function patchTelegramFileDownload(
  database: Database,
  input: {
    completeDate: number;
    fileId: number;
    isPaused: boolean;
  }
): Promise<boolean> {
  const updated = await database
    .update(telegramFileDownloads)
    .set({
      completeDate: fileDownloadCompleteDate(input.completeDate),
      isPaused: input.isPaused
    })
    .where(eq(telegramFileDownloads.fileId, input.fileId))
    .returning({
      fileId: telegramFileDownloads.fileId
    });

  return updated.length > 0;
}

function requiredFileDownloadDate(value: number, fieldName: string): Date {
  const date = tdDate(value);
  if (date === undefined) {
    throw new Error(`Telegram file download has invalid ${fieldName}: ${String(value)}`);
  }
  return date;
}

function fileDownloadCompleteDate(value: number): Date {
  if (value === 0) {
    // The current table uses a non-null timestamp; Unix 0 is the TDLib not-completed sentinel.
    return new Date(0);
  }

  const date = tdDate(value);
  if (date === undefined) {
    throw new Error(`Telegram file download has invalid complete_date: ${String(value)}`);
  }
  return date;
}
