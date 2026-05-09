import type {
  ContentCatalog,
  ContentDefinition,
  SlotDefinition,
  SlotItemResolution,
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

export function resolveSlotContents(
  slot: SlotDefinition,
  layout: SlotLayout,
  catalog: ReadonlyMap<string, ContentDefinition>,
  options: {
    maxItems?: number | undefined;
  } = {}
): SlotResolution {
  const layoutEntry = layout[slot.slotId];
  if (layoutEntry === undefined || layoutEntry.items.length === 0) {
    return { kind: 'empty' };
  }

  const maxItems = normalizeMaxItems(options.maxItems);
  const items = maxItems === undefined ? layoutEntry.items : layoutEntry.items.slice(0, maxItems);
  const overflowCount = layoutEntry.items.length - items.length;
  return {
    items: items.map((item, index) => resolveSlotItem(slot, item.contentId, index, catalog)),
    kind: 'contents',
    overflowCount
  };
}

function resolveSlotItem(
  slot: SlotDefinition,
  contentId: string,
  index: number,
  catalog: ReadonlyMap<string, ContentDefinition>
): SlotItemResolution {
  const content = catalog.get(contentId);
  if (content === undefined) {
    return {
      contentId,
      index,
      kind: 'missing-content'
    };
  }

  if (!tagsCompatible(slot.tags, content.tags)) {
    return {
      content,
      contentId,
      index,
      kind: 'incompatible',
      slotTags: slot.tags
    };
  }

  return {
    content,
    contentId,
    index,
    kind: 'content'
  };
}

export function tagsCompatible(
  slotTags: readonly string[],
  contentTags: readonly string[]
): boolean {
  return slotTags.some((slotTag) => contentTags.includes(slotTag));
}

function normalizeMaxItems(maxItems: number | undefined): number | undefined {
  if (maxItems === undefined) {
    return undefined;
  }
  return Math.max(0, Math.floor(maxItems));
}
