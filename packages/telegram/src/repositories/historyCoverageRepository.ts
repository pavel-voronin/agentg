import type { Database } from '../database/client.js';
import {
  listHistoryCoverage,
  type HistoryCoverageSegment
} from '../storage/historyCoverageStorage.js';
import { countMessageRowsByRanges } from '../storage/messageReadStorage.js';

export type HistoryCoverageReadSegment = HistoryCoverageSegment & {
  messageCount: number;
};

export function createHistoryCoverageRepository(database: Database) {
  return {
    async list(chatId: string): Promise<HistoryCoverageReadSegment[]> {
      const coverage = await listHistoryCoverage(database, chatId);
      const messageCounts = await countMessageRowsByRanges(database, {
        chatId,
        ranges: coverage
      });
      return coverage.map((interval, index) => ({
        ...interval,
        messageCount: messageCounts[index] ?? 0
      }));
    }
  };
}
