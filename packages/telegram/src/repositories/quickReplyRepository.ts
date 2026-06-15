import type { Database } from '../database/client.js';
import type { QuickReplyMessageState, QuickReplyShortcut } from '../domain/models/quickReply.js';
import {
  deleteQuickReplyShortcut,
  replaceQuickReplyMessageStates,
  saveQuickReplyShortcuts
} from '../storage/quickReplyStorage.js';

export type QuickReplyRepository = {
  deleteShortcut(shortcutId: number): Promise<void>;
  replaceMessages(input: {
    messages: readonly QuickReplyMessageState[];
    shortcutId: number;
  }): Promise<void>;
  saveShortcut(input: {
    firstMessage: QuickReplyMessageState;
    shortcut: QuickReplyShortcut;
  }): Promise<void>;
  transaction<T>(operation: (repository: QuickReplyRepository) => Promise<T>): Promise<T>;
};

export function createQuickReplyRepository(database: Database): QuickReplyRepository {
  return {
    deleteShortcut(shortcutId) {
      return deleteQuickReplyShortcut(database, shortcutId);
    },
    replaceMessages(input) {
      return replaceQuickReplyMessageStates(database, input);
    },
    saveShortcut(input) {
      return saveQuickReplyShortcuts(database, input);
    },
    transaction(operation) {
      return database.transaction((transaction) =>
        operation(createQuickReplyRepository(transaction))
      );
    }
  };
}
