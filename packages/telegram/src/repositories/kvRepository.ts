import type { Database } from '../database/client.js';
import type { KvEntry } from '../domain/models/kvEntry.js';
import { deleteKvEntry, saveKvEntry } from '../storage/kvStorage.js';

export type KvRepository = {
  delete(key: string): Promise<void>;
  save(entry: KvEntry): Promise<void>;
  transaction<T>(operation: (repository: KvRepository) => Promise<T>): Promise<T>;
};

export function createKvRepository(database: Database): KvRepository {
  return {
    delete(key) {
      return deleteKvEntry(database, key);
    },
    save(entry) {
      return saveKvEntry(database, entry);
    },
    transaction(operation) {
      return database.transaction((transaction) => operation(createKvRepository(transaction)));
    }
  };
}
