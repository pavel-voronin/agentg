import type { Database } from '../database/client.js';
import type { ChatPhoto } from '../domain/models/chatPhoto.js';
import type { FileState } from '../domain/models/fileState.js';
import type {
  BasicGroup,
  BasicGroupPatch,
  Supergroup,
  SupergroupPatch
} from '../domain/models/group.js';
import { saveChatPhotos } from '../storage/chatPhotoStorage.js';
import { saveFileStates } from '../storage/fileStorage.js';
import {
  updateExistingSupergroupPatch,
  upsertBasicGroupPatch,
  upsertSupergroup
} from '../storage/groupStorage.js';

export type GroupFullInfo<TGroup extends BasicGroupPatch | SupergroupPatch> = {
  chatPhotos: ChatPhoto[];
  files: FileState[];
  group: TGroup;
};

export type GroupRepository = {
  saveBasicGroup(group: BasicGroup): Promise<void>;
  saveBasicGroupFullInfo(info: GroupFullInfo<BasicGroupPatch>): Promise<void>;
  saveSupergroup(group: Supergroup): Promise<void>;
  saveSupergroupFullInfo(info: GroupFullInfo<SupergroupPatch>): Promise<void>;
  transaction<T>(operation: (repository: GroupRepository) => Promise<T>): Promise<T>;
};

export function createGroupRepository(database: Database): GroupRepository {
  return {
    saveBasicGroup(group) {
      return upsertBasicGroupPatch(database, group);
    },
    saveBasicGroupFullInfo(info) {
      return database.transaction(async (transaction) => {
        await saveFileStates(transaction, info.files);
        await saveChatPhotos(transaction, info.chatPhotos);
        await upsertBasicGroupPatch(transaction, info.group);
      });
    },
    saveSupergroup(group) {
      return upsertSupergroup(database, group);
    },
    saveSupergroupFullInfo(info) {
      return database.transaction(async (transaction) => {
        await saveFileStates(transaction, info.files);
        await saveChatPhotos(transaction, info.chatPhotos);
        const updated = await updateExistingSupergroupPatch(transaction, info.group);
        if (!updated) {
          throw new Error(`Telegram supergroup row was not found: ${info.group.id}`);
        }
      });
    },
    transaction(operation) {
      return database.transaction((transaction) => operation(createGroupRepository(transaction)));
    }
  };
}
