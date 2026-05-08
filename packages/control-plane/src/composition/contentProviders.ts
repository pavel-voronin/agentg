import type { ContentCatalog, ContentProvider } from '@agentg/control-plane-sdk/slots';
import {
  contentProvidersFromControlPlaneCatalogResponse,
  parseControlPlaneProviderCatalogResponse
} from '@agentg/control-plane-sdk/manifest';

import { controlPlaneContentProvider } from './content/control-plane/provider.js';

const controlPlaneContentCatalogUrl = '/control-plane/content-catalog';

export const controlPlaneContentProviders = [
  controlPlaneContentProvider
] satisfies readonly ContentProvider[];

export const controlPlaneContentCatalog = contentCatalogFromProviders(controlPlaneContentProviders);

export function contentCatalogFromProviders(providers: readonly ContentProvider[]): ContentCatalog {
  return providers.flatMap((provider) =>
    provider.contents.map((content) => ({
      ...content,
      domainId: provider.domainId
    }))
  );
}

export async function loadRuntimeContentProviders(): Promise<{
  providers: readonly ContentProvider[];
  version: number;
}> {
  const response = await fetch(controlPlaneContentCatalogUrl, {
    headers: {
      accept: 'application/json'
    }
  });
  if (!response.ok) {
    throw new Error(`Control Plane content catalog did not load: ${String(response.status)}`);
  }
  const parsed = parseControlPlaneProviderCatalogResponse(await response.json());
  if (parsed === null) {
    throw new Error('Control Plane content catalog response is invalid');
  }
  return {
    providers: contentProvidersFromControlPlaneCatalogResponse(parsed),
    version: parsed.version
  };
}
