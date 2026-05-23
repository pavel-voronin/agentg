<script setup lang="ts">
import { ref } from 'vue';

import type { StorageReviewEntry } from '../../storageReviewTypes.js';
import SchemaDesignHoverPopover from './schemaDesignHoverPopover.vue';

defineProps<{
  entry: StorageReviewEntry;
}>();

const popover = ref<{ left: number; top: number } | null>(null);

function showPopover(event: MouseEvent): void {
  popover.value = {
    left: Math.min(event.clientX + 14, window.innerWidth - 420),
    top: Math.min(event.clientY + 14, window.innerHeight - 220)
  };
}

function hidePopover(): void {
  popover.value = null;
}
</script>

<template>
  <span class="schema-design-storage-badge">
    <span
      class="schema-design-storage-badge__value"
      @mouseenter="showPopover"
      @mouseleave="hidePopover"
      @mousemove="showPopover"
    >
      {{ entry.storage }}
    </span>
    <Teleport to="body">
      <SchemaDesignHoverPopover v-if="popover !== null" :left="popover.left" :top="popover.top">
        <div class="schema-design-storage-badge__popover">
          <span class="schema-design-storage-badge__label">Storage</span>
          <span class="schema-design-storage-badge__text">{{ entry.storage }}</span>
          <span class="schema-design-storage-badge__label">Schema target</span>
          <span class="schema-design-storage-badge__text">{{ entry.storageTarget }}</span>
        </div>
      </SchemaDesignHoverPopover>
    </Teleport>
  </span>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-storage-badge {
  @apply inline-flex min-w-0 shrink-0 items-center;
}

.schema-design-storage-badge__value {
  @apply max-w-[100px] overflow-hidden text-ellipsis whitespace-nowrap rounded border border-neutral-200 bg-white px-1 py-0 font-mono text-[0.92em] leading-snug text-neutral-700 hover:border-neutral-300 hover:bg-sky-50 hover:text-sky-900;
}

.schema-design-storage-badge__popover {
  @apply grid grid-cols-[max-content_minmax(0,1fr)] gap-x-2 gap-y-1;
}

.schema-design-storage-badge__label {
  @apply whitespace-nowrap text-[11px] font-semibold uppercase leading-snug text-neutral-500;
}

.schema-design-storage-badge__text {
  @apply min-w-0 break-words font-mono text-xs text-neutral-800;
}
</style>
