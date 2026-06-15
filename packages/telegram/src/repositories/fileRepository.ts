import type { Database } from '../database/client.js';
import type { FileState } from '../domain/models/fileState.js';
import { saveFileStates } from '../storage/fileStorage.js';

export type FileRepository = {
  saveMany(files: readonly FileState[]): Promise<void>;
  transaction<T>(operation: (repository: FileRepository) => Promise<T>): Promise<T>;
};

export function createFileRepository(database: Database): FileRepository {
  return {
    saveMany(files) {
      return saveFileStates(database, files);
    },
    transaction(operation) {
      return database.transaction((transaction) => operation(createFileRepository(transaction)));
    }
  };
}
