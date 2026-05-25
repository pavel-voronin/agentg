<script setup lang="ts">
import { ref } from 'vue';

import { schemaTableColumnLabel } from '../../schemaDesignView.js';
import type { StorageSchemaTable } from '../../storageReviewTypes.js';
import SchemaDesignHoverPopover from './schemaDesignHoverPopover.vue';

defineProps<{
  expanded: boolean;
  table: StorageSchemaTable;
}>();

const emit = defineEmits<{
  toggle: [];
}>();

const popover = ref<{ left: number; top: number } | null>(null);

function showPopover(event: MouseEvent): void {
  popover.value = {
    left: Math.min(event.clientX + 14, window.innerWidth - 440),
    top: Math.min(event.clientY + 14, window.innerHeight - 280)
  };
}

function hidePopover(): void {
  popover.value = null;
}
</script>

<template>
  <span class="schema-design-table-tag">
    <button
      :aria-expanded="expanded"
      :data-expanded="expanded ? 'true' : undefined"
      class="schema-design-table-tag__button"
      type="button"
      @click="emit('toggle')"
      @mouseenter="showPopover"
      @mouseleave="hidePopover"
      @mousemove="showPopover"
    >
      {{ table.name }}
    </button>
    <Teleport to="body">
      <SchemaDesignHoverPopover v-if="popover !== null" :left="popover.left" :top="popover.top">
        <div class="schema-design-table-tag__popover">
          <span class="schema-design-table-tag__label">Table</span>
          <span class="schema-design-table-tag__text">{{ table.name }}</span>
          <span class="schema-design-table-tag__label">Columns</span>
          <span class="schema-design-table-tag__text">{{ schemaTableColumnLabel(table) }}</span>
          <span class="schema-design-table-tag__label">Primary key</span>
          <span class="schema-design-table-tag__text">
            {{ table.primaryKey.length === 0 ? 'pending' : table.primaryKey.join(', ') }}
          </span>
          <span class="schema-design-table-tag__label">Source types</span>
          <span class="schema-design-table-tag__text">{{ table.sourceTypes.join(', ') }}</span>
          <span class="schema-design-table-tag__label">Indirect</span>
          <span class="schema-design-table-tag__text">
            {{
              table.indirectSourceTypes.length === 0 ? 'none' : table.indirectSourceTypes.join(', ')
            }}
          </span>
        </div>
      </SchemaDesignHoverPopover>
    </Teleport>
  </span>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-table-tag {
  @apply inline-flex min-w-0 max-w-full items-center;
}

.schema-design-table-tag__button {
  @apply inline-flex max-w-full appearance-none items-center overflow-hidden text-ellipsis whitespace-nowrap rounded border border-l-2 border-neutral-200 border-l-rose-500 bg-white px-1 py-0 font-mono text-[0.92em] leading-snug text-rose-800 outline-none hover:border-neutral-300 hover:bg-rose-50 hover:text-rose-950;
}

.schema-design-table-tag__button[data-expanded='true'] {
  @apply border-yellow-300 bg-yellow-200 text-neutral-950;
}

.schema-design-table-tag__popover {
  @apply grid grid-cols-[88px_minmax(0,1fr)] gap-x-2 gap-y-1;
}

.schema-design-table-tag__label {
  @apply text-[11px] font-semibold uppercase leading-snug text-neutral-500;
}

.schema-design-table-tag__text {
  @apply min-w-0 break-words font-mono text-xs text-neutral-800;
}
</style>
