import { describe, expect, it } from 'vitest';
import {
  createContentCatalogIndex,
  resolveSlotContents,
  tagsCompatible
} from '@agentg/control-plane-sdk/slots';
import type { ContentCatalog, SlotLayout } from '@agentg/control-plane-sdk/slots';

const catalog = [
  {
    contentId: 'alpha.workspace',
    load: () => Promise.resolve({ default: {} }),
    tags: ['control-plane.workspace', 'alpha.workspace']
  },
  {
    contentId: 'events.stream.panel',
    load: () => Promise.resolve({ default: {} }),
    tags: ['control-plane.workspace', 'alpha.workspace.content']
  }
] satisfies ContentCatalog;

describe('slot resolver', () => {
  it('matches content when any tag overlaps', () => {
    expect(
      tagsCompatible(['dashboard.tile', 'control-plane.workspace'], ['control-plane.workspace'])
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
        slotId: 'control-plane.workspace',
        tags: ['control-plane.workspace']
      },
      {},
      createContentCatalogIndex(catalog)
    );

    expect(resolution).toMatchObject({
      items: [
        {
          contentId: 'alpha.workspace',
          kind: 'content'
        },
        {
          contentId: 'events.stream.panel',
          kind: 'content'
        }
      ],
      kind: 'contents',
      overflowCount: 0
    });
  });

  it('resolves the layout content for a compatible slot', () => {
    const layout: SlotLayout = {
      'control-plane.workspace': {
        items: [{ contentId: 'alpha.workspace' }, { contentId: 'events.stream.panel' }]
      }
    };

    const resolution = resolveSlotContents(
      {
        slotId: 'control-plane.workspace',
        tags: ['control-plane.workspace']
      },
      layout,
      createContentCatalogIndex(catalog)
    );

    expect(resolution).toMatchObject({
      items: [
        {
          contentId: 'alpha.workspace',
          kind: 'content'
        },
        {
          contentId: 'events.stream.panel',
          kind: 'content'
        }
      ],
      kind: 'contents',
      overflowCount: 0
    });
  });

  it('reports missing content instead of falling back', () => {
    const layout: SlotLayout = {
      'control-plane.workspace': {
        items: [{ contentId: 'unknown.content' }]
      }
    };

    const resolution = resolveSlotContents(
      {
        slotId: 'control-plane.workspace',
        tags: ['control-plane.workspace']
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
        items: [{ contentId: 'events.stream.panel' }]
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
          contentId: 'events.stream.panel',
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
      'control-plane.workspace': {
        items: [{ contentId: 'alpha.workspace' }, { contentId: 'events.stream.panel' }]
      }
    };

    const resolution = resolveSlotContents(
      {
        slotId: 'control-plane.workspace',
        tags: ['control-plane.workspace']
      },
      layout,
      createContentCatalogIndex(catalog),
      { maxItems: 1 }
    );

    expect(resolution).toMatchObject({
      items: [
        {
          contentId: 'alpha.workspace',
          index: 0,
          kind: 'content'
        }
      ],
      kind: 'contents',
      overflowCount: 1
    });
  });
});
