<script setup lang="ts">
import { computed } from 'vue';

import type { Selection, TreeProviderGroup } from './viewTypes.js';

const props = defineProps<{
  annotationKeys: readonly string[];
  busy: boolean;
  collectionKeys: readonly string[];
  providerGroups: readonly TreeProviderGroup[];
  selection: Selection | null;
}>();

const emit = defineEmits<{
  select: [selection: Selection];
}>();

const models = computed(() =>
  props.providerGroups
    .flatMap((group) => group.models)
    .map((entry) => entry.model)
    .sort((left, right) => left.localeCompare(right))
);

function isSelected(next: Selection): boolean {
  if (props.selection === null) {
    return false;
  }
  if (next.kind === 'model') {
    return props.selection.kind === 'model' && props.selection.model === next.model;
  }
  if (next.kind === 'annotation') {
    return props.selection.kind === 'annotation' && props.selection.key === next.key;
  }
  if (next.kind === 'collection') {
    return props.selection.kind === 'collection' && props.selection.key === next.key;
  }
  return false;
}
</script>

<template>
  <aside class="data-tree">
    <section class="data-tree__group">
      <h2 class="data-tree__group-title">Models</h2>
      <div class="data-tree__children">
        <button
          v-for="model in models"
          :key="model"
          type="button"
          class="data-tree__node"
          :data-active="isSelected({ kind: 'model', model })"
          :disabled="busy"
          @click="emit('select', { kind: 'model', model })"
        >
          <span class="data-tree__label">{{ model }}</span>
        </button>
      </div>
    </section>

    <section class="data-tree__group">
      <h2 class="data-tree__group-title">Annotations</h2>
      <div class="data-tree__children">
        <button
          v-for="key in annotationKeys"
          :key="key"
          type="button"
          class="data-tree__node"
          :data-active="isSelected({ kind: 'annotation', key })"
          :disabled="busy"
          @click="emit('select', { kind: 'annotation', key })"
        >
          <span class="data-tree__label">{{ key }}</span>
        </button>
        <div v-if="annotationKeys.length === 0" class="data-tree__empty">No annotations</div>
      </div>
    </section>

    <section class="data-tree__group">
      <h2 class="data-tree__group-title">Collections</h2>
      <div class="data-tree__children">
        <button
          v-for="key in collectionKeys"
          :key="key"
          type="button"
          class="data-tree__node"
          :data-active="isSelected({ kind: 'collection', key })"
          :disabled="busy"
          @click="emit('select', { kind: 'collection', key })"
        >
          <span class="data-tree__label">{{ key }}</span>
        </button>
        <div v-if="collectionKeys.length === 0" class="data-tree__empty">No collections</div>
      </div>
    </section>
  </aside>
</template>

<style scoped>
@reference "tailwindcss";

.data-tree {
  @apply flex min-h-0 flex-col gap-3 overflow-auto overscroll-none border-b border-zinc-200 bg-zinc-50 px-3 py-3 xl:border-b-0 xl:border-r;
}

.data-tree__group {
  @apply py-0;
}

.data-tree__group-title {
  @apply h-7 px-1.5 text-sm font-semibold leading-7 text-zinc-800;
}

.data-tree__children {
  @apply grid;
}

.data-tree__node {
  @apply flex h-6 w-full min-w-0 items-center truncate border-r border-transparent px-1.5 text-left text-xs text-zinc-700 hover:bg-white hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-default disabled:opacity-50;
}

.data-tree__node[data-active='true'] {
  @apply border-current font-semibold;
}

.data-tree__label {
  @apply min-w-0 truncate;
}

.data-tree__empty {
  @apply px-1.5 py-1 text-xs text-zinc-500;
}
</style>
