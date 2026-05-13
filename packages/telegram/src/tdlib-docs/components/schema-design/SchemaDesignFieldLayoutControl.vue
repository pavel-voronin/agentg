<script setup lang="ts">
import type { SchemaDesignFieldLayout } from '../../schemaDesignView.js';

defineProps<{
  fieldLayout: SchemaDesignFieldLayout;
}>();

const emit = defineEmits<{
  change: [fieldLayout: SchemaDesignFieldLayout];
}>();

const layouts: { label: string; value: SchemaDesignFieldLayout }[] = [
  { label: 'grid', value: 'grid' },
  { label: 'stacked', value: 'stacked' }
];
</script>

<template>
  <div class="schema-design-field-layout-control">
    <button
      v-for="layout in layouts"
      :key="layout.value"
      :aria-pressed="fieldLayout === layout.value"
      :data-active="fieldLayout === layout.value ? 'true' : undefined"
      class="schema-design-field-layout-control__button"
      type="button"
      @click="emit('change', layout.value)"
    >
      {{ layout.label }}
    </button>
  </div>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-field-layout-control {
  @apply flex shrink-0 items-center rounded border border-neutral-300 bg-white p-px;
}

.schema-design-field-layout-control__button {
  @apply flex h-[18px] appearance-none items-center justify-center rounded border border-transparent bg-transparent px-1 font-mono text-[11px] font-semibold leading-none text-neutral-500 outline-none hover:text-neutral-950;
}

.schema-design-field-layout-control__button[data-active='true'] {
  @apply border-sky-300 bg-sky-50 text-sky-800;
}
</style>
