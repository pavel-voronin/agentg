import type { historySyncClient } from '../../src/index.js';
import { HISTORY_SYNC_DASHBOARD_METHODS } from '../contracts.js';

type HistorySyncDashboardClient = Pick<
  ReturnType<typeof historySyncClient>,
  'deleteTarget' | 'getChatHistorySyncState' | 'upsertTarget'
>;

type Resources = {
  historySync: HistorySyncDashboardClient;
};

export function createProcedures(
  resources: Resources
): Record<string, (input: unknown) => Promise<unknown>> {
  return {
    [HISTORY_SYNC_DASHBOARD_METHODS.deleteTarget]: (input) =>
      resources.historySync.deleteTarget(input),
    [HISTORY_SYNC_DASHBOARD_METHODS.getChatHistorySyncState]: (input) =>
      resources.historySync.getChatHistorySyncState(input),
    [HISTORY_SYNC_DASHBOARD_METHODS.upsertTarget]: (input) =>
      resources.historySync.upsertTarget(input)
  };
}
