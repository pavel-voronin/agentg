import { describe, expect, it } from 'vitest';
import { createSlotRuntime } from '@agentg/framework/cp';
import type { ContentCatalog, ContentDefinition } from '@agentg/framework/cp';

function contentDefinition(
  contentId: string,
  revision: string,
  load: ContentDefinition['load'],
  metadata?: ContentDefinition['metadata']
): ContentDefinition {
  return {
    contentId,
    load,
    ...(metadata === undefined ? {} : { metadata }),
    revision,
    tags: ['control-plane.client']
  };
}

describe('slot runtime', () => {
  it('keeps stable content definitions when remote module revisions do not change', () => {
    const initialLoad = () => Promise.resolve({ default: {} });
    const nextLoad = () => Promise.resolve({ default: {} });
    const initialCatalog = [
      contentDefinition('alpha.client', 'module-url-v1', initialLoad)
    ] satisfies ContentCatalog;
    const runtime = createSlotRuntime({
      catalog: initialCatalog,
      initialLayout: {}
    });
    const initialContent = runtime.catalogIndex.value.get('alpha.client');

    runtime.replaceCatalog([contentDefinition('alpha.client', 'module-url-v1', nextLoad)]);

    expect(runtime.catalogIndex.value.get('alpha.client')).toBe(initialContent);
  });

  it('replaces content definitions when remote module revisions change', () => {
    const initialLoad = () => Promise.resolve({ default: {} });
    const nextLoad = () => Promise.resolve({ default: {} });
    const runtime = createSlotRuntime({
      catalog: [contentDefinition('alpha.client', 'module-url-v1', initialLoad)],
      initialLayout: {}
    });
    const initialContent = runtime.catalogIndex.value.get('alpha.client');

    runtime.replaceCatalog([contentDefinition('alpha.client', 'module-url-v2', nextLoad)]);

    expect(runtime.catalogIndex.value.get('alpha.client')).not.toBe(initialContent);
  });

  it('keeps stable content definitions when nested metadata does not change', () => {
    const initialLoad = () => Promise.resolve({ default: {} });
    const nextLoad = () => Promise.resolve({ default: {} });
    const runtime = createSlotRuntime({
      catalog: [
        contentDefinition('alpha.client', 'module-url-v1', initialLoad, {
          tab: {
            label: 'Alpha',
            order: 10
          }
        })
      ],
      initialLayout: {}
    });
    const initialContent = runtime.catalogIndex.value.get('alpha.client');

    runtime.replaceCatalog([
      contentDefinition('alpha.client', 'module-url-v1', nextLoad, {
        tab: {
          label: 'Alpha',
          order: 10
        }
      })
    ]);

    expect(runtime.catalogIndex.value.get('alpha.client')).toBe(initialContent);
  });
});
