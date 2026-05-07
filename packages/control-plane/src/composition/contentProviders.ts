import type { ContentCatalog, ContentProvider } from '@agentg/control-plane-sdk/slots';

import { controlPlaneContentProvider } from './content/control-plane/provider.js';

type ControlPlaneProviderModule = Record<string, unknown>;

const providerModules = import.meta.glob<ControlPlaneProviderModule>(
  '../../../*/src/control-plane/index.ts',
  {
    eager: true
  }
);

export const controlPlaneContentProviders = [
  controlPlaneContentProvider,
  ...contentProvidersFromModules(providerModules)
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

function contentProvidersFromModules(
  modules: Record<string, ControlPlaneProviderModule>
): ContentProvider[] {
  return Object.entries(modules)
    .flatMap(([, module]) => Object.values(module).filter(isContentProvider))
    .sort((left, right) => left.domainId.localeCompare(right.domainId));
}

function isContentProvider(value: unknown): value is ContentProvider {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const provider = value as Record<string, unknown>;
  return typeof provider.domainId === 'string' && Array.isArray(provider.contents);
}
