<script setup lang="ts">
import type { SchemaDesignScrollIndicatorStyle } from './schemaDesignScrollIndicator.js';

defineProps<{
  indicatorStyle: SchemaDesignScrollIndicatorStyle;
  scrollable: boolean;
}>();
</script>

<template>
  <div
    :data-scrollable="scrollable ? 'true' : undefined"
    :style="indicatorStyle"
    aria-hidden="true"
    class="schema-design-scroll-indicator"
  >
    <div class="schema-design-scroll-indicator__thumb"></div>
  </div>
</template>

<style scoped>
@reference '../../style.css';

.schema-design-scroll-indicator {
  @apply pointer-events-none absolute right-0 top-[var(--schema-design-scroll-track-top)] z-20 hidden h-[var(--schema-design-scroll-track-height)] w-1.5 rounded-full bg-neutral-200;
}

.schema-design-scroll-indicator[data-scrollable='true'] {
  @apply block;
}

.schema-design-scroll-indicator__thumb {
  @apply absolute left-0 right-0 top-0 h-[var(--schema-design-scroll-thumb-height)] translate-y-[var(--schema-design-scroll-thumb-offset)] rounded-full bg-neutral-500;
}
</style>
