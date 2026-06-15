import type { Database } from '../database/client.js';
import type { FileDownloadPatch, FileDownload } from '../domain/models/fileDownload.js';
import {
  deleteFileDownload,
  patchFileDownload,
  saveFileDownload
} from '../storage/fileDownloadStorage.js';

export type FileDownloadRepository = {
  delete(fileId: number): Promise<void>;
  patch(patch: FileDownloadPatch): Promise<boolean>;
  save(download: FileDownload): Promise<void>;
  transaction<T>(operation: (repository: FileDownloadRepository) => Promise<T>): Promise<T>;
};

export function createFileDownloadRepository(database: Database): FileDownloadRepository {
  return {
    delete(fileId) {
      return deleteFileDownload(database, fileId);
    },
    patch(patch) {
      return patchFileDownload(database, patch);
    },
    save(download) {
      return saveFileDownload(database, download);
    },
    transaction(operation) {
      return database.transaction((transaction) =>
        operation(createFileDownloadRepository(transaction))
      );
    }
  };
}
