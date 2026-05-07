<script setup lang="ts">
import {
  computed,
  markRaw,
  onBeforeUnmount,
  shallowRef,
  useAttrs,
  watch,
  type Component,
  type ComponentPublicInstance
} from 'vue';

import { resolveSlotContent } from './resolver.js';
import { useSlotRuntime } from './runtime.js';
import type {
  ContentDefinition,
  ContentModule,
  SlotContext,
  SlotDebugRegistration
} from './types.js';

type SlotRootRef = ComponentPublicInstance | Element | null;

const props = withDefaults(
  defineProps<{
    context?: SlotContext | undefined;
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
const contentComponent = shallowRef<Component | null>(null);
const loadError = shallowRef<unknown>(null);
const loadingContentId = shallowRef<string | null>(null);
const slotRoot = shallowRef<SlotRootRef>(null);

let loadSequence = 0;

const resolution = computed(() =>
  resolveSlotContent(
    {
      slotId: props.slotId,
      tags: props.tags
    },
    runtime.layout.value,
    runtime.catalogIndex
  )
);

const resolvedContent = computed<ContentDefinition | null>(() =>
  resolution.value.kind === 'content' ? resolution.value.content : null
);
const slotElement = computed(() => htmlElementFromRef(slotRoot.value));
let debugRegistration: SlotDebugRegistration | null = null;

watch(
  resolvedContent,
  async (content) => {
    const sequence = ++loadSequence;
    contentComponent.value = null;
    loadError.value = null;
    loadingContentId.value = content?.contentId ?? null;
    slotRoot.value = null;

    if (content === null) {
      return;
    }

    try {
      const contentModule = await content.load();
      if (sequence !== loadSequence) {
        return;
      }
      contentComponent.value = markRaw(vueComponentFromModule(contentModule));
    } catch (error) {
      if (sequence !== loadSequence) {
        return;
      }
      loadError.value = error;
    } finally {
      if (sequence === loadSequence) {
        loadingContentId.value = null;
      }
    }
  },
  { immediate: true }
);

watch(
  () => ({
    resolution: resolution.value,
    slotId: props.slotId,
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

const errorTitle = computed(() => {
  if (resolution.value.kind === 'missing-content') {
    return `Expected ${resolution.value.contentId}, but it is not in the content catalog.`;
  }
  if (resolution.value.kind === 'incompatible') {
    return `${resolution.value.content.contentId} is not compatible with this slot.`;
  }
  if (loadError.value !== null) {
    return `Expected ${resolvedContent.value?.contentId ?? 'content'}, but it did not load.`;
  }
  return '';
});

const errorDetail = computed(() => {
  if (resolution.value.kind === 'incompatible') {
    return `Slot tags: ${resolution.value.slotTags.join(', ')}. Content tags: ${resolution.value.content.tags.join(', ')}.`;
  }
  if (loadError.value !== null) {
    return errorMessage(loadError.value);
  }
  return '';
});

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

function vueComponentFromModule(contentModule: unknown): Component {
  return (contentModule as ContentModule).default;
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
  <slot v-if="resolution.kind === 'empty'"></slot>
  <div
    v-else-if="errorTitle"
    ref="slotRoot"
    class="min-h-32 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"
    v-bind="attrs"
  >
    <div class="font-semibold">{{ errorTitle }}</div>
    <div v-if="errorDetail" class="mt-1 text-xs text-red-700">{{ errorDetail }}</div>
  </div>
  <component
    v-else-if="contentComponent"
    :is="contentComponent"
    ref="slotRoot"
    :slot-context="props.context"
    v-bind="attrs"
  />
  <div
    v-else
    ref="slotRoot"
    class="min-h-32 rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500"
    v-bind="attrs"
  >
    Loading {{ loadingContentId }}.
  </div>
</template>
