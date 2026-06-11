import { describe, expect, it } from 'vitest';
import {
  createContentCatalogIndex,
  resolveSlotContents,
  tagsCompatible
} from '../../framework/src/dashboard/slots/resolver.js';
import type { ContentCatalog, SlotLayout } from '../../framework/src/dashboard/slots/types.js';

const catalog = [
  {
    contentId: 'alpha.client',
    load: () => Promise.resolve({ default: {} }),
    tags: ['dashboard.client', 'alpha.client']
  },
  {
    contentId: 'beta.client',
    load: () => Promise.resolve({ default: {} }),
    tags: ['dashboard.client', 'alpha.client.content']
  }
] satisfies ContentCatalog;

describe('slot resolver', () => {
  it('matches content when any tag overlaps', () => {
    expect(tagsCompatible(['dashboard.tile', 'dashboard.client'], ['dashboard.client'])).toBe(true);
  });

  it('leaves empty slots to their default content', () => {
    const resolution = resolveSlotContents(
      {
        slotId: 'dashboard.empty',
        tags: ['dashboard.empty']
      },
      {},
      createContentCatalogIndex(catalog)
    );

    expect(resolution).toEqual({ kind: 'empty' });
  });

  it('derives default slot content from compatible provider tags', () => {
    const resolution = resolveSlotContents(
      {
        slotId: 'dashboard.client',
        tags: ['dashboard.client']
      },
      {},
      createContentCatalogIndex(catalog)
    );

    expect(resolution).toMatchObject({
      items: [
        {
          contentId: 'alpha.client',
          kind: 'content'
        },
        {
          contentId: 'beta.client',
          kind: 'content'
        }
      ],
      kind: 'contents',
      overflowCount: 0
    });
  });

  it('resolves the layout content for a compatible slot', () => {
    const layout: SlotLayout = {
      'dashboard.client': {
        items: [{ contentId: 'alpha.client' }, { contentId: 'beta.client' }]
      }
    };

    const resolution = resolveSlotContents(
      {
        slotId: 'dashboard.client',
        tags: ['dashboard.client']
      },
      layout,
      createContentCatalogIndex(catalog)
    );

    expect(resolution).toMatchObject({
      items: [
        {
          contentId: 'alpha.client',
          kind: 'content'
        },
        {
          contentId: 'beta.client',
          kind: 'content'
        }
      ],
      kind: 'contents',
      overflowCount: 0
    });
  });

  it('resolves direct content id for a compatible slot', () => {
    const resolution = resolveSlotContents(
      {
        slotId: 'dashboard.page',
        tags: ['dashboard.client']
      },
      {},
      createContentCatalogIndex(catalog),
      { contentId: 'beta.client' }
    );

    expect(resolution).toMatchObject({
      items: [
        {
          contentId: 'beta.client',
          index: 0,
          kind: 'content'
        }
      ],
      kind: 'contents',
      overflowCount: 0
    });
  });

  it('reports missing content instead of falling back', () => {
    const layout: SlotLayout = {
      'dashboard.client': {
        items: [{ contentId: 'unknown.content' }]
      }
    };

    const resolution = resolveSlotContents(
      {
        slotId: 'dashboard.client',
        tags: ['dashboard.client']
      },
      layout,
      createContentCatalogIndex(catalog)
    );

    expect(resolution).toMatchObject({
      items: [
        {
          contentId: 'unknown.content',
          index: 0,
          kind: 'missing-content'
        }
      ],
      kind: 'contents',
      overflowCount: 0
    });
  });

  it('reports incompatible content instead of falling back', () => {
    const layout: SlotLayout = {
      'dashboard.dashboard': {
        items: [{ contentId: 'beta.client' }]
      }
    };

    const resolution = resolveSlotContents(
      {
        slotId: 'dashboard.dashboard',
        tags: ['dashboard.metrics']
      },
      layout,
      createContentCatalogIndex(catalog)
    );

    expect(resolution).toMatchObject({
      items: [
        {
          contentId: 'beta.client',
          index: 0,
          kind: 'incompatible'
        }
      ],
      kind: 'contents',
      overflowCount: 0
    });
  });

  it('limits resolved content by maxItems', () => {
    const layout: SlotLayout = {
      'dashboard.client': {
        items: [{ contentId: 'alpha.client' }, { contentId: 'beta.client' }]
      }
    };

    const resolution = resolveSlotContents(
      {
        slotId: 'dashboard.client',
        tags: ['dashboard.client']
      },
      layout,
      createContentCatalogIndex(catalog),
      { maxItems: 1 }
    );

    expect(resolution).toMatchObject({
      items: [
        {
          contentId: 'alpha.client',
          index: 0,
          kind: 'content'
        }
      ],
      kind: 'contents',
      overflowCount: 1
    });
  });
});
