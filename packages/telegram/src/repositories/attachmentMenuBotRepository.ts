import type { Database } from '../database/client.js';
import type { AttachmentMenuBot } from '../domain/models/attachmentMenuBot.js';
import type { FileState } from '../domain/models/fileState.js';
import { replaceAttachmentMenuBots } from '../storage/attachmentMenuBotStorage.js';
import { saveFileStates } from '../storage/fileStorage.js';

export type AttachmentMenuBotRepository = {
  replace(input: {
    bots: readonly AttachmentMenuBot[];
    files: readonly FileState[];
  }): Promise<void>;
  transaction<T>(operation: (repository: AttachmentMenuBotRepository) => Promise<T>): Promise<T>;
};

export function createAttachmentMenuBotRepository(database: Database): AttachmentMenuBotRepository {
  return {
    replace(input) {
      return database.transaction(async (transaction) => {
        await saveFileStates(transaction, input.files);
        await replaceAttachmentMenuBots(transaction, input.bots);
      });
    },
    transaction(operation) {
      return database.transaction((transaction) =>
        operation(createAttachmentMenuBotRepository(transaction))
      );
    }
  };
}
