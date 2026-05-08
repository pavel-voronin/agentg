import type { ContentModule, ContentProvider, SlotLayoutPlacement } from './slots/types.js';

export type ControlPlaneContentRegistration = {
  contentId: string;
  defaultSlotIds?: readonly string[];
  module: {
    assetPath: string;
  };
  props?: Record<string, unknown>;
  styleAssetPaths?: readonly string[];
  tags: readonly string[];
};

export type ControlPlaneProviderRegistration = {
  contents: readonly ControlPlaneContentRegistration[];
  defaultPlacements?: readonly SlotLayoutPlacement[];
};

export type ControlPlaneContentManifest = {
  contentId: string;
  defaultSlotIds?: readonly string[];
  module: {
    url: string;
  };
  props?: Record<string, unknown>;
  styleUrls?: readonly string[];
  tags: readonly string[];
};

export type ControlPlaneProviderManifest = {
  contents: readonly ControlPlaneContentManifest[];
  defaultPlacements?: readonly SlotLayoutPlacement[];
  domainId: string;
};

export type ControlPlaneProviderCatalogResponse = {
  providers: readonly ControlPlaneProviderManifest[];
  version: number;
};

type BrowserDocument = {
  createElement(name: 'link'): BrowserLinkElement;
  head: {
    append(element: BrowserLinkElement): void;
  };
};

type BrowserLinkElement = {
  addEventListener(type: 'error' | 'load', listener: () => void): void;
  href: string;
  rel: string;
};

type BrowserGlobal = {
  document?: BrowserDocument;
};

const loadedStyleUrls = new Set<string>();

export function controlPlaneProviderManifestFromRegistration(
  domainId: string,
  registration: ControlPlaneProviderRegistration,
  resolveAssetUrl: (assetPath: string) => string
): ControlPlaneProviderManifest {
  return {
    contents: registration.contents.map((content) => ({
      contentId: content.contentId,
      module: {
        url: resolveAssetUrl(content.module.assetPath)
      },
      ...(content.defaultSlotIds === undefined ? {} : { defaultSlotIds: content.defaultSlotIds }),
      ...(content.props === undefined ? {} : { props: content.props }),
      ...(content.styleAssetPaths === undefined
        ? {}
        : { styleUrls: content.styleAssetPaths.map(resolveAssetUrl) }),
      tags: content.tags
    })),
    ...(registration.defaultPlacements === undefined
      ? {}
      : { defaultPlacements: registration.defaultPlacements }),
    domainId
  };
}

export function contentProviderFromControlPlaneManifest(
  manifest: ControlPlaneProviderManifest
): ContentProvider {
  return {
    contents: manifest.contents.map((content) => ({
      contentId: content.contentId,
      load: async () => {
        await loadStyleUrls(content.styleUrls ?? []);
        return import(/* @vite-ignore */ content.module.url) as Promise<ContentModule>;
      },
      ...(content.defaultSlotIds === undefined ? {} : { defaultSlotIds: content.defaultSlotIds }),
      ...(content.props === undefined ? {} : { props: content.props }),
      tags: content.tags
    })),
    ...(manifest.defaultPlacements === undefined
      ? {}
      : { defaultPlacements: manifest.defaultPlacements }),
    domainId: manifest.domainId
  };
}

export function contentProvidersFromControlPlaneCatalogResponse(
  response: ControlPlaneProviderCatalogResponse
): ContentProvider[] {
  return response.providers.map(contentProviderFromControlPlaneManifest);
}

export function parseControlPlaneProviderRegistration(
  value: unknown
): ControlPlaneProviderRegistration | null {
  if (!isRecord(value)) {
    return null;
  }
  const contents = arrayOf(value.contents, parseContentRegistration);
  if (contents === null) {
    return null;
  }
  const defaultPlacements = optionalArrayOf(value.defaultPlacements, parsePlacement);
  if (defaultPlacements === null) {
    return null;
  }
  return {
    contents,
    ...(defaultPlacements === undefined ? {} : { defaultPlacements })
  };
}

export function parseControlPlaneProviderCatalogResponse(
  value: unknown
): ControlPlaneProviderCatalogResponse | null {
  if (!isRecord(value) || !Number.isInteger(value.version) || Number(value.version) < 0) {
    return null;
  }
  const providers = arrayOf(value.providers, parseProviderManifest);
  if (providers === null) {
    return null;
  }
  return {
    providers,
    version: Number(value.version)
  };
}

