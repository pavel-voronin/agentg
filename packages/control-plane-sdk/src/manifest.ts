import type { ContentModule, ContentProvider } from './slots/types.js';

export type ControlPlaneContentRegistration = {
  contentId: string;
  metadata?: Record<string, unknown>;
  module: {
    assetPath: string;
  };
  props?: Record<string, unknown>;
  styleAssetPaths?: readonly string[];
  tags: readonly string[];
};

export type ControlPlaneProviderRegistration = {
  assetVersion: string;
  assetVersions?: Readonly<Record<string, string>>;
  contents: readonly ControlPlaneContentRegistration[];
};

export type ControlPlaneContentManifest = {
  contentId: string;
  metadata?: Record<string, unknown>;
  module: {
    url: string;
  };
  props?: Record<string, unknown>;
  styleUrls?: readonly string[];
  tags: readonly string[];
};

export type ControlPlaneProviderManifest = {
  assetVersion: string;
  contents: readonly ControlPlaneContentManifest[];
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
  remove(): void;
  rel: string;
};

type BrowserGlobal = {
  document?: BrowserDocument;
  location?: {
    href: string;
  };
};

const loadedStyleLinks = new Map<string, { link: BrowserLinkElement; url: string }>();
const pendingStyleLoads = new Map<string, Promise<void>>();

export function controlPlaneProviderManifestFromRegistration(
  domainId: string,
  registration: ControlPlaneProviderRegistration,
  resolveAssetUrl: (assetPath: string, assetVersion: string) => string
): ControlPlaneProviderManifest {
  return {
    assetVersion: registration.assetVersion,
    contents: registration.contents.map((content) => ({
      contentId: content.contentId,
      ...(content.metadata === undefined ? {} : { metadata: content.metadata }),
      module: {
        url: resolveAssetUrl(
          content.module.assetPath,
          assetVersionForPath(registration, content.module.assetPath)
        )
      },
      ...(content.props === undefined ? {} : { props: content.props }),
      ...(content.styleAssetPaths === undefined
        ? {}
        : {
            styleUrls: content.styleAssetPaths.map((assetPath) =>
              resolveAssetUrl(assetPath, assetVersionForPath(registration, assetPath))
            )
          }),
      tags: content.tags
    })),
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
      ...(content.metadata === undefined ? {} : { metadata: content.metadata }),
      ...(content.props === undefined ? {} : { props: content.props }),
      revision: remoteContentRevision(content),
      tags: content.tags
    })),
    domainId: manifest.domainId
  };
}

export function contentProvidersFromControlPlaneCatalogResponse(
  response: ControlPlaneProviderCatalogResponse
): ContentProvider[] {
  return response.providers.map(contentProviderFromControlPlaneManifest);
}

export async function loadControlPlaneProviderCatalogStyles(
  response: ControlPlaneProviderCatalogResponse
): Promise<void> {
  const styleUrls = new Set<string>();
  for (const provider of response.providers) {
    for (const content of provider.contents) {
      for (const styleUrl of content.styleUrls ?? []) {
        styleUrls.add(styleUrl);
      }
    }
  }
  await loadStyleUrls([...styleUrls]);
}

