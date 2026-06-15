import type { Database } from '../database/client.js';
import type { Call } from '../domain/models/call.js';
import { saveCall } from '../storage/callStorage.js';

export type CallRepository = {
  save(call: Call): Promise<void>;
  transaction<T>(operation: (repository: CallRepository) => Promise<T>): Promise<T>;
};

export function createCallRepository(database: Database): CallRepository {
  return {
    save(call) {
      return saveCall(database, call);
    },
    transaction(operation) {
      return database.transaction((transaction) => operation(createCallRepository(transaction)));
    }
  };
}
