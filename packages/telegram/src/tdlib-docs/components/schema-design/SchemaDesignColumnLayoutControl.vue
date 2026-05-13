<script setup lang="ts">
import type { StorageSchemaColumnLayout } from '../../storageReviewTypes.js';

defineProps<{
  columnLayout: StorageSchemaColumnLayout;
}>();

const emit = defineEmits<{
  change: [columnLayout: StorageSchemaColumnLayout];
}>();

const layouts: { label: string; value: StorageSchemaColumnLayout }[] = [
  { label: 'grid', value: 'grid' },
  { label: 'stacked', value: 'stacked' },
  { label: 'ddl', value: 'ddl' }
];
</script>

<template>
  <div class="schema-design-column-layout-control">
    <button
      v-for="layout in layouts"
      :key="layout.value"
      :aria-pressed="columnLayout === layout.value"
      :data-active="columnLayout === layout.value ? 'true' : undefined"
      class="schema-design-column-layout-control__button"
      type="button"
      @click="emit('change', layout.value)"
    >
      {{ layout.label }}
    </button>
  </div>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-column-layout-control {
  @apply flex shrink-0 items-center rounded border border-neutral-300 bg-white p-px;
}

.schema-design-column-layout-control__button {
  @apply flex h-[18px] appearance-none items-center justify-center rounded border border-transparent bg-transparent px-1 font-mono text-[11px] font-semibold leading-none text-neutral-500 outline-none hover:text-neutral-950;
}

.schema-design-column-layout-control__button[data-active='true'] {
  @apply border-sky-300 bg-sky-50 text-sky-800;
}
</style>
