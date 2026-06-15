import type { Database } from '../database/client.js';
import type { SuggestedAction } from '../domain/models/suggestedAction.js';
import { applySuggestedActionDeltaRecords } from '../storage/suggestedActionStorage.js';

export type SuggestedActionRepository = {
  applyDelta(input: {
    addedActions: readonly SuggestedAction[];
    removedActionKeys: readonly string[];
  }): Promise<void>;
  transaction<T>(operation: (repository: SuggestedActionRepository) => Promise<T>): Promise<T>;
};

export function createSuggestedActionRepository(database: Database): SuggestedActionRepository {
  return {
    applyDelta(input) {
      return applySuggestedActionDeltaRecords(database, input);
    },
    transaction(operation) {
      return database.transaction((transaction) =>
        operation(createSuggestedActionRepository(transaction))
      );
    }
  };
}
