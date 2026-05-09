import { describe, expect, it } from 'vitest';
import { createSlotRuntime } from '@agentg/control-plane-sdk/slots';
import type { ContentCatalog, ContentDefinition } from '@agentg/control-plane-sdk/slots';

function contentDefinition(
  contentId: string,
  revision: string,
  load: ContentDefinition['load']
): ContentDefinition {
  return {
    contentId,
    load,
    revision,
    tags: ['control-plane.workspace']
  };
}

describe('slot runtime', () => {
  it('keeps stable content definitions when remote module revisions do not change', () => {
    const initialLoad = () => Promise.resolve({ default: {} });
    const nextLoad = () => Promise.resolve({ default: {} });
    const initialCatalog = [
      contentDefinition('alpha.workspace', 'module-url-v1', initialLoad)
    ] satisfies ContentCatalog;
    const runtime = createSlotRuntime({
      catalog: initialCatalog,
      initialLayout: {}
    });
    const initialContent = runtime.catalogIndex.value.get('alpha.workspace');

    runtime.replaceCatalog([contentDefinition('alpha.workspace', 'module-url-v1', nextLoad)]);

    expect(runtime.catalogIndex.value.get('alpha.workspace')).toBe(initialContent);
  });

  it('replaces content definitions when remote module revisions change', () => {
    const initialLoad = () => Promise.resolve({ default: {} });
    const nextLoad = () => Promise.resolve({ default: {} });
    const runtime = createSlotRuntime({
      catalog: [contentDefinition('alpha.workspace', 'module-url-v1', initialLoad)],
      initialLayout: {}
    });
    const initialContent = runtime.catalogIndex.value.get('alpha.workspace');

    runtime.replaceCatalog([contentDefinition('alpha.workspace', 'module-url-v2', nextLoad)]);

    expect(runtime.catalogIndex.value.get('alpha.workspace')).not.toBe(initialContent);
  });
});
