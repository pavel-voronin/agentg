<script setup lang="ts">
import type { ClientMode } from '../clientRoute.js';

const props = defineProps<{
  activeMode: ClientMode;
  modes: readonly {
    id: ClientMode;
    label: string;
  }[];
}>();

const emit = defineEmits<{
  modeSelect: [mode: ClientMode];
}>();
</script>

<template>
  <nav class="client-mode-navigation" aria-label="Client modes">
    <button
      v-for="mode in props.modes"
      :key="mode.id"
      type="button"
      role="tab"
      class="client-mode-navigation__button"
      :aria-selected="mode.id === props.activeMode"
      :data-active="mode.id === props.activeMode ? 'true' : undefined"
      @click="emit('modeSelect', mode.id)"
    >
      {{ mode.label }}
    </button>
  </nav>
</template>

<style scoped>
@reference "tailwindcss";

.client-mode-navigation {
  @apply flex shrink-0 gap-1 border-b border-zinc-200 bg-white px-4 pt-2;
}

.client-mode-navigation__button {
  @apply border-b-2 border-transparent px-3 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-900;
}

.client-mode-navigation__button[data-active='true'] {
  @apply border-teal-600 text-teal-700;
}
</style>
