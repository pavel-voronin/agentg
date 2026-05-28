import { createInternalTrpcService } from '@agentg/framework/trpc';

const testRpcService = createInternalTrpcService('test');

export const testRpc = testRpcService.procedure;
export const testRpcRouter = testRpcService.router;
