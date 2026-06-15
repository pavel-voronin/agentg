import type { Database } from '../database/client.js';
import type { BusinessConnection } from '../domain/models/businessConnection.js';
import { saveBusinessConnection } from '../storage/businessConnectionStorage.js';

export type BusinessConnectionRepository = {
  save(connection: BusinessConnection): Promise<void>;
  transaction<T>(operation: (repository: BusinessConnectionRepository) => Promise<T>): Promise<T>;
};

export function createBusinessConnectionRepository(
  database: Database
): BusinessConnectionRepository {
  return {
    save(connection) {
      return saveBusinessConnection(database, connection);
    },
    transaction(operation) {
      return database.transaction((transaction) =>
        operation(createBusinessConnectionRepository(transaction))
      );
    }
  };
}
