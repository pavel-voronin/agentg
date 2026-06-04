import { describe, expect, it } from 'vitest';
import {
  createContentCatalogIndex,
  resolveSlotContents,
  tagsCompatible
} from '@agentg/framework/cp';
import type { ContentCatalog, SlotLayout } from '@agentg/framework/cp';

const catalog = [
  {
    contentId: 'alpha.client',
    load: () => Promise.resolve({ default: {} }),
    tags: ['control-plane.client', 'alpha.client']
  },
  {
    contentId: 'beta.client',
    load: () => Promise.resolve({ default: {} }),
    tags: ['control-plane.client', 'alpha.client.content']
  }
] satisfies ContentCatalog;

describe('slot resolver', () => {
  it('matches content when any tag overlaps', () => {
    expect(
      tagsCompatible(['dashboard.tile', 'control-plane.client'], ['control-plane.client'])
    ).toBe(true);
  });

  it('leaves empty slots to their default content', () => {
    const resolution = resolveSlotContents(
      {
        slotId: 'control-plane.empty',
        tags: ['control-plane.empty']
      },
      {},
      createContentCatalogIndex(catalog)
    );

    expect(resolution).toEqual({ kind: 'empty' });
  });

  it('derives default slot content from compatible provider tags', () => {
    const resolution = resolveSlotContents(
      {
        slotId: 'control-plane.client',
        tags: ['control-plane.client']
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
      'control-plane.client': {
        items: [{ contentId: 'alpha.client' }, { contentId: 'beta.client' }]
      }
    };

    const resolution = resolveSlotContents(
      {
        slotId: 'control-plane.client',
        tags: ['control-plane.client']
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
        slotId: 'control-plane.page',
        tags: ['control-plane.client']
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
      'control-plane.client': {
        items: [{ contentId: 'unknown.content' }]
      }
    };

    const resolution = resolveSlotContents(
      {
        slotId: 'control-plane.client',
        tags: ['control-plane.client']
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
      'control-plane.dashboard': {
        items: [{ contentId: 'beta.client' }]
      }
    };

    const resolution = resolveSlotContents(
      {
        slotId: 'control-plane.dashboard',
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
      'control-plane.client': {
        items: [{ contentId: 'alpha.client' }, { contentId: 'beta.client' }]
      }
    };

    const resolution = resolveSlotContents(
      {
        slotId: 'control-plane.client',
        tags: ['control-plane.client']
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
