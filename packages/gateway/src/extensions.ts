import { createTRPCUntypedClient, httpBatchLink } from '@trpc/client';
import {
  extensionRegistryListOutputSchema,
  type ExtensionRegistryListOutput
} from '@agentg/shared/rpc/extensions';
import {
  collectModelMarkers,
  type ModelMarker,
  type ModelRef
} from '@agentg/shared/rpc/model-refs';
import { z } from 'zod';

export type ExtensionServiceConfig = {
  slug: string;
  url: string;
};

export type GatewayExtensionRegistryClient = {
  listExtensions(target: string): Promise<ExtensionRegistryListOutput>;
};

export type GatewayExtensionGetterCaller = (
  extension: string,
  model: ModelMarker
) => Promise<unknown>;

export type GatewayExtensionComposer = {
  callExtension: GatewayExtensionGetterCaller;
  registry: GatewayExtensionRegistryClient;
};

export const gatewayExtensionComposeInputSchema = z.object({
  method: z.string().trim().min(1),
  params: z.unknown().optional()
});

export type GatewayExtensionComposeInput = z.infer<typeof gatewayExtensionComposeInputSchema>;

export type GatewayComposedExtension = {
  extension: string;
  model: ModelRef;
  result: unknown;
};

export type GatewayComposedView = {
  base: unknown;
  extensions: GatewayComposedExtension[];
};

export function createTrpcGatewayExtensionRegistryClient(config: {
  url: string;
}): GatewayExtensionRegistryClient {
  const client = createTRPCUntypedClient({
    links: [
      httpBatchLink({
        url: config.url
      })
    ]
  });

  return {
    async listExtensions(target) {
      return extensionRegistryListOutputSchema.parse(
        await client.query('listExtensions', { target })
      );
    }
  };
}

export function createTrpcGatewayExtensionGetterCaller(
  services: ExtensionServiceConfig[]
): GatewayExtensionGetterCaller {
  const clients = new Map(
    services.map((service) => [
      service.slug,
      createTRPCUntypedClient({
        links: [
          httpBatchLink({
            url: service.url
          })
        ]
      })
    ])
  );

  return async (extension, model) => {
    const slug = extensionSlug(extension);
    const client = clients.get(slug);
    if (client === undefined) {
      throw new Error(`Extension service is not configured: ${slug}`);
    }

    return client.query(extension, model);
  };
}

export async function composeGatewayExtensions(
  composer: GatewayExtensionComposer,
  base: unknown
): Promise<GatewayComposedView> {
  const models = collectModelMarkers(base);
  const extensions: GatewayComposedExtension[] = [];

  for (const model of models) {
    const registrations = await composer.registry.listExtensions(model._model);
    for (const registration of registrations.extensions) {
      extensions.push({
        extension: registration.extension,
        model: {
          _model: model._model,
          id: model.id
        },
        result: await composer.callExtension(registration.extension, model)
      });
    }
  }

  return {
    base,
    extensions
  };
}

function extensionSlug(extension: string): string {
  const [slug] = extension.split('.');
  if (slug === undefined || slug.length === 0 || slug === extension) {
    throw new Error(`Extension must include a slug prefix: ${extension}`);
  }

  return slug;
}
