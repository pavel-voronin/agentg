<script setup lang="ts">
import type { TelemetryStatusSourceView } from './statusSources.js';

defineProps<{
  sources: readonly TelemetryStatusSourceView[];
}>();
</script>

<template>
  <div class="source-indicators" aria-label="Telemetry source status">
    <span
      v-for="source in sources"
      :key="source.id"
      class="source-indicators__indicator"
      :aria-label="source.ariaLabel"
      :data-tone="source.tone"
      tabindex="0"
    >
      <span class="source-indicators__popover">
        <span class="source-indicators__name">{{ source.label }}</span>
        <span class="source-indicators__status">{{ source.status }}</span>
        <span v-for="detail in source.details" :key="detail" class="source-indicators__detail">
          {{ detail }}
        </span>
      </span>
    </span>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.source-indicators {
  @apply flex items-center gap-1;
}

.source-indicators__indicator {
  @apply relative block h-4 w-1.5 bg-zinc-300 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-zinc-300;
}

.source-indicators__indicator[data-tone='ok'] {
  @apply bg-emerald-500;
}

.source-indicators__indicator[data-tone='warn'] {
  @apply bg-amber-500;
}

.source-indicators__indicator[data-tone='bad'] {
  @apply bg-red-500;
}

.source-indicators__popover {
  @apply pointer-events-none invisible absolute right-0 top-6 z-20 grid w-64 gap-1 rounded border border-zinc-200 bg-white p-2 text-left text-xs font-normal leading-5 text-zinc-700 opacity-0 shadow-lg transition-opacity;
}

.source-indicators__indicator:hover .source-indicators__popover,
.source-indicators__indicator:focus .source-indicators__popover,
.source-indicators__indicator:focus-visible .source-indicators__popover {
  @apply visible opacity-100;
}

.source-indicators__name {
  @apply font-semibold text-zinc-950;
}

.source-indicators__status {
  @apply text-zinc-700;
}

.source-indicators__detail {
  @apply text-zinc-500;
}
</style>
