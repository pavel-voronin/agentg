<script setup lang="ts">
import {
  computed,
  markRaw,
  onBeforeUnmount,
  onErrorCaptured,
  shallowRef,
  watch,
  type Component
} from 'vue';

import type {
  ContentDefinition,
  ContentModule,
  SlotContext,
  SlotItemRenderState,
  SlotItemResolution
} from './types.js';

type SlotRenderError = {
  error: unknown;
  info: string;
};

const LOADING_FEEDBACK_DELAY_MS = 160;

const props = defineProps<{
  contentAttrs: Record<string, unknown>;
  context: SlotContext;
  item: SlotItemResolution;
}>();

const emit = defineEmits<{
  stateChange: [state: SlotItemRenderState];
}>();

const contentComponent = shallowRef<Component | null>(null);
const loadError = shallowRef<unknown>(null);
const loadingContentId = shallowRef<string | null>(null);
const loadingFeedbackVisible = shallowRef(false);
const renderedContent = shallowRef<ContentDefinition | null>(null);
const renderedContentId = shallowRef<string | null>(null);
const renderError = shallowRef<SlotRenderError | null>(null);

let loadSequence = 0;
let loadingFeedbackTimeoutId: ReturnType<typeof setTimeout> | null = null;

const resolvedContent = computed<ContentDefinition | null>(() =>
  props.item.kind === 'content' ? props.item.content : null
);
const renderedItemAttrs = computed(() => ({
  ...(renderedContent.value?.props ?? {})
}));
const hasContentAttrs = computed(() => Object.keys(props.contentAttrs).length > 0);
const shouldRenderContent = computed(
  () =>
    contentComponent.value !== null &&
    renderedContent.value !== null &&
    (itemState.value.kind === 'component-ready' || !loadingFeedbackVisible.value)
);
const itemState = computed<SlotItemRenderState>(() => {
  if (props.item.kind === 'missing-content') {
    return {
      contentId: props.item.contentId,
      index: props.item.index,
      kind: 'missing-content'
    };
  }
  if (props.item.kind === 'incompatible') {
    return {
      contentId: props.item.contentId,
      index: props.item.index,
      kind: 'incompatible-content'
    };
  }

  const content = props.item.content;
  if (loadError.value !== null) {
    return {
      contentId: content.contentId,
      error: errorMessage(loadError.value),
      index: props.item.index,
      kind: 'component-load-error'
    };
  }
  if (renderError.value !== null) {
    return {
      contentId: content.contentId,
      error: renderErrorMessage(renderError.value),
      index: props.item.index,
      kind: 'component-render-error'
    };
  }
  if (contentComponent.value === null || renderedContentId.value !== content.contentId) {
    return {
      contentId: loadingContentId.value ?? content.contentId,
      index: props.item.index,
      kind: 'component-loading'
    };
  }

  return {
    contentId: content.contentId,
    index: props.item.index,
    kind: 'component-ready'
  };
});

watch(
  resolvedContent,
  async (content) => {
    const sequence = ++loadSequence;
    clearLoadingFeedbackTimeout();
    loadError.value = null;
    loadingContentId.value = content?.contentId ?? null;
    renderError.value = null;

    if (content === null) {
      clearRenderedContent();
      loadingFeedbackVisible.value = false;
      return;
    }

    const keepRenderedContent =
      contentComponent.value !== null && renderedContentId.value === content.contentId;
    if (!keepRenderedContent) {
      scheduleLoadingFeedback(sequence);
    } else {
      renderedContent.value = content;
      loadingFeedbackVisible.value = false;
    }

    try {
      const contentModule = await content.load();
      if (sequence !== loadSequence) {
        return;
      }
      clearLoadingFeedbackTimeout();
      loadingFeedbackVisible.value = false;
      renderedContent.value = content;
      contentComponent.value = markRaw(vueComponentFromModule(contentModule));
      renderedContentId.value = content.contentId;
    } catch (error) {
      if (sequence !== loadSequence) {
        return;
      }
      clearLoadingFeedbackTimeout();
      clearRenderedContent();
      loadingFeedbackVisible.value = false;
      loadError.value = error;
    } finally {
      if (sequence === loadSequence) {
        loadingContentId.value = null;
      }
    }
  },
  { immediate: true }
);

