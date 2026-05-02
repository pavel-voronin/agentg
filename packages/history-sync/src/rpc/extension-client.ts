import { type ExtensionCaller, type ExtensionCallerResolver } from '@agentg/shared/rpc/extensions';
import type { ProcedureEnvelope, ProcedureExtensionEnvelope } from '@agentg/shared/rpc/envelope';
import { createTRPCUntypedClient, httpBatchLink } from '@trpc/client';

export type ExtensionServiceConfig = {
  slug: string;
  url: string;
};

export function createTrpcExtensionCallerResolver(
  services: ExtensionServiceConfig[]
): ExtensionCallerResolver | undefined {
  if (services.length === 0) {
    return undefined;
  }

  const callers = new Map<string, ExtensionCaller>();
  for (const service of services) {
    callers.set(service.slug, createTrpcExtensionCaller(service.url));
  }

  return (slug) => callers.get(slug);
}

function createTrpcExtensionCaller(url: string): ExtensionCaller {
  const client = createTRPCUntypedClient({
    links: [
      httpBatchLink({
        url
      })
    ]
  });

  return async (extension, input) =>
    (await client.query(extension, input)) as
      | ProcedureEnvelope<unknown>
      | ProcedureExtensionEnvelope<unknown>;
}
