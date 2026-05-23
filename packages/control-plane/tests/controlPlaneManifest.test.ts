import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  loadControlPlaneProviderCatalogStyles,
  type ControlPlaneProviderCatalogResponse
} from '@agentg/control-plane-sdk/manifest';

type BrowserDocumentGlobal = {
  document?: unknown;
};

type FakeLinkEvent = 'error' | 'load';

class FakeLinkElement {
  href = '';
  rel = '';
  removed = false;
  readonly listeners: Partial<Record<FakeLinkEvent, () => void>> = {};

  addEventListener(type: FakeLinkEvent, listener: () => void): void {
    this.listeners[type] = listener;
  }

  remove(): void {
    this.removed = true;
  }
}

describe('control plane manifest loading', () => {
  const globalObject = globalThis as unknown as BrowserDocumentGlobal;
  const originalDocument = globalObject.document;

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (originalDocument === undefined) {
      Reflect.deleteProperty(globalObject, 'document');
      return;
    }
    globalObject.document = originalDocument;
  });

  it('keeps stylesheet load failures non-fatal for provider catalog loading', async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const links: FakeLinkElement[] = [];
    installFakeDocument((link) => {
      links.push(link);
      link.listeners.error?.();
    });

    const load = loadControlPlaneProviderCatalogStyles({
      providers: [
        {
          assetVersion: 'asset-v2',
          contents: [
            {
              contentId: 'alpha.tile',
              module: {
                url: '/control-plane/provider-assets/alpha/tile-v2/tile.js'
              },
              styleUrls: ['/control-plane/provider-assets/alpha/style-v2/assets/style.css'],
              tags: ['dashboard.tile']
            }
          ],
          domainId: 'alpha'
        }
      ],
      version: 2
    } satisfies ControlPlaneProviderCatalogResponse);

    await vi.advanceTimersByTimeAsync(850);

    await expect(load).resolves.toBeUndefined();
    expect(links).toHaveLength(4);
    expect(links.every((link) => link.removed)).toBe(true);
    expect(warn).toHaveBeenCalledWith(
      'Style asset did not load: /control-plane/provider-assets/alpha/style-v2/assets/style.css'
    );
  });
});

function installFakeDocument(onAppend: (link: FakeLinkElement) => void): void {
  const fakeDocument = {
    createElement(name: 'link') {
      expect(name).toBe('link');
      return new FakeLinkElement();
    },
    head: {
      append(element: FakeLinkElement) {
        onAppend(element);
      }
    }
  };
  (globalThis as unknown as BrowserDocumentGlobal).document = fakeDocument;
}
