import { describe, expect, it } from 'vitest';
import {
  createContentCatalogIndex,
  resolveSlotContent,
  tagsCompatible
} from '@agentg/control-plane-extension/slots';
import type { ContentCatalog, SlotLayout } from '@agentg/control-plane-extension/slots';

const catalog = [
  {
    contentId: 'telegram.workspace',
    load: () => Promise.resolve({ default: {} }),
    tags: ['control-plane.workspace', 'telegram.workspace']
  },
  {
    contentId: 'events.stream.panel',
    load: () => Promise.resolve({ default: {} }),
    tags: ['control-plane.workspace', 'telegram.workspace.content']
  }
] satisfies ContentCatalog;

describe('slot resolver', () => {
  it('matches content when any tag overlaps', () => {
    expect(
      tagsCompatible(['dashboard.tile', 'control-plane.workspace'], ['control-plane.workspace'])
    ).toBe(true);
  });

  it('leaves empty slots to their default content', () => {
    const resolution = resolveSlotContent(
      {
        slotId: 'control-plane.workspace',
        tags: ['control-plane.workspace']
      },
      {},
      createContentCatalogIndex(catalog)
    );

    expect(resolution).toEqual({ kind: 'empty' });
  });

  it('resolves the layout content for a compatible slot', () => {
    const layout: SlotLayout = {
      'control-plane.workspace': {
        contentId: 'telegram.workspace'
      }
    };

    const resolution = resolveSlotContent(
      {
        slotId: 'control-plane.workspace',
        tags: ['control-plane.workspace']
      },
      layout,
      createContentCatalogIndex(catalog)
    );

    expect(resolution.kind).toBe('content');
  });

  it('reports missing content instead of falling back', () => {
    const layout: SlotLayout = {
      'control-plane.workspace': {
        contentId: 'unknown.content'
      }
    };

    const resolution = resolveSlotContent(
      {
        slotId: 'control-plane.workspace',
        tags: ['control-plane.workspace']
      },
      layout,
      createContentCatalogIndex(catalog)
    );

    expect(resolution).toEqual({
      contentId: 'unknown.content',
      kind: 'missing-content'
    });
  });

  it('reports incompatible content instead of falling back', () => {
    const layout: SlotLayout = {
      'control-plane.dashboard': {
        contentId: 'events.stream.panel'
      }
    };

    const resolution = resolveSlotContent(
      {
        slotId: 'control-plane.dashboard',
        tags: ['dashboard.metrics']
      },
      layout,
      createContentCatalogIndex(catalog)
    );

    expect(resolution.kind).toBe('incompatible');
  });
});
