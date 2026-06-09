import type { ContentCatalog, ContentProvider } from '@agentg/framework/dashboard';

import { providers } from 'virtual:dashboard/providers';

export const dashboardContentProviders = providers satisfies readonly ContentProvider[];
export const dashboardContentCatalog = contentCatalogFromProviders(dashboardContentProviders);

export function contentCatalogFromProviders(providers: readonly ContentProvider[]): ContentCatalog {
  return providers.flatMap((provider) =>
    provider.contents.map((content) => ({
      ...content,
      domainId: provider.domainId
    }))
  );
}
