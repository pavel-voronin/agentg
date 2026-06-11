import { useDashboardHost } from '@agentg/framework/dashboard';

import { HISTORY_SYNC_DASHBOARD_METHODS } from '../contracts.js';
import type { HistorySyncRange, HistorySyncTarget, SelectedHistorySyncState } from './views.js';

type TargetMutationOutput = {
  deleted: boolean;
  target?: HistorySyncTarget | undefined;
  upserted: boolean;
};

type UpsertTargetInput = {
  chatId: string;
  end?: string | undefined;
  preset?: string | undefined;
  range?: HistorySyncRange | undefined;
  start?: string | undefined;
  targetId?: string | undefined;
};

export function useHistorySyncDashboardApi() {
  const host = useDashboardHost();

  return {
    deleteTarget(input: { targetId: string }): Promise<TargetMutationOutput> {
      return host.rpc<TargetMutationOutput>(HISTORY_SYNC_DASHBOARD_METHODS.deleteTarget, input);
    },
    getChatHistorySyncState(input: { chatId: string }): Promise<SelectedHistorySyncState> {
      return host.rpc<SelectedHistorySyncState>(
        HISTORY_SYNC_DASHBOARD_METHODS.getChatHistorySyncState,
        input
      );
    },
    upsertTarget(input: UpsertTargetInput): Promise<TargetMutationOutput> {
      return host.rpc<TargetMutationOutput>(HISTORY_SYNC_DASHBOARD_METHODS.upsertTarget, input);
    }
  };
}
