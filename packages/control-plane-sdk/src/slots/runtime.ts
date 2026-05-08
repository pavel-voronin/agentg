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
  SlotLayout
} from './types.js';

export type SlotRuntime = {
  catalog: Readonly<ShallowRef<ContentCatalog>>;
  catalogIndex: Readonly<ShallowRef<ReadonlyMap<string, ContentDefinition>>>;
  clearSlotContent: (slotId: string) => void;
  compatibleContent: (slotTags: readonly string[]) => ContentDefinition[];
  debugEntries: Readonly<ShallowRef<readonly SlotDebugEntry[]>>;
  debugEnabled: Readonly<Ref<boolean>>;
  layout: Ref<SlotLayout>;
  registerDebugEntry: (entry: SlotDebugEntryInput) => SlotDebugRegistration;
  replaceCatalog: (nextCatalog: ContentCatalog) => void;
  replaceLayout: (nextLayout: SlotLayout) => void;
  setSlotContent: (slotId: string, contentId: string) => void;
};

const slotRuntimeKey = Symbol.for('agentg:control-plane:slot-runtime') as InjectionKey<SlotRuntime>;

export function createSlotRuntime(options: {
  catalog: ContentCatalog;
  debugEnabled?: Readonly<Ref<boolean>>;
  initialLayout: SlotLayout;
  onLayoutChange?: (layout: SlotLayout) => void;
}): SlotRuntime {
  const layout = ref(cloneSlotLayout(options.initialLayout));
  const catalog = shallowRef<ContentCatalog>(options.catalog);
  const catalogIndex = shallowRef<ReadonlyMap<string, ContentDefinition>>(
    createContentCatalogIndex(options.catalog)
  );
  const debugEnabled = options.debugEnabled ?? ref(false);
  const debugEntries = shallowRef<readonly SlotDebugEntry[]>([]);
  let nextDebugEntryId = 0;

  function commit(nextLayout: SlotLayout): void {
    layout.value = nextLayout;
    options.onLayoutChange?.(layout.value);
  }

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
    clearSlotContent(slotId) {
      commit(
        Object.fromEntries(
          Object.entries(layout.value)
            .filter(([currentSlotId]) => currentSlotId !== slotId)
            .map(([currentSlotId, entry]) => [currentSlotId, { contentId: entry.contentId }])
        )
      );
    },
    compatibleContent(slotTags) {
      return catalog.value.filter((content) => tagsCompatible(slotTags, content.tags));
    },
    debugEntries,
    debugEnabled,
    layout,
    registerDebugEntry,
    replaceCatalog(nextCatalog) {
      catalog.value = nextCatalog;
      catalogIndex.value = createContentCatalogIndex(nextCatalog);
    },
    replaceLayout(nextLayout) {
      commit(cloneSlotLayout(nextLayout));
    },
    setSlotContent(slotId, contentId) {
      const nextContentId = contentId.trim();
      if (nextContentId.length === 0) {
        this.clearSlotContent(slotId);
        return;
      }
      commit({
        ...layout.value,
        [slotId]: {
          contentId: nextContentId
        }
      });
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
    Object.entries(layout).map(([slotId, entry]) => [slotId, { contentId: entry.contentId }])
  );
}
