import type { Database } from '../database/client.js';
import type { Background } from '../domain/models/background.js';
import type { FileState } from '../domain/models/fileState.js';
import { saveBackgrounds } from '../storage/backgroundStorage.js';
import { saveFileStates } from '../storage/fileStorage.js';

export type BackgroundRepository = {
  save(input: { backgrounds: readonly Background[]; files: readonly FileState[] }): Promise<void>;
  transaction<T>(operation: (repository: BackgroundRepository) => Promise<T>): Promise<T>;
};

export function createBackgroundRepository(database: Database): BackgroundRepository {
  return {
    save(input) {
      return database.transaction(async (transaction) => {
        await saveFileStates(transaction, input.files);
        await saveBackgrounds(transaction, input.backgrounds);
      });
    },
    transaction(operation) {
      return database.transaction((transaction) =>
        operation(createBackgroundRepository(transaction))
      );
    }
  };
}
