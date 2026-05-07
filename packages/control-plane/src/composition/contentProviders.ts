import { historySyncControlPlaneProvider } from '@agentg/history-sync/control-plane';
import { telegramControlPlaneProvider } from '@agentg/telegram/control-plane';
import type { ContentCatalog, ContentProvider } from '@agentg/control-plane-extension/slots';

import { controlPlaneContentProvider } from './content/control-plane/provider.js';

export const controlPlaneContentProviders = [
  controlPlaneContentProvider,
  telegramControlPlaneProvider,
  historySyncControlPlaneProvider
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
