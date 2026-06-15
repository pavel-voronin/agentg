import type { Database } from '../database/client.js';
import type { FileState } from '../domain/models/fileState.js';
import type { Sticker, StickerSet } from '../domain/models/sticker.js';
import { saveFileStates } from '../storage/fileStorage.js';
import { saveSticker, saveStickerSet } from '../storage/stickerStorage.js';

export type StickerRepository = {
  save(input: { files: readonly FileState[]; sticker: Sticker }): Promise<void>;
  saveSet(stickerSet: StickerSet): Promise<void>;
  transaction<T>(operation: (repository: StickerRepository) => Promise<T>): Promise<T>;
};

export function createStickerRepository(database: Database): StickerRepository {
  return {
    save(input) {
      return database.transaction(async (transaction) => {
        await saveFileStates(transaction, input.files);
        await saveSticker(transaction, input.sticker);
      });
    },
    saveSet(stickerSet) {
      return saveStickerSet(database, stickerSet);
    },
    transaction(operation) {
      return database.transaction((transaction) => operation(createStickerRepository(transaction)));
    }
  };
}
