import { initTRPC } from '@trpc/server';

const testTrpc = initTRPC.create();

export const testRpc = testTrpc.procedure;
export const testRpcRouter = testTrpc.router;
