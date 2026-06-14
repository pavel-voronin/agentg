import { defineInternalRpcDomain } from '../rpc/httpRpc.js';
import type { RpcClient } from '../rpc/rpc.js';
import type { PolicyProcedures } from './types.js';

export type PolicyClient = RpcClient<PolicyProcedures>;

export type PolicyClientFactory = () => PolicyClient;

const endpoint = defineInternalRpcDomain<PolicyProcedures>('policies');

export function createPolicyClient(options: { timeoutMs?: number; url: string }): PolicyClient {
  return endpoint(options);
}
