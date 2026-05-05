import { initTRPC } from '@trpc/server';
import { treeifyError, ZodError } from 'zod';

export type ServiceDirectoryRpcContext = Record<string, never>;

const serviceDirectoryRpc = initTRPC.context<ServiceDirectoryRpcContext>().create({
  errorFormatter({ error, shape }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? treeifyError(error.cause) : null
      }
    };
  }
});

export const serviceDirectoryRpcRouter = serviceDirectoryRpc.router;
export const rpc = serviceDirectoryRpc.procedure;