function parseProviderManifest(value: unknown): ControlPlaneProviderManifest | null {
  if (!isRecord(value) || !isNonEmptyString(value.domainId)) {
    return null;
  }
  const contents = arrayOf(value.contents, parseContentManifest);
  if (contents === null) {
    return null;
  }
  const defaultPlacements = optionalArrayOf(value.defaultPlacements, parsePlacement);
  if (defaultPlacements === null) {
    return null;
  }
  return {
    contents,
    ...(defaultPlacements === undefined ? {} : { defaultPlacements }),
    domainId: value.domainId
  };
}

function parseContentRegistration(value: unknown): ControlPlaneContentRegistration | null {
  if (!isRecord(value) || !isNonEmptyString(value.contentId) || !isRecord(value.module)) {
    return null;
  }
  if (!isSafeAssetPath(value.module.assetPath)) {
    return null;
  }
  const tags = arrayOf(value.tags, parseNonEmptyString);
  const defaultSlotIds = optionalArrayOf(value.defaultSlotIds, parseNonEmptyString);
  const styleAssetPaths = optionalArrayOf(value.styleAssetPaths, parseSafeAssetPath);
  if (tags === null || defaultSlotIds === null || styleAssetPaths === null) {
    return null;
  }
  return {
    contentId: value.contentId,
    ...(defaultSlotIds === undefined ? {} : { defaultSlotIds }),
    module: {
      assetPath: value.module.assetPath
    },
    ...(isRecord(value.props) ? { props: value.props } : {}),
    ...(styleAssetPaths === undefined ? {} : { styleAssetPaths }),
    tags
  };
}

function parseContentManifest(value: unknown): ControlPlaneContentManifest | null {
  if (!isRecord(value) || !isNonEmptyString(value.contentId) || !isRecord(value.module)) {
    return null;
  }
  if (!isNonEmptyString(value.module.url)) {
    return null;
  }
  const tags = arrayOf(value.tags, parseNonEmptyString);
  const defaultSlotIds = optionalArrayOf(value.defaultSlotIds, parseNonEmptyString);
  const styleUrls = optionalArrayOf(value.styleUrls, parseNonEmptyString);
  if (tags === null || defaultSlotIds === null || styleUrls === null) {
    return null;
  }
  return {
    contentId: value.contentId,
    ...(defaultSlotIds === undefined ? {} : { defaultSlotIds }),
    module: {
      url: value.module.url
    },
    ...(isRecord(value.props) ? { props: value.props } : {}),
    ...(styleUrls === undefined ? {} : { styleUrls }),
    tags
  };
}

function parsePlacement(value: unknown): SlotLayoutPlacement | null {
  if (!isRecord(value) || !isNonEmptyString(value.contentId) || !isNonEmptyString(value.slotId)) {
    return null;
  }
  return {
    contentId: value.contentId,
    slotId: value.slotId
  };
}

function parseNonEmptyString(value: unknown): string | null {
  return isNonEmptyString(value) ? value : null;
}

function parseSafeAssetPath(value: unknown): string | null {
  return isSafeAssetPath(value) ? value : null;
}

function arrayOf<T>(value: unknown, parse: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const items: T[] = [];
  for (const item of value) {
    const parsed = parse(item);
    if (parsed === null) {
      return null;
    }
    items.push(parsed);
  }
  return items;
}

function optionalArrayOf<T>(
  value: unknown,
  parse: (item: unknown) => T | null
): T[] | null | undefined {
  return value === undefined ? undefined : arrayOf(value, parse);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeAssetPath(value: unknown): value is string {
  return (
    isNonEmptyString(value) &&
    !value.startsWith('/') &&
    !value.includes('..') &&
    !value.includes('\\')
  );
}

async function loadStyleUrls(urls: readonly string[]): Promise<void> {
  const document = browserDocument();
  if (document === null) {
    return;
  }
  await Promise.all(urls.map((url) => loadStyleUrl(document, url)));
}

function loadStyleUrl(document: BrowserDocument, url: string): Promise<void> {
  if (loadedStyleUrls.has(url)) {
    return Promise.resolve();
  }
  loadedStyleUrls.add(url);

  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.href = url;
    link.rel = 'stylesheet';
    link.addEventListener('load', () => {
      resolve();
    });
    link.addEventListener('error', () => {
      loadedStyleUrls.delete(url);
      reject(new Error(`Style asset did not load: ${url}`));
    });
    document.head.append(link);
  });
}

function browserDocument(): BrowserDocument | null {
  return (globalThis as unknown as BrowserGlobal).document ?? null;
}
