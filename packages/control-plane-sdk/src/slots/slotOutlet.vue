<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  shallowRef,
  useAttrs,
  watch,
  type ComponentPublicInstance
} from 'vue';

import { resolveSlotContents } from './resolver.js';
import { useSlotRuntime } from './runtime.js';
import type {
  SlotContext,
  SlotItemRenderState,
  SlotItemResolution,
  SlotDebugRegistration,
  SlotRenderState
} from './types.js';
import SlotOutletItem from './slotOutletItem.vue';

type SlotRootRef = ComponentPublicInstance | Element | null;

const props = withDefaults(
  defineProps<{
    context?: SlotContext | undefined;
    maxItems?: number | undefined;
    slotId: string;
    tags: string[];
  }>(),
  {
    context: () => ({})
  }
);

defineOptions({
  inheritAttrs: false
});

const attrs = useAttrs();
const runtime = useSlotRuntime();
const itemStates = shallowRef<ReadonlyMap<string, SlotItemRenderState>>(new Map());
const slotRoot = shallowRef<SlotRootRef>(null);

const resolution = computed(() =>
  resolveSlotContents(
    {
      slotId: props.slotId,
      tags: props.tags
    },
    runtime.layout.value,
    runtime.catalogIndex.value,
    {
      maxItems: props.maxItems
    }
  )
);

const resolvedItems = computed<readonly SlotItemResolution[]>(() =>
  resolution.value.kind === 'contents' ? resolution.value.items : []
);
const slotElement = computed(() => htmlElementFromRef(slotRoot.value));
const slotState = computed<SlotRenderState>(() => {
  if (resolution.value.kind === 'empty') {
    return { kind: 'empty' };
  }
  return {
    items: resolution.value.items.map(
      (item) => itemStates.value.get(slotItemKey(item)) ?? initialItemState(item)
    ),
    kind: 'contents',
    overflowCount: resolution.value.overflowCount
  };
});
let debugRegistration: SlotDebugRegistration | null = null;

watch(
  resolvedItems,
  (items) => {
    const nextKeys = new Set(items.map(slotItemKey));
    itemStates.value = new Map(
      [...itemStates.value.entries()].filter(([key]) => nextKeys.has(key))
    );
  },
  { immediate: true }
);

watch(
  () => ({
    resolution: resolution.value,
    slotId: props.slotId,
    state: slotState.value,
    tags: [...props.tags],
    target: slotElement.value
  }),
  (entry) => {
    if (debugRegistration === null) {
      debugRegistration = runtime.registerDebugEntry(entry);
      return;
    }
    debugRegistration.update(entry);
  },
  { flush: 'post', immediate: true }
);

onBeforeUnmount(() => {
  debugRegistration?.unregister();
  debugRegistration = null;
});

function setItemState(item: SlotItemResolution, state: SlotItemRenderState): void {
  itemStates.value = new Map(itemStates.value).set(slotItemKey(item), state);
}

function initialItemState(item: SlotItemResolution): SlotItemRenderState {
  switch (item.kind) {
    case 'content':
      return {
        contentId: item.contentId,
        index: item.index,
        kind: 'component-loading'
      };
    case 'incompatible':
      return {
        contentId: item.contentId,
        index: item.index,
        kind: 'incompatible-content'
      };
    case 'missing-content':
      return {
        contentId: item.contentId,
        index: item.index,
        kind: 'missing-content'
      };
  }
}

function slotItemKey(item: SlotItemResolution): string {
  return `${String(item.index)}:${item.contentId}`;
}

function htmlElementFromRef(value: SlotRootRef): HTMLElement | null {
  if (isHtmlElement(value)) {
    return value;
  }
  if (isComponentInstance(value)) {
    return isHtmlElement(value.$el) ? value.$el : null;
  }
  return null;
}

function isHtmlElement(value: unknown): value is HTMLElement {
  return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

function isComponentInstance(value: unknown): value is ComponentPublicInstance {
  return typeof value === 'object' && value !== null && '$el' in value;
}
</script>

<template>
  <div v-if="slotState.kind === 'empty'" ref="slotRoot" class="slot-outlet-default" v-bind="attrs">
    <slot></slot>
  </div>
  <div v-else ref="slotRoot" class="slot-outlet-content">
    <SlotOutletItem
      v-for="item in resolvedItems"
      :key="slotItemKey(item)"
      :content-attrs="attrs"
      :context="props.context"
      :item="item"
      @state-change="(state) => setItemState(item, state)"
    />
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.slot-outlet-default {
  @apply contents;
}

.slot-outlet-content {
  @apply contents;
}
</style>
