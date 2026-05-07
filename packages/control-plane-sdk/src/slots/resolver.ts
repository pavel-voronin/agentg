import type {
  ContentCatalog,
  ContentDefinition,
  SlotDefinition,
  SlotLayout,
  SlotResolution
} from './types.js';

export function createContentCatalogIndex(
  catalog: ContentCatalog
): ReadonlyMap<string, ContentDefinition> {
  const index = new Map<string, ContentDefinition>();
  for (const content of catalog) {
    if (index.has(content.contentId)) {
      throw new Error(`Duplicate slot content id: ${content.contentId}`);
    }
    index.set(content.contentId, content);
  }
  return index;
}

export function resolveSlotContent(
  slot: SlotDefinition,
  layout: SlotLayout,
  catalog: ReadonlyMap<string, ContentDefinition>
): SlotResolution {
  const layoutEntry = layout[slot.slotId];
  if (layoutEntry === undefined) {
    return { kind: 'empty' };
  }

  const content = catalog.get(layoutEntry.contentId);
  if (content === undefined) {
    return {
      contentId: layoutEntry.contentId,
      kind: 'missing-content'
    };
  }

  if (!tagsCompatible(slot.tags, content.tags)) {
    return {
      content,
      kind: 'incompatible',
      slotTags: slot.tags
    };
  }

  return {
    content,
    kind: 'content'
  };
}

export function tagsCompatible(
  slotTags: readonly string[],
  contentTags: readonly string[]
): boolean {
  return slotTags.some((slotTag) => contentTags.includes(slotTag));
}
