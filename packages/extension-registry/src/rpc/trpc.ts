import { initTRPC } from '@trpc/server';
import { treeifyError, ZodError } from 'zod';

export type ExtensionRegistryRpcContext = Record<string, never>;

const extensionRegistryRpc = initTRPC.context<ExtensionRegistryRpcContext>().create({
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

export const extensionRegistryRpcRouter = extensionRegistryRpc.router;
export const rpc = extensionRegistryRpc.procedure;
