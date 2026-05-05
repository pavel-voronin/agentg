import { registerModuleExtensions, type ModuleRuntimeConfig } from '@agentg/shared/modules/runtime';
import type {
  ExtensionRegistrationInput,
  ExtensionRegistrationOutput
} from '@agentg/shared/rpc/extensions';
import { createTRPCUntypedClient, httpBatchLink } from '@trpc/client';

export async function registerSummariesExtensions(
  config: ModuleRuntimeConfig,
  extensionRegistryUrl: string
): Promise<ExtensionRegistrationOutput[]> {
  const client = createTRPCUntypedClient({
    links: [
      httpBatchLink({
        url: extensionRegistryUrl
      })
    ]
  });

  return registerModuleExtensions(config, {
    async registerExtension(input: ExtensionRegistrationInput) {
      return (await client.mutation('registerExtension', input)) as ExtensionRegistrationOutput;
    }
  });
}
