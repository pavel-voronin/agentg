import {
  createGrpcHistoryJsonRpcClient,
  type HistoryJsonRpcClient
} from '@agentg/proto/agentg/history/v1/json-rpc-client';
import type { InternalRpcClientConfig } from '@agentg/proto/rpc/config';

export type GatewayHistoryClient = HistoryJsonRpcClient;

const HISTORY_REQUEST_TIMEOUT_MS = 15000;

export function createGrpcGatewayHistoryClient(
  config: InternalRpcClientConfig
): GatewayHistoryClient {
  return createGrpcHistoryJsonRpcClient(config, {
    timeoutMs: HISTORY_REQUEST_TIMEOUT_MS
  });
}
