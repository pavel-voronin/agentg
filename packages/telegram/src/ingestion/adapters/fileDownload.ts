import type {
  DomainChange,
  FileDownloadDeletedChange,
  FileDownloadSavedChange,
  FileDownloadUpdatedChange
} from '../../domain/changes.js';
import type { FileDownloadPatch, FileDownload } from '../../domain/models/fileDownload.js';
import { tdDate, type UpdateByType } from '../../tdlib/shape.js';
import { savedKvEntryChanges } from './kv.js';
import { savedMessageChanges } from './message.js';

type FileAddedToDownloadsUpdate = UpdateByType<'updateFileAddedToDownloads'>;
type FileDownloadUpdate = UpdateByType<'updateFileDownload'>;
type FileRemovedFromDownloadsUpdate = UpdateByType<'updateFileRemovedFromDownloads'>;
type TdlibFileDownload = FileAddedToDownloadsUpdate['file_download'];

export function fileAddedToDownloadsChanges(update: FileAddedToDownloadsUpdate): DomainChange[] {
  return [
    ...savedMessageChanges(update.file_download.message),
    {
      kind: 'fileDownload.saved',
      download: fileDownloadRecord(update.file_download)
    } satisfies FileDownloadSavedChange,
    ...savedKvEntryChanges('downloaded_file_counts', update.counts)
  ];
}

export function fileDownloadChanges(update: FileDownloadUpdate): DomainChange[] {
  return [
    {
      kind: 'fileDownload.updated',
      patch: fileDownloadPatch(update)
    } satisfies FileDownloadUpdatedChange,
    ...savedKvEntryChanges('downloaded_file_counts', update.counts)
  ];
}

export function fileRemovedFromDownloadsChanges(
  update: FileRemovedFromDownloadsUpdate
): DomainChange[] {
  return [
    {
      kind: 'fileDownload.deleted',
      fileId: update.file_id
    } satisfies FileDownloadDeletedChange,
    ...savedKvEntryChanges('downloaded_file_counts', update.counts)
  ];
}

function fileDownloadRecord(download: TdlibFileDownload): FileDownload {
  return {
    addDate: requiredFileDownloadDate(download.add_date, 'add_date'),
    completeDate: fileDownloadCompleteDate(download.complete_date),
    fileId: download.file_id,
    isPaused: download.is_paused,
    messageChatId: String(download.message.chat_id),
    messageId: String(download.message.id)
  };
}

function fileDownloadPatch(update: FileDownloadUpdate): FileDownloadPatch {
  return {
    completeDate: fileDownloadCompleteDate(update.complete_date),
    fileId: update.file_id,
    isPaused: update.is_paused
  };
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
    return new Date(0);
  }

  const date = tdDate(value);
  if (date === undefined) {
    throw new Error(`Telegram file download has invalid complete_date: ${String(value)}`);
  }
  return date;
}
