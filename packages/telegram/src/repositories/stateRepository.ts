import type { Database } from '../database/client.js';
import type {
  ChatActiveStories,
  ChatBoost,
  ChatRevenueAmount,
  ContactCloseBirthday,
  FileGenerationRequest,
  TextCompositionStyle
} from '../domain/models/state.js';
import {
  deleteFileGenerationRequest,
  replaceContactCloseBirthdays,
  replaceTextCompositionStyles,
  saveChatActiveStories,
  saveChatBoost,
  saveChatRevenueAmount,
  saveFileGenerationRequest
} from '../storage/stateStorage.js';

export type StateRepository = {
  deleteFileGenerationRequest(generationId: string): Promise<void>;
  replaceContactCloseBirthdays(records: readonly ContactCloseBirthday[]): Promise<void>;
  replaceTextCompositionStyles(records: readonly TextCompositionStyle[]): Promise<void>;
  saveChatActiveStories(record: ChatActiveStories): Promise<void>;
  saveChatBoost(record: ChatBoost): Promise<void>;
  saveChatRevenueAmount(record: ChatRevenueAmount): Promise<void>;
  saveFileGenerationRequest(record: FileGenerationRequest): Promise<void>;
  transaction<T>(operation: (repository: StateRepository) => Promise<T>): Promise<T>;
};

export function createStateRepository(database: Database): StateRepository {
  return {
    deleteFileGenerationRequest(generationId) {
      return deleteFileGenerationRequest(database, generationId);
    },
    replaceContactCloseBirthdays(records) {
      return replaceContactCloseBirthdays(database, records);
    },
    replaceTextCompositionStyles(records) {
      return replaceTextCompositionStyles(database, records);
    },
    saveChatActiveStories(record) {
      return saveChatActiveStories(database, record);
    },
    saveChatBoost(record) {
      return saveChatBoost(database, record);
    },
    saveChatRevenueAmount(record) {
      return saveChatRevenueAmount(database, record);
    },
    saveFileGenerationRequest(record) {
      return saveFileGenerationRequest(database, record);
    },
    transaction(operation) {
      return database.transaction((transaction) => operation(createStateRepository(transaction)));
    }
  };
}
