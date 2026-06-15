import type { Database } from '../database/client.js';
import { telegramStarRevenueStatuses } from '../database/schema.js';
import type { StarRevenueStatus } from '../domain/models/starRevenue.js';

export async function saveStarRevenueStatus(
  database: Database,
  status: StarRevenueStatus
): Promise<void> {
  await database.insert(telegramStarRevenueStatuses).values(status).onConflictDoUpdate({
    set: status,
    target: telegramStarRevenueStatuses.ownerId
  });
}
