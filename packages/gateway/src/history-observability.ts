import {
  createTrpcHistoryJsonRpcClient,
  type HistoryJsonRpcClient
} from '@agentg/history-sync/rpc';
import type { InternalTrpcClientConfig } from '@agentg/history-sync/rpc';

export type GatewayHistoryClient = HistoryJsonRpcClient;

const HISTORY_REQUEST_TIMEOUT_MS = 15000;

export function createTrpcGatewayHistoryClient(
  config: InternalTrpcClientConfig
): GatewayHistoryClient {
  return createTrpcHistoryJsonRpcClient(config, {
    timeoutMs: HISTORY_REQUEST_TIMEOUT_MS
  });
}
