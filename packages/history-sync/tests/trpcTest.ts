import { createInternalTrpcService } from '@agentg/rpc/trpc';

const testRpcService = createInternalTrpcService('test');

export const testRpc = testRpcService.procedure;
export const testRpcRouter = testRpcService.router;
