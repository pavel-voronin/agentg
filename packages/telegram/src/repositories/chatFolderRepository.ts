import type { Database } from '../database/client.js';
import type { ChatFolderInfo } from '../domain/models/chatFolder.js';
import { readKnownChatFolderIds, replaceChatFolderInfos } from '../storage/chatFolderStorage.js';

export type ChatFolderRepository = {
  listKnownFolderIds(): Promise<number[]>;
  replace(folders: readonly ChatFolderInfo[]): Promise<void>;
  transaction<T>(operation: (repository: ChatFolderRepository) => Promise<T>): Promise<T>;
};

export function createChatFolderRepository(database: Database): ChatFolderRepository {
  return {
    listKnownFolderIds() {
      return readKnownChatFolderIds(database);
    },
    replace(folders) {
      return replaceChatFolderInfos(database, folders);
    },
    transaction(operation) {
      return database.transaction((transaction) =>
        operation(createChatFolderRepository(transaction))
      );
    }
  };
}