watch(itemState, (state) => emit('stateChange', state), { immediate: true });

onBeforeUnmount(() => {
  clearLoadingFeedbackTimeout();
});

onErrorCaptured((error, _instance, info) => {
  const content = resolvedContent.value;
  if (content === null) {
    return;
  }
  if (renderedContentId.value !== content.contentId) {
    clearRenderedContent();
    loadingFeedbackVisible.value = true;
    return false;
  }
  renderError.value = {
    error,
    info
  };
  return false;
});

const errorTitle = computed(() => {
  switch (itemState.value.kind) {
    case 'component-load-error':
      return `Expected ${itemState.value.contentId}, but it did not load.`;
    case 'component-render-error':
      return `${itemState.value.contentId} failed while rendering.`;
    case 'incompatible-content':
      return `${itemState.value.contentId} is not compatible with this slot.`;
    case 'missing-content':
      return `Expected ${itemState.value.contentId}, but it is not in the content catalog.`;
    case 'component-loading':
    case 'component-ready':
      return '';
  }
});

const errorDetail = computed(() => {
  if (itemState.value.kind === 'incompatible-content' && props.item.kind === 'incompatible') {
    return `Slot tags: ${props.item.slotTags.join(', ')}. Content tags: ${props.item.content.tags.join(', ')}.`;
  }
  if (
    itemState.value.kind === 'component-load-error' ||
    itemState.value.kind === 'component-render-error'
  ) {
    return itemState.value.error;
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

function scheduleLoadingFeedback(sequence: number): void {
  if (contentComponent.value === null) {
    clearRenderedContent();
    loadingFeedbackVisible.value = true;
    return;
  }

  loadingFeedbackVisible.value = false;
  loadingFeedbackTimeoutId = setTimeout(() => {
    loadingFeedbackTimeoutId = null;
    if (sequence !== loadSequence) {
      return;
    }
    clearRenderedContent();
    loadingFeedbackVisible.value = true;
  }, LOADING_FEEDBACK_DELAY_MS);
}

function clearLoadingFeedbackTimeout(): void {
  if (loadingFeedbackTimeoutId === null) {
    return;
  }
  clearTimeout(loadingFeedbackTimeoutId);
  loadingFeedbackTimeoutId = null;
}

function clearRenderedContent(): void {
  contentComponent.value = null;
  renderedContent.value = null;
  renderedContentId.value = null;
}

function vueComponentFromModule(contentModule: unknown): Component {
  return (contentModule as ContentModule).default;
}
</script>

<template>
  <div v-if="errorTitle" class="slot-outlet-item-error" v-bind="contentAttrs">
    <div class="slot-outlet-item-error__title">{{ errorTitle }}</div>
    <div v-if="errorDetail" class="slot-outlet-item-error__detail">{{ errorDetail }}</div>
  </div>
  <div
    v-else-if="shouldRenderContent && contentComponent"
    class="slot-outlet-item-content"
    :data-content-attrs="hasContentAttrs ? 'true' : undefined"
    v-bind="contentAttrs"
  >
    <component :is="contentComponent" :slot-context="context" v-bind="renderedItemAttrs" />
  </div>
  <div v-else class="slot-outlet-item-loading" v-bind="contentAttrs">
    Loading {{ itemState.kind === 'component-loading' ? itemState.contentId : 'content' }}.
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.slot-outlet-item-content {
  @apply contents;
}

.slot-outlet-item-content[data-content-attrs='true'] {
  @apply block;
}

.slot-outlet-item-error {
  @apply min-h-32 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900;
}

.slot-outlet-item-error__title {
  @apply font-semibold;
}

.slot-outlet-item-error__detail {
  @apply mt-1 text-xs text-red-700;
}

.slot-outlet-item-loading {
  @apply min-h-32 rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500;
}
</style>
