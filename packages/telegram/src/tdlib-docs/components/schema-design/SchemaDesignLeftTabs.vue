<script setup lang="ts">
import type { SchemaDesignLeftPane } from '../../schemaDesignView.js';

defineProps<{
  activePane: SchemaDesignLeftPane;
  typeCount: number;
  updateCount: number;
}>();

const emit = defineEmits<{
  change: [pane: SchemaDesignLeftPane];
}>();
</script>

<template>
  <nav class="schema-design-left-tabs" aria-label="Schema design left pane">
    <button
      :data-active="activePane === 'types' ? 'true' : undefined"
      class="schema-design-left-tabs__button"
      type="button"
      @click="emit('change', 'types')"
    >
      Types
      <span class="schema-design-left-tabs__count">{{ typeCount }}</span>
    </button>
    <button
      :data-active="activePane === 'updates' ? 'true' : undefined"
      class="schema-design-left-tabs__button"
      type="button"
      @click="emit('change', 'updates')"
    >
      Updates
      <span class="schema-design-left-tabs__count">{{ updateCount }}</span>
    </button>
  </nav>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-left-tabs {
  @apply flex items-center gap-1 bg-white;
}

.schema-design-left-tabs__button {
  @apply inline-flex h-8 appearance-none items-center gap-1 rounded border border-neutral-300 bg-white px-2 text-xs font-semibold uppercase leading-none text-neutral-600 outline-none hover:border-neutral-500 hover:text-neutral-950;
}

.schema-design-left-tabs__button[data-active='true'] {
  @apply border-sky-500 bg-sky-50 text-sky-800;
}

.schema-design-left-tabs__count {
  @apply font-mono text-[11px] font-medium normal-case text-neutral-400;
}
</style>
