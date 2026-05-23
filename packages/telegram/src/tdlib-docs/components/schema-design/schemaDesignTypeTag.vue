<script setup lang="ts">
import { ref } from 'vue';

import { schemaConstructorFieldCount, type SchemaDesignProgress } from '../../schemaDesignView.js';
import type {
  StorageReviewEntry,
  StorageSchemaConstructorDesign
} from '../../storageReviewTypes.js';
import SchemaDesignHoverPopover from './schemaDesignHoverPopover.vue';

defineProps<{
  constructors: StorageSchemaConstructorDesign[];
  entry: StorageReviewEntry;
  expanded: boolean;
  progress: SchemaDesignProgress;
}>();

const emit = defineEmits<{
  toggle: [];
}>();

const popover = ref<{ left: number; top: number } | null>(null);

function showPopover(event: MouseEvent): void {
  popover.value = {
    left: Math.min(event.clientX + 14, window.innerWidth - 420),
    top: Math.min(event.clientY + 14, window.innerHeight - 260)
  };
}

function hidePopover(): void {
  popover.value = null;
}
</script>

<template>
  <span class="schema-design-type-tag">
    <button
      :aria-expanded="expanded"
      :data-expanded="expanded ? 'true' : undefined"
      class="schema-design-type-tag__button"
      type="button"
      @click="emit('toggle')"
      @mouseenter="showPopover"
      @mouseleave="hidePopover"
      @mousemove="showPopover"
    >
      {{ entry.type }}
    </button>
    <Teleport to="body">
      <SchemaDesignHoverPopover v-if="popover !== null" :left="popover.left" :top="popover.top">
        <div class="schema-design-type-tag__popover">
          <span class="schema-design-type-tag__label">Type</span>
          <span class="schema-design-type-tag__text">{{ entry.type }}</span>
          <span class="schema-design-type-tag__label">Storage</span>
          <span class="schema-design-type-tag__text">{{ entry.storage }}</span>
          <span class="schema-design-type-tag__label">Constructors</span>
          <span class="schema-design-type-tag__text">{{ constructors.length }}</span>
          <span class="schema-design-type-tag__label">Fields</span>
          <span class="schema-design-type-tag__text">
            {{ schemaConstructorFieldCount(constructors) }}
          </span>
          <span class="schema-design-type-tag__label">Progress</span>
          <span class="schema-design-type-tag__text">{{ progress.title }}</span>
        </div>
      </SchemaDesignHoverPopover>
    </Teleport>
  </span>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-type-tag {
  @apply inline-flex min-w-0 max-w-full items-center;
}

.schema-design-type-tag__button {
  @apply inline-flex max-w-full appearance-none items-center overflow-hidden text-ellipsis whitespace-nowrap rounded border border-l-2 border-neutral-200 border-l-sky-300 bg-white px-1 py-0 font-mono text-[0.92em] leading-snug text-sky-600 outline-none hover:border-neutral-300 hover:bg-sky-50 hover:text-sky-800;
}

.schema-design-type-tag__button[data-expanded='true'] {
  @apply border-yellow-300 bg-yellow-200 text-neutral-950;
}

.schema-design-type-tag__popover {
  @apply grid grid-cols-[88px_minmax(0,1fr)] gap-x-2 gap-y-1;
}

.schema-design-type-tag__label {
  @apply text-[11px] font-semibold uppercase leading-snug text-neutral-500;
}

.schema-design-type-tag__text {
  @apply min-w-0 break-words font-mono text-xs text-neutral-800;
}
</style>
