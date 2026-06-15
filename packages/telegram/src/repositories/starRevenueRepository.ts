import type { Database } from '../database/client.js';
import type { StarRevenueStatus } from '../domain/models/starRevenue.js';
import { saveStarRevenueStatus } from '../storage/starRevenueStorage.js';

export type StarRevenueRepository = {
  save(status: StarRevenueStatus): Promise<void>;
  transaction<T>(operation: (repository: StarRevenueRepository) => Promise<T>): Promise<T>;
};

export function createStarRevenueRepository(database: Database): StarRevenueRepository {
  return {
    save(status) {
      return saveStarRevenueStatus(database, status);
    },
    transaction(operation) {
      return database.transaction((transaction) =>
        operation(createStarRevenueRepository(transaction))
      );
    }
  };
}
