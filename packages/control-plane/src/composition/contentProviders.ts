import type { ContentCatalog, ContentProvider } from '@agentg/framework/cp';

import { providers } from 'virtual:control-plane/providers';

export const controlPlaneContentProviders = providers satisfies readonly ContentProvider[];
export const controlPlaneContentCatalog = contentCatalogFromProviders(controlPlaneContentProviders);

export function contentCatalogFromProviders(providers: readonly ContentProvider[]): ContentCatalog {
  return providers.flatMap((provider) =>
    provider.contents.map((content) => ({
      ...content,
      domainId: provider.domainId
    }))
  );
}
