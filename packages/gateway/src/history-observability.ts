import { createHistoryRpcClient } from '@agentg/history-sync/rpc';

export type GatewayHistoryClient = {
  call(method: string, params: unknown): Promise<unknown>;
  close(): void;
};

type HistoryServiceConfig = {
  url: string;
};

type HistoryRpcClient = ReturnType<typeof createHistoryRpcClient>;

export function createTrpcGatewayHistoryClient(config: HistoryServiceConfig): GatewayHistoryClient {
  const history = createHistoryRpcClient(config);

  return {
    call(method, params) {
      return callHistoryMethod(history, method, params);
    },
    close() {
      history.close();
    }
  };
}

function callHistoryMethod(
  history: HistoryRpcClient,
  method: string,
  params: unknown
): Promise<unknown> {
  switch (method) {
    case 'history.deleteTarget':
      return history.deleteTarget(params);
    case 'history.getChatHistoryState':
      return history.getChatHistoryState(params);
    case 'history.getChatStats':
      return history.getChatStats(params);
    case 'history.getOverview':
      return history.getOverview();
    case 'history.listJobs':
      return history.listJobs(params);
    case 'history.requestSync':
      return history.requestSync(params);
    case 'history.upsertTarget':
      return history.upsertTarget(params);
    default:
      return Promise.resolve(undefined);
  }
}
