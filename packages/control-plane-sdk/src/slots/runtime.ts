import {
  inject,
  provide,
  ref,
  shallowRef,
  type InjectionKey,
  type Ref,
  type ShallowRef
} from 'vue';

import { createContentCatalogIndex, tagsCompatible } from './resolver.js';
import type {
  ContentCatalog,
  ContentDefinition,
  SlotDebugEntry,
  SlotDebugEntryInput,
  SlotDebugRegistration,
  SlotLayout,
  SlotLayoutItem
} from './types.js';

export type SlotRuntime = {
  catalog: Readonly<ShallowRef<ContentCatalog>>;
  catalogIndex: Readonly<ShallowRef<ReadonlyMap<string, ContentDefinition>>>;
  compatibleContent: (slotTags: readonly string[]) => ContentDefinition[];
  debugEntries: Readonly<ShallowRef<readonly SlotDebugEntry[]>>;
  debugEnabled: Readonly<Ref<boolean>>;
  layout: Readonly<Ref<SlotLayout>>;
  registerDebugEntry: (entry: SlotDebugEntryInput) => SlotDebugRegistration;
  replaceCatalog: (nextCatalog: ContentCatalog) => void;
};

const slotRuntimeKey = Symbol.for('agentg:control-plane:slot-runtime') as InjectionKey<SlotRuntime>;

export function createSlotRuntime(options: {
  catalog: ContentCatalog;
  debugEnabled?: Readonly<Ref<boolean>>;
  initialLayout: SlotLayout;
}): SlotRuntime {
  const layout = ref(cloneSlotLayout(options.initialLayout));
  const catalog = shallowRef<ContentCatalog>(options.catalog);
  const catalogIndex = shallowRef<ReadonlyMap<string, ContentDefinition>>(
    createContentCatalogIndex(options.catalog)
  );
  const debugEnabled = options.debugEnabled ?? ref(false);
  const debugEntries = shallowRef<readonly SlotDebugEntry[]>([]);
  let nextDebugEntryId = 0;

  function registerDebugEntry(entry: SlotDebugEntryInput): SlotDebugRegistration {
    const id = ++nextDebugEntryId;
    const order = id;
    debugEntries.value = [...debugEntries.value, { ...entry, id, order }];

    return {
      unregister() {
        debugEntries.value = debugEntries.value.filter((current) => current.id !== id);
      },
      update(nextEntry) {
        debugEntries.value = debugEntries.value.map((current) =>
          current.id === id ? { ...nextEntry, id, order } : current
        );
      }
    };
  }

  return {
    catalog,
    catalogIndex,
    compatibleContent(slotTags) {
      return catalog.value.filter((content) => tagsCompatible(slotTags, content.tags));
    },
    debugEntries,
    debugEnabled,
    layout,
    registerDebugEntry,
    replaceCatalog(nextCatalog) {
      const stableCatalog = preserveStableContentDefinitions(nextCatalog, catalogIndex.value);
      catalog.value = stableCatalog;
      catalogIndex.value = createContentCatalogIndex(stableCatalog);
    }
  };
}

export function provideSlotRuntime(runtime: SlotRuntime): void {
  provide(slotRuntimeKey, runtime);
}

export function useSlotRuntime(): SlotRuntime {
  const runtime = inject(slotRuntimeKey);
  if (runtime === undefined) {
    throw new Error('Slot runtime is not available');
  }
  return runtime;
}

function cloneSlotLayout(layout: SlotLayout): SlotLayout {
  return Object.fromEntries(
    Object.entries(layout).map(([slotId, entry]) => [slotId, cloneSlotLayoutEntry(entry.items)])
  );
}

function cloneSlotLayoutEntry(items: readonly SlotLayoutItem[]): { items: SlotLayoutItem[] } {
  return {
    items: items.map((item) => ({ contentId: item.contentId }))
  };
}

function preserveStableContentDefinitions(
  nextCatalog: ContentCatalog,
  previousIndex: ReadonlyMap<string, ContentDefinition>
): ContentCatalog {
  return nextCatalog.map((content) => {
    const previous = previousIndex.get(content.contentId);
    return previous !== undefined && contentDefinitionsEqual(previous, content)
      ? previous
      : content;
  });
}

function contentDefinitionsEqual(left: ContentDefinition, right: ContentDefinition): boolean {
  return (
    left.contentId === right.contentId &&
    left.domainId === right.domainId &&
    contentLoadEqual(left, right) &&
    optionalRecordsEqual(left.props, right.props) &&
    stringArraysEqual(left.tags, right.tags)
  );
}

function contentLoadEqual(left: ContentDefinition, right: ContentDefinition): boolean {
  if (left.revision !== undefined || right.revision !== undefined) {
    return left.revision === right.revision;
  }
  return left.load === right.load;
}

function stringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function optionalRecordsEqual(
  left: Record<string, unknown> | undefined,
  right: Record<string, unknown> | undefined
): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }
  const leftEntries = Object.entries(left).sort(compareEntries);
  const rightEntries = Object.entries(right).sort(compareEntries);
  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(([key, value], index) => {
      const rightEntry = rightEntries[index];
      return rightEntry?.[0] === key && value === rightEntry[1];
    })
  );
}

function compareEntries(
  left: readonly [string, unknown],
  right: readonly [string, unknown]
): number {
  return left[0].localeCompare(right[0]);
}
