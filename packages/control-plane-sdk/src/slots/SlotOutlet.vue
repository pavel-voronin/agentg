<script setup lang="ts">
import {
  computed,
  markRaw,
  onBeforeUnmount,
  onErrorCaptured,
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
  SlotDebugRegistration,
  SlotRenderState
} from './types.js';

type SlotRootRef = ComponentPublicInstance | Element | null;
type SlotRenderError = {
  error: unknown;
  info: string;
};

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
const renderError = shallowRef<SlotRenderError | null>(null);
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
const contentAttrs = computed(() => ({
  ...(resolvedContent.value?.props ?? {}),
  ...attrs
}));
const slotElement = computed(() => htmlElementFromRef(slotRoot.value));
const slotState = computed<SlotRenderState>(() => {
  if (resolution.value.kind === 'empty') {
    return { kind: 'empty' };
  }
  if (resolution.value.kind === 'missing-content') {
    return {
      contentId: resolution.value.contentId,
      kind: 'missing-content'
    };
  }
  if (resolution.value.kind === 'incompatible') {
    return {
      contentId: resolution.value.content.contentId,
      kind: 'incompatible-content'
    };
  }

  const content = resolution.value.content;
  if (loadError.value !== null) {
    return {
      contentId: content.contentId,
      error: errorMessage(loadError.value),
      kind: 'component-load-error'
    };
  }
  if (renderError.value !== null) {
    return {
      contentId: content.contentId,
      error: renderErrorMessage(renderError.value),
      kind: 'component-render-error'
    };
  }
  if (contentComponent.value === null) {
    return {
      contentId: loadingContentId.value ?? content.contentId,
      kind: 'component-loading'
    };
  }

  return {
    contentId: content.contentId,
    kind: 'component-ready'
  };
});
let debugRegistration: SlotDebugRegistration | null = null;

watch(
  resolvedContent,
  async (content) => {
    const sequence = ++loadSequence;
    contentComponent.value = null;
    loadError.value = null;
    loadingContentId.value = content?.contentId ?? null;
    renderError.value = null;
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

onErrorCaptured((error, _instance, info) => {
  if (resolvedContent.value === null) {
    return;
  }
  renderError.value = {
    error,
    info
  };
  return false;
});

onBeforeUnmount(() => {
  debugRegistration?.unregister();
  debugRegistration = null;
});

const errorTitle = computed(() => {
  switch (slotState.value.kind) {
    case 'component-load-error':
      return `Expected ${slotState.value.contentId}, but it did not load.`;
    case 'component-render-error':
      return `${slotState.value.contentId} failed while rendering.`;
    case 'incompatible-content':
      return `${slotState.value.contentId} is not compatible with this slot.`;
    case 'missing-content':
      return `Expected ${slotState.value.contentId}, but it is not in the content catalog.`;
    case 'component-loading':
    case 'component-ready':
    case 'empty':
      return '';
  }
});

const errorDetail = computed(() => {
  if (slotState.value.kind === 'incompatible-content' && resolution.value.kind === 'incompatible') {
    return `Slot tags: ${resolution.value.slotTags.join(', ')}. Content tags: ${resolution.value.content.tags.join(', ')}.`;
  }
  if (
    slotState.value.kind === 'component-load-error' ||
    slotState.value.kind === 'component-render-error'
  ) {
    return slotState.value.error;
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

function renderErrorMessage(error: SlotRenderError): string {
  return error.info.length > 0
    ? `${errorMessage(error.error)} (${error.info})`
    : errorMessage(error.error);
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
  <div v-if="slotState.kind === 'empty'" ref="slotRoot" class="slot-outlet-default" v-bind="attrs">
    <slot></slot>
  </div>
  <div v-else-if="errorTitle" ref="slotRoot" class="slot-outlet-error" v-bind="attrs">
    <div class="slot-outlet-error__title">{{ errorTitle }}</div>
    <div v-if="errorDetail" class="slot-outlet-error__detail">{{ errorDetail }}</div>
  </div>
  <component
    v-else-if="slotState.kind === 'component-ready' && contentComponent"
    :is="contentComponent"
    ref="slotRoot"
    :slot-context="props.context"
    v-bind="contentAttrs"
  />
  <div v-else ref="slotRoot" class="slot-outlet-loading" v-bind="attrs">
    Loading {{ slotState.kind === 'component-loading' ? slotState.contentId : 'content' }}.
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.slot-outlet-default {
  @apply contents;
}

.slot-outlet-error {
  @apply min-h-32 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900;
}

.slot-outlet-error__title {
  @apply font-semibold;
}

.slot-outlet-error__detail {
  @apply mt-1 text-xs text-red-700;
}

.slot-outlet-loading {
  @apply min-h-32 rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500;
}
</style>
