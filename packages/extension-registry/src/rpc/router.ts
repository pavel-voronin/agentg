import {
  extensionRegistrationInputSchema,
  extensionRegistrationOutputSchema,
  extensionRegistryListInputSchema,
  extensionRegistryListOutputSchema
} from '@agentg/shared/rpc/extensions';

import type { ExtensionRegistry } from '../registry.js';
import { extensionRegistryRpcRouter, rpc } from './trpc.js';

export function createExtensionRegistryRouter(registry: ExtensionRegistry) {
  return extensionRegistryRpcRouter({
    listExtensions: rpc
      .input(extensionRegistryListInputSchema.optional())
      .output(extensionRegistryListOutputSchema)
      .query(({ input }) => ({
        extensions: registry.list(input ?? {})
      })),
    registerExtension: rpc
      .input(extensionRegistrationInputSchema)
      .output(extensionRegistrationOutputSchema)
      .mutation(({ input }) => registry.register(input))
  });
}

export type ExtensionRegistryRouter = ReturnType<typeof createExtensionRegistryRouter>;
