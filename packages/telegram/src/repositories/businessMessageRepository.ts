import type { Database } from '../database/client.js';
import type { BusinessMessageState } from '../domain/models/businessMessage.js';
import {
  deleteBusinessMessageStates,
  saveBusinessMessageState,
  saveNewBusinessMessageState
} from '../storage/businessMessageStorage.js';

export type BusinessMessageRepository = {
  delete(input: { chatId: string; connectionId: string; messageIds: string[] }): Promise<void>;
  save(record: BusinessMessageState): Promise<void>;
  saveNew(record: BusinessMessageState): Promise<boolean>;
};

export function createBusinessMessageRepository(database: Database): BusinessMessageRepository {
  return {
    delete(input) {
      return deleteBusinessMessageStates(database, input);
    },
    save(record) {
      return saveBusinessMessageState(database, record);
    },
    saveNew(record) {
      return saveNewBusinessMessageState(database, record);
    }
  };
}
