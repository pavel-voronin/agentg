<script setup lang="ts">
import type { SchemaDesignLeftPane } from '../../schemaDesignView.js';
import SchemaDesignLeftTabs from './schemaDesignLeftTabs.vue';

defineProps<{
  activePane: SchemaDesignLeftPane;
  filterText: string;
  statusState: 'error' | 'loading' | 'ready' | 'saving';
  statusText: string;
  typeCount: number;
  updateCount: number;
}>();

const emit = defineEmits<{
  activePaneChange: [pane: SchemaDesignLeftPane];
  closeAll: [];
  'update:filterText': [value: string];
}>();

function onFilterInput(event: Event): void {
  const target = event.currentTarget;
  if (target instanceof HTMLInputElement) {
    emit('update:filterText', target.value);
  }
}
</script>

<template>
  <header class="schema-design-toolbar">
    <SchemaDesignLeftTabs
      :active-pane="activePane"
      :type-count="typeCount"
      :update-count="updateCount"
      @change="emit('activePaneChange', $event)"
    />
    <Teleport defer to="#schema-design-header-actions">
      <label class="schema-design-toolbar__filter">
        <span class="schema-design-toolbar__filter-label">Filter</span>
        <input
          :value="filterText"
          aria-label="Filter"
          class="schema-design-toolbar__filter-input"
          placeholder="Filter"
          type="search"
          @input="onFilterInput"
        />
      </label>
      <button class="schema-design-toolbar__close-button" type="button" @click="emit('closeAll')">
        Close all
      </button>
      <span :data-state="statusState" class="schema-design-toolbar__status">
        <span class="schema-design-toolbar__status-dot"></span>
        <span class="schema-design-toolbar__status-text">{{ statusText }}</span>
      </span>
    </Teleport>
  </header>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-toolbar {
  @apply flex shrink-0 items-center border-b border-neutral-200 bg-white px-3 py-1;
}

.schema-design-toolbar__filter {
  @apply block w-56 min-w-0;
}

.schema-design-toolbar__filter-label {
  @apply sr-only;
}

.schema-design-toolbar__filter-input {
  @apply h-8 w-full min-w-0 appearance-none rounded border border-neutral-300 bg-white px-2 text-sm leading-none text-neutral-950 outline-none placeholder:text-neutral-400 focus:border-sky-500;
}

.schema-design-toolbar__close-button {
  @apply h-8 appearance-none rounded border border-neutral-300 bg-white px-2 text-xs font-semibold uppercase leading-none text-neutral-600 outline-none hover:border-neutral-500 hover:text-neutral-950;
}

.schema-design-toolbar__status {
  @apply flex h-8 min-w-[84px] items-center justify-center gap-1.5 rounded border border-neutral-300 bg-white px-2 text-xs font-semibold uppercase leading-none text-neutral-600;
}

.schema-design-toolbar__status-dot {
  @apply h-1.5 w-1.5 rounded-full bg-neutral-400;
}

.schema-design-toolbar__status[data-state='ready'] .schema-design-toolbar__status-dot {
  @apply bg-emerald-500;
}

.schema-design-toolbar__status[data-state='loading'] .schema-design-toolbar__status-dot,
.schema-design-toolbar__status[data-state='saving'] .schema-design-toolbar__status-dot {
  @apply bg-amber-500;
}

.schema-design-toolbar__status[data-state='error'] .schema-design-toolbar__status-dot {
  @apply bg-red-500;
}

.schema-design-toolbar__status-text {
  @apply leading-none;
}

@media (max-width: 900px) {
  .schema-design-toolbar__filter {
    @apply max-w-48;
  }
}
</style>