export function parseControlPlaneProviderRegistration(
  value: unknown
): ControlPlaneProviderRegistration | null {
  if (!isRecord(value)) {
    return null;
  }
  if (!isSafeAssetVersion(value.assetVersion)) {
    return null;
  }
  const assetVersions = optionalRecordOf(value.assetVersions, parseSafeAssetVersion);
  if (assetVersions === null) {
    return null;
  }
  const contents = arrayOf(value.contents, parseContentRegistration);
  if (contents === null) {
    return null;
  }
  return {
    assetVersion: value.assetVersion,
    ...(assetVersions === undefined ? {} : { assetVersions }),
    contents
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
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.domainId) ||
    !isSafeAssetVersion(value.assetVersion)
  ) {
    return null;
  }
  const contents = arrayOf(value.contents, parseContentManifest);
  if (contents === null) {
    return null;
  }
  return {
    assetVersion: value.assetVersion,
    contents,
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
  const metadata = optionalRecord(value.metadata);
  const styleAssetPaths = optionalArrayOf(value.styleAssetPaths, parseSafeAssetPath);
  if (tags === null || metadata === null || styleAssetPaths === null) {
    return null;
  }
  return {
    contentId: value.contentId,
    ...(metadata === undefined ? {} : { metadata }),
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
  const metadata = optionalRecord(value.metadata);
  const styleUrls = optionalArrayOf(value.styleUrls, parseNonEmptyString);
  if (tags === null || metadata === null || styleUrls === null) {
    return null;
  }
  return {
    contentId: value.contentId,
    ...(metadata === undefined ? {} : { metadata }),
    module: {
      url: value.module.url
    },
    ...(isRecord(value.props) ? { props: value.props } : {}),
    ...(styleUrls === undefined ? {} : { styleUrls }),
    tags
  };
}

function parseNonEmptyString(value: unknown): string | null {
  return isNonEmptyString(value) ? value : null;
}

function parseSafeAssetPath(value: unknown): string | null {
  return isSafeAssetPath(value) ? value : null;
}

function parseSafeAssetVersion(value: unknown): string | null {
  return isSafeAssetVersion(value) ? value : null;
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

function optionalRecordOf<T>(
  value: unknown,
  parse: (item: unknown) => T | null
): Record<string, T> | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    return null;
  }
  const parsed: Record<string, T> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!isSafeAssetPath(key)) {
      return null;
    }
    const parsedItem = parse(item);
    if (parsedItem === null) {
      return null;
    }
    parsed[key] = parsedItem;
  }
  return parsed;
}

function optionalRecord(value: unknown): Record<string, unknown> | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  return isRecord(value) ? value : null;
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

function isSafeAssetVersion(value: unknown): value is string {
  return (
    isNonEmptyString(value) &&
    !value.includes('/') &&
    !value.includes('..') &&
    !value.includes('\\')
  );
}

function assetVersionForPath(
  registration: ControlPlaneProviderRegistration,
  assetPath: string
): string {
  return registration.assetVersions?.[assetPath] ?? registration.assetVersion;
}

async function loadStyleUrls(urls: readonly string[]): Promise<void> {
  const document = browserDocument();
  if (document === null) {
    return;
  }
  await Promise.all(urls.map((url) => loadStyleUrl(document, url)));
}

function loadStyleUrl(document: BrowserDocument, url: string): Promise<void> {
  const styleKey = styleAssetKey(url);
  const loadedStyle = loadedStyleLinks.get(styleKey);
  if (loadedStyle?.url === url) {
    return Promise.resolve();
  }
  const pendingStyleLoad = pendingStyleLoads.get(url);
  if (pendingStyleLoad !== undefined) {
    return pendingStyleLoad;
  }

  const styleLoad = new Promise<void>((resolve, reject) => {
    const link = document.createElement('link');
    link.href = url;
    link.rel = 'stylesheet';
    link.addEventListener('load', () => {
      loadedStyle?.link.remove();
      loadedStyleLinks.set(styleKey, {
        link,
        url
      });
      resolve();
    });
    link.addEventListener('error', () => {
      reject(new Error(`Style asset did not load: ${url}`));
    });
    document.head.append(link);
  });
  pendingStyleLoads.set(
    url,
    styleLoad.finally(() => {
      pendingStyleLoads.delete(url);
    })
  );
  return styleLoad;
}

function browserDocument(): BrowserDocument | null {
  return (globalThis as unknown as BrowserGlobal).document ?? null;
}

function styleAssetKey(url: string): string {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url, browserLocationHref());
  } catch {
    return url;
  }
  const segments = parsedUrl.pathname.split('/').filter((segment) => segment.length > 0);
  if (
    segments.length >= 5 &&
    segments[0] === 'control-plane' &&
    segments[1] === 'provider-assets'
  ) {
    const providerSlug = segments[2];
    if (providerSlug === undefined) {
      return parsedUrl.href;
    }
    return `${parsedUrl.origin}/${segments[0]}/${segments[1]}/${providerSlug}/${segments
      .slice(4)
      .join('/')}`;
  }

  return parsedUrl.href;
}

function browserLocationHref(): string {
  return (globalThis as unknown as BrowserGlobal).location?.href ?? 'http://localhost/';
}

function remoteContentRevision(content: ControlPlaneContentManifest): string {
  return content.module.url;
}
