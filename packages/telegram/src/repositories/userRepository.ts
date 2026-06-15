import type { Database } from '../database/client.js';
import type { ChatPhoto } from '../domain/models/chatPhoto.js';
import type { FileState } from '../domain/models/fileState.js';
import type { UserState, UserPatch } from '../domain/models/user.js';
import { saveChatPhotos } from '../storage/chatPhotoStorage.js';
import { saveFileStates } from '../storage/fileStorage.js';
import { upsertUserPatch } from '../storage/userStorage.js';

export type UserFullInfo = {
  chatPhotos: ChatPhoto[];
  files: FileState[];
  user: UserPatch;
};

export type UserRepository = {
  save(user: UserState): Promise<void>;
  saveFullInfo(info: UserFullInfo): Promise<void>;
  transaction<T>(operation: (repository: UserRepository) => Promise<T>): Promise<T>;
  upsert(user: UserPatch): Promise<void>;
};

export function createUserRepository(database: Database): UserRepository {
  return {
    save(user) {
      return upsertUserPatch(database, user);
    },
    saveFullInfo(info) {
      return database.transaction(async (transaction) => {
        await saveFileStates(transaction, info.files);
        await saveChatPhotos(transaction, info.chatPhotos);
        await upsertUserPatch(transaction, info.user);
      });
    },
    transaction(operation) {
      return database.transaction((transaction) => operation(createUserRepository(transaction)));
    },
    upsert(user) {
      return upsertUserPatch(database, user);
    }
  };
}
